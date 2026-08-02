/**
 * AI soak harness.
 *
 * Runs a large batch of seeded AI-versus-AI bouts and reports the behavioural
 * evidence that keeps the balance honest: outcome distribution, punch mix per
 * archetype, bout lengths, and the head-to-head matrix.
 *
 * Any deadlock, NaN, illegal transition or impossible result fails the run.
 *
 *   npm run soak                # 120 bouts
 *   npm run soak -- --bouts 400 --json artifacts/qa/soak.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ROSTER } from '../src/data/fighters';
import { MIRROR_ROSTER } from '../src/data/mirror';
import { makeRuleset } from '../src/data/rulesets';
import { VENUES } from '../src/data/venues';
import { DIFFICULTIES, type DifficultyId } from '../src/ai/profiles';
import { simulateAiBout } from '../src/sim/runner';
import { BALANCE_TARGETS } from './balance-targets';
import type { ArchetypeId, PunchId } from '../src/sim/types';

interface Args {
  bouts: number;
  json: string | null;
  difficulty: DifficultyId;
  seed: number;
  /** Use identical-ratings control fighters so only the archetype differs. */
  mirror: boolean;
  /**
   * Assert the documented balance targets and exit non-zero on any miss.
   * Implies `--mirror` and raises the sample to `BALANCE_TARGETS.certifySize`,
   * because the documented band is narrower than the sampling error of a
   * smaller batch and asserting it there would measure the seed.
   */
  certify?: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { bouts: 120, json: null, difficulty: 'contender', seed: 1000, mirror: false, certify: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bouts') out.bouts = Number(argv[++i]);
    else if (argv[i] === '--json') out.json = argv[++i];
    else if (argv[i] === '--difficulty') out.difficulty = argv[++i] as DifficultyId;
    else if (argv[i] === '--seed') out.seed = Number(argv[++i]);
    else if (argv[i] === '--mirror') out.mirror = true;
    else if (argv[i] === '--certify') {
      out.certify = true;
      out.mirror = true;
    }
  }
  if (out.certify && out.bouts < BALANCE_TARGETS.certifySize) out.bouts = BALANCE_TARGETS.certifySize;
  return out;
}

/**
 * Checks a report against the documented targets.
 *
 * Returns the failures rather than printing them, so the caller decides
 * whether a miss is fatal. Every number comes from `BALANCE_TARGETS`; there
 * are no literals here, which is the point.
 */
export function certify(r: SoakReport): string[] {
  const t = BALANCE_TARGETS;
  const misses: string[] = [];
  const band = (label: string, value: number, min: number, max: number, show = pctOf(value)): void => {
    if (value < min || value > max) {
      misses.push(`${label} ${show} is outside the documented ${pctOf(min)}–${pctOf(max)}`);
    }
  };

  for (const a of r.archetypes) {
    band(
      `${a.archetype} win rate`,
      a.wins / Math.max(1, a.bouts),
      t.archetypeWinRate.min,
      t.archetypeWinRate.max,
      `${((a.wins / Math.max(1, a.bouts)) * 100).toFixed(1)}% (${a.wins}/${a.bouts})`,
    );
  }
  band('accuracy', r.meanLandPercent / 100, t.accuracy.min, t.accuracy.max, `${r.meanLandPercent.toFixed(1)}%`);
  band(
    'stoppage rate',
    (r.outcomes.ko + r.outcomes.tko) / Math.max(1, r.bouts),
    t.stoppageRate.min,
    t.stoppageRate.max,
  );
  if (r.meanRounds < t.meanRounds.min || r.meanRounds > t.meanRounds.max) {
    misses.push(
      `mean rounds ${r.meanRounds.toFixed(2)} is outside the documented ${t.meanRounds.min}–${t.meanRounds.max}`,
    );
  }
  return misses;
}

