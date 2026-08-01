/**
 * Developer career fast-forward.
 *
 * Plays complete careers headlessly — the player's bouts run through the real
 * combat simulation with an AI driving the player's corner — and reports the
 * progression health that the balance targets in docs/CAREER_SPEC.md call for:
 * how often careers reach the title, how often they end in a loss spiral,
 * whether earnings and rank curves are sane, and whether any career can dead-end.
 *
 *   npm run career:sim
 *   npm run career:sim -- --careers 40 --json artifacts/qa/career.json
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Rng } from '../src/sim/rng';
import { BoutSim } from '../src/sim/bout';
import { AiController } from '../src/ai/controller';
import { publicView } from '../src/sim/view';
import { DIFFICULTIES, type DifficultyId } from '../src/ai/profiles';
import {
  boutConfigFor,
  createCareer,
  describeBout,
  finishTraining,
  legalOpponents,
  refuseChallenge,
  acceptChallenge,
  resolveBout,
  takeTraining,
  CAREER_VERSION,
} from '../src/career/career';
import { buildFighter, defaultChoices, POINT_POOL } from '../src/career/creation';
import { CAREER_RULES, type CareerState } from '../src/career/types';
import type { ArchetypeId, FighterCommand } from '../src/sim/types';

interface Args {
  careers: number;
  json: string | null;
  difficulty: DifficultyId;
  seed: number;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { careers: 16, json: null, difficulty: 'contender', seed: 4000, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--careers') a.careers = Number(argv[++i]);
    else if (argv[i] === '--json') a.json = argv[++i];
    else if (argv[i] === '--difficulty') a.difficulty = argv[++i] as DifficultyId;
    else if (argv[i] === '--seed') a.seed = Number(argv[++i]);
    else if (argv[i] === '--verbose') a.verbose = true;
  }
  return a;
}

/** Spends the creation pool in a seeded, style-appropriate way. */
function makePlayer(rng: Rng, archetype: ArchetypeId) {
  const c = defaultChoices();
  c.archetype = archetype;
  c.name = `Test ${archetype}`;
  const keys = ['power', 'stamina', 'speed', 'defense'] as const;
  const alloc = { power: 0, stamina: 0, speed: 0, defense: 0 };
  for (let i = 0; i < POINT_POOL; i++) {
    const k = rng.pick(keys);
    if (alloc[k] < 32) alloc[k]++;
    else i--;
  }
  c.allocation = alloc;
  return buildFighter(c);
}

/** Runs one player bout through the real combat simulation. */
function playBout(state: CareerState, opponentId: string, difficulty: DifficultyId) {
  const cfg = boutConfigFor(state, opponentId);
  const sim = new BoutSim(cfg);
  const ai: [AiController, AiController] = [
    new AiController(0, cfg.fighters[0].style.archetype, DIFFICULTIES[difficulty], `${cfg.seed}:p`),
    new AiController(1, cfg.fighters[1].style.archetype, DIFFICULTIES[difficulty], `${cfg.seed}:o`),
  ];
  let ticks = 0;
  const cap = 60 * 60 * 45;
  while (!sim.isComplete && ticks < cap) {
    const cmds: [FighterCommand, FighterCommand] = [
      ai[0].decide(publicView(sim.state, 0, cfg.ruleset.rounds, cfg.ruleset.roundTicks)),
      ai[1].decide(publicView(sim.state, 1, cfg.ruleset.rounds, cfg.ruleset.roundTicks)),
    ];
    sim.tick(cmds);
    ticks++;
  }
  if (!sim.state.outcome) throw new Error(`career bout failed to resolve (seed ${cfg.seed})`);
  return sim.state.outcome;
}

export interface CareerReport {
  careers: number;
  reachedTitleShot: number;
  wonTitle: number;
  endings: Record<string, number>;
  grades: Record<string, number>;
  meanBouts: number;
  meanWins: number;
  meanEarnings: number;
  maxEarnings: number;
  meanPeakRank: number;
  failures: string[];
}