function pctOf(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export interface ArchetypeStats {
  archetype: ArchetypeId;
  bouts: number;
  wins: number;
  kos: number;
  thrown: number;
  landed: number;
  headLanded: number;
  bodyLanded: number;
  knockdownsFor: number;
  knockdownsAgainst: number;
  punchMix: Record<PunchId, number>;
}

export interface SoakReport {
  bouts: number;
  difficulty: string;
  outcomes: { ko: number; tko: number; decision: number; draw: number };
  meanRounds: number;
  meanTicks: number;
  meanLandPercent: number;
  archetypes: ArchetypeStats[];
  matchup: Record<string, Record<string, { w: number; l: number; d: number }>>;
  failures: string[];
  hashes: string[];
}

function emptyMix(): Record<PunchId, number> {
  return { jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_upper: 0, rear_upper: 0 };
}

export function runSoak(args: Args): SoakReport {
  const difficulty = DIFFICULTIES[args.difficulty];
  const report: SoakReport = {
    bouts: 0,
    difficulty: difficulty.id,
    outcomes: { ko: 0, tko: 0, decision: 0, draw: 0 },
    meanRounds: 0,
    meanTicks: 0,
    meanLandPercent: 0,
    archetypes: [],
    matchup: {},
    failures: [],
    hashes: [],
  };

  const byArch = new Map<ArchetypeId, ArchetypeStats>();
  const stat = (a: ArchetypeId): ArchetypeStats => {
    let s = byArch.get(a);
    if (!s) {
      s = {
        archetype: a,
        bouts: 0,
        wins: 0,
        kos: 0,
        thrown: 0,
        landed: 0,
        headLanded: 0,
        bodyLanded: 0,
        knockdownsFor: 0,
        knockdownsAgainst: 0,
        punchMix: emptyMix(),
      };
      byArch.set(a, s);
    }
    return s;
  };

  let totalRounds = 0;
  let totalTicks = 0;
  let landSum = 0;
  let landCount = 0;

  // Round-robin over every ordered pair, so win rates measure the matchup and
  // not an accident of scheduling. Each cycle also rotates corners, which is
  // how a corner-side bias would show up.
  const field = args.mirror ? MIRROR_ROSTER : ROSTER;
  const pairs: [number, number][] = [];
  for (let x = 0; x < field.length; x++) {
    for (let y = 0; y < field.length; y++) {
      if (x !== y) pairs.push([x, y]);
    }
  }

  for (let i = 0; i < args.bouts; i++) {
    const [ax, bx] = pairs[i % pairs.length];
    const a = field[ax];
    const b = field[bx];

    const rounds = ([3, 6, 10] as const)[i % 3];
    const config = {
      seed: args.seed + i,
      ruleset: makeRuleset(rounds, 'broadcast'),
      venueId: VENUES[i % VENUES.length].id,
      fighters: [a, b] as [typeof a, typeof b],
    };

    let result;
    try {
      result = simulateAiBout(config, { difficulty, collectEvents: true });
    } catch (err) {
      report.failures.push(`seed ${config.seed} ${a.id} vs ${b.id}: ${(err as Error).message}`);
      continue;
    }

    // --- Validity checks -------------------------------------------------
    const o = result.outcome;
    if (o.round < 1 || o.round > rounds) {
      report.failures.push(`seed ${config.seed}: outcome round ${o.round} outside 1..${rounds}`);
    }
    if (o.kind === 'decision' && o.round !== rounds) {
      report.failures.push(`seed ${config.seed}: decision reached in round ${o.round} of ${rounds}`);
    }
    for (const s of result.stats) {
      if (!Number.isFinite(s.thrown) || !Number.isFinite(s.landed)) {
        report.failures.push(`seed ${config.seed}: non-finite punch stats`);
      }
      if (s.landed > s.thrown) {
        report.failures.push(`seed ${config.seed}: landed ${s.landed} exceeds thrown ${s.thrown}`);
      }
    }
    for (const card of o.scorecards) {
      const rounds0 = card.rounds.reduce((t, r) => t + r[0], 0);
      const rounds1 = card.rounds.reduce((t, r) => t + r[1], 0);
      if (rounds0 !== card.totals[0] || rounds1 !== card.totals[1]) {
        report.failures.push(`seed ${config.seed}: scorecard totals do not reconcile with round scores`);
      }
    }
    if (o.kind === 'decision' && o.winner === null) {
      report.failures.push(`seed ${config.seed}: decision with no winner but kind is not draw`);
    }

    report.bouts++;
    totalRounds += o.round;
    totalTicks += result.ticks;
    report.outcomes[o.kind === 'technical_draw' ? 'draw' : o.kind]++;
    if (i < 12) report.hashes.push(`${config.seed}:${a.id}:${b.id}:${result.finalHash}`);

    const punchCounts: [Record<PunchId, number>, Record<PunchId, number>] = [emptyMix(), emptyMix()];
    for (const ev of result.events) {
      if (ev.type === 'punch_thrown') punchCounts[ev.corner][ev.punch]++;
    }

    for (const side of [0, 1] as const) {
      const def = config.fighters[side];
      const s = stat(def.style.archetype);
      s.bouts++;
      if (o.winner === side) {
        s.wins++;
        if (o.kind === 'ko' || o.kind === 'tko') s.kos++;
      }
      s.thrown += result.stats[side].thrown;
      s.landed += result.stats[side].landed;
      s.headLanded += result.stats[side].head;
      s.bodyLanded += result.stats[side].body;
      s.knockdownsFor += result.knockdowns[side === 0 ? 1 : 0];
      s.knockdownsAgainst += result.knockdowns[side];
      for (const p of Object.keys(s.punchMix) as PunchId[]) s.punchMix[p] += punchCounts[side][p];
      if (result.stats[side].thrown > 12) {
        landSum += result.stats[side].percent;
        landCount++;
      }
    }

    const ka = a.style.archetype;
    const kb = b.style.archetype;
    report.matchup[ka] ??= {};
    report.matchup[ka][kb] ??= { w: 0, l: 0, d: 0 };
    if (o.winner === 0) report.matchup[ka][kb].w++;
    else if (o.winner === 1) report.matchup[ka][kb].l++;
    else report.matchup[ka][kb].d++;
  }

  report.meanRounds = report.bouts ? Math.round((totalRounds / report.bouts) * 100) / 100 : 0;
  report.meanTicks = report.bouts ? Math.round(totalTicks / report.bouts) : 0;
  report.meanLandPercent = landCount ? Math.round((landSum / landCount) * 10) / 10 : 0;
  report.archetypes = [...byArch.values()].sort((x, y) => x.archetype.localeCompare(y.archetype));
  return report;
}

function pct(n: number, d: number): string {
  return d === 0 ? '  -  ' : `${((n / d) * 100).toFixed(1)}%`.padStart(6);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const r = runSoak(args);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nAI SOAK — ${r.bouts} bouts at difficulty "${r.difficulty}"${args.mirror ? " [MIRROR: identical ratings, archetype only]" : ""} (${elapsed}s)\n`);
  console.log(`  outcomes      KO ${r.outcomes.ko}  TKO ${r.outcomes.tko}  decision ${r.outcomes.decision}  draw ${r.outcomes.draw}`);
  console.log(`  mean rounds   ${r.meanRounds}`);
  console.log(`  mean length   ${(r.meanTicks / 3600).toFixed(1)} min of simulated time`);
  console.log(`  mean accuracy ${r.meanLandPercent}%\n`);

  console.log('  archetype           win%   KO%   thrown  land%  head/body   KD+  KD-');
  for (const s of r.archetypes) {
    const hb = s.landed > 0 ? `${Math.round((s.headLanded / s.landed) * 100)}/${Math.round((s.bodyLanded / s.landed) * 100)}` : '-';
    console.log(
      `  ${s.archetype.padEnd(18)}${pct(s.wins, s.bouts)} ${pct(s.kos, Math.max(1, s.wins))}  ` +
        `${String(Math.round(s.thrown / Math.max(1, s.bouts))).padStart(6)} ${pct(s.landed, s.thrown)}  ` +
        `${hb.padStart(8)}  ${String(s.knockdownsFor).padStart(3)}  ${String(s.knockdownsAgainst).padStart(3)}`,
    );
  }

  console.log('\n  archetype matchup matrix (row wins vs column, as row corner)');
  const keys = Object.keys(r.matchup).sort();
  const colw = 15;
  console.log('  ' + ''.padEnd(colw) + keys.map((k) => k.slice(0, 8).padStart(10)).join(''));
  for (const rk of keys) {
    const cells = keys.map((ck) => {
      const c = r.matchup[rk]?.[ck];
      if (!c) return '-'.padStart(10);
      const t = c.w + c.l + c.d;
      return (t === 0 ? '-' : `${Math.round((c.w / t) * 100)}%(${t})`).padStart(10);
    });
    console.log('  ' + rk.padEnd(colw) + cells.join(''));
  }

  console.log('\n  punch mix (share of punches thrown, per archetype)');
  for (const s of r.archetypes) {
    const total = Object.values(s.punchMix).reduce((a, b) => a + b, 0);
    const parts = (Object.keys(s.punchMix) as PunchId[])
      .map((p) => `${p}:${total ? Math.round((s.punchMix[p] / total) * 100) : 0}%`)
      .join('  ');
    console.log(`  ${s.archetype.padEnd(18)}${parts}`);
  }

  if (r.failures.length > 0) {
    console.error(`\n  FAILURES (${r.failures.length}):`);
    for (const f of r.failures.slice(0, 25)) console.error(`    - ${f}`);
  } else {
    console.log('\n  no deadlocks, NaN, invalid transitions or impossible results.');
  }

  if (args.json) {
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, JSON.stringify(r, null, 2));
    console.log(`\n  wrote ${args.json}`);
  }

  let certified = true;
  if (args.certify) {
    const misses = certify(r);
    console.log(`\n  CERTIFICATION against docs/PRODUCT_CANON.md, ${r.bouts} control bouts`);
    if (misses.length === 0) {
      console.log('  every documented balance target met.');
    } else {
      certified = false;
      console.error(`  ${misses.length} target(s) missed:`);
      for (const m of misses) console.error(`    - ${m}`);
    }
  }

  process.exit(r.failures.length > 0 || !certified ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('soak')) main();