export function runCareers(args: Args): CareerReport {
  const report: CareerReport = {
    careers: 0,
    reachedTitleShot: 0,
    wonTitle: 0,
    endings: {},
    grades: {},
    meanBouts: 0,
    meanWins: 0,
    meanEarnings: 0,
    maxEarnings: 0,
    meanPeakRank: 0,
    failures: [],
  };

  const archetypes: ArchetypeId[] = ['out_boxer', 'pressure', 'counterpuncher', 'brawler', 'boxer_puncher'];
  let bouts = 0;
  let wins = 0;
  let earnings = 0;
  let peakSum = 0;

  for (let i = 0; i < args.careers; i++) {
    const rng = new Rng(args.seed + i);
    const player = makePlayer(rng, archetypes[i % archetypes.length]);
    const state = createCareer(args.seed + i, player, args.difficulty);

    if (state.version !== CAREER_VERSION) report.failures.push(`career ${i}: wrong version`);

    let guard = 0;
    let sawTitleShot = false;

    while (!state.ending && guard < CAREER_RULES.maxBouts * 4) {
      guard++;

      if (state.phase === 'challenge') {
        // Take the fight nine times in ten; refusing exercises the other path.
        if (rng.chance(0.9)) acceptChallenge(state);
        else refuseChallenge(state);
        continue;
      }

      if (state.phase === 'select_opponent') {
        const legal = state.offeredOpponents.length > 0 ? state.offeredOpponents : legalOpponents(state);
        if (legal.length === 0) {
          report.failures.push(`career ${i}: dead end at bout ${state.boutIndex} with no legal opponent`);
          break;
        }
        // Ambitious but not suicidal: prefer the best opponent available.
        const target = legal[0];
        const offer = describeBout(state, target);
        if (offer.titleBout) sawTitleShot = true;

        const outcome = playBout(state, target, args.difficulty);
        const before = state.boutIndex;
        resolveBout(state, target, outcome);
        if (state.boutIndex !== before + 1) {
          report.failures.push(`career ${i}: bout index did not advance`);
          break;
        }
        continue;
      }

      if (state.phase === 'training') {
        while (state.trainingPicks > 0 && state.trainingSlate.length > 0) {
          takeTraining(state, rng.pick(state.trainingSlate).id);
        }
        finishTraining(state);
        continue;
      }

      report.failures.push(`career ${i}: unexpected phase ${state.phase}`);
      break;
    }

    if (!state.ending) {
      report.failures.push(`career ${i}: never reached an ending (guard ${guard}, phase ${state.phase})`);
      continue;
    }

    // --- Validity ---------------------------------------------------------
    if (state.boutIndex > CAREER_RULES.maxBouts) {
      report.failures.push(`career ${i}: ${state.boutIndex} bouts exceeds the cap`);
    }
    if (state.wins + state.losses + state.draws !== state.boutIndex) {
      report.failures.push(`career ${i}: record does not reconcile with bouts fought`);
    }
    if (state.earnings < 0 || !Number.isFinite(state.earnings)) {
      report.failures.push(`career ${i}: invalid earnings ${state.earnings}`);
    }
    const ranks = state.ladder.filter((e) => !e.retired).map((e) => e.rank).concat(state.playerRank).sort((a, b) => a - b);
    for (let k = 0; k < ranks.length; k++) {
      if (ranks[k] !== k + 1) {
        report.failures.push(`career ${i}: ladder ranks are not a dense permutation (${ranks.join(',')})`);
        break;
      }
    }

    report.careers++;
    if (sawTitleShot) report.reachedTitleShot++;
    if (state.ending.wasChampion) report.wonTitle++;
    report.endings[state.ending.reasonKey] = (report.endings[state.ending.reasonKey] ?? 0) + 1;
    report.grades[state.ending.gradeKey] = (report.grades[state.ending.gradeKey] ?? 0) + 1;
    bouts += state.boutIndex;
    wins += state.wins;
    earnings += state.earnings;
    report.maxEarnings = Math.max(report.maxEarnings, state.earnings);
    const peak = state.history.reduce((b, h) => Math.min(b, h.playerRankAfter), 9);
    peakSum += peak;

    if (args.verbose) {
      console.log(
        `  career ${i} (${player.style.archetype}): ${state.wins}-${state.losses}-${state.draws} ` +
          `rank ${state.playerRank} peak ${peak} $${(state.earnings / 1000).toFixed(0)}k ` +
          `${state.ending.reasonKey} ${state.ending.gradeKey}`,
      );
    }
  }

  const n = Math.max(1, report.careers);
  report.meanBouts = Math.round((bouts / n) * 10) / 10;
  report.meanWins = Math.round((wins / n) * 10) / 10;
  report.meanEarnings = Math.round(earnings / n);
  report.meanPeakRank = Math.round((peakSum / n) * 10) / 10;
  return report;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const r = runCareers(args);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\nCAREER SIMULATION — ${r.careers} careers at "${args.difficulty}" (${elapsed}s)\n`);
  console.log(`  mean bouts fought   ${r.meanBouts} of ${CAREER_RULES.maxBouts}`);
  console.log(`  mean record         ${r.meanWins}W`);
  console.log(`  mean peak rank      ${r.meanPeakRank}`);
  console.log(`  mean earnings       $${(r.meanEarnings / 1000).toFixed(0)}k   (best $${(r.maxEarnings / 1_000_000).toFixed(2)}M, legacy target $${(CAREER_RULES.legacyTarget / 1_000_000).toFixed(1)}M)`);
  console.log(`  reached a title shot ${r.reachedTitleShot}/${r.careers}`);
  console.log(`  won the title        ${r.wonTitle}/${r.careers}`);
  console.log(`\n  endings: ${Object.entries(r.endings).map(([k, v]) => `${k.replace('ending.', '')}=${v}`).join('  ')}`);
  console.log(`  grades:  ${Object.entries(r.grades).map(([k, v]) => `${k.replace('grade.', '')}=${v}`).join('  ')}`);

  if (r.failures.length > 0) {
    console.error(`\n  FAILURES (${r.failures.length}):`);
    for (const f of r.failures.slice(0, 25)) console.error(`    - ${f}`);
  } else {
    console.log('\n  no dead ends, invalid records, or broken ladders.');
  }

  if (args.json) {
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, JSON.stringify(r, null, 2));
    console.log(`\n  wrote ${args.json}`);
  }
  process.exit(r.failures.length > 0 ? 1 : 0);
}

if (process.argv[1] && process.argv[1].includes('career-sim')) main();
