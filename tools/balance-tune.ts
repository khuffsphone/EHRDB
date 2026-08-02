/**
 * Archetype balance search.
 *
 * Hand-tuning five archetypes toward a 40–60% band does not converge, because
 * the win rates are not independent: nerfing the brawler redistributes its
 * losses across the other four, so every fix moves four other numbers. Doing
 * that by eye burns a 90-second measurement per guess and overfits to whatever
 * seed happened to be running.
 *
 * This is a paired coordinate descent instead. Each candidate is evaluated on
 * the *same* seeds as its baseline, so sampling noise is common-mode and
 * cancels in the comparison — which is what makes a 300-bout evaluation useful
 * for ranking two candidates even though it is far too small to certify either
 * one. The winner is then confirmed on held-out seeds at the certification
 * sample, because a search that reports its own training score is not evidence.
 *
 *   npm run balance:tune -- --passes 3 --bouts 300
 *
 * It prints a patch rather than writing one. Balance is a design decision, and
 * a tool that silently edits the design is a tool nobody can review.
 */
import { AI_PROFILES, type AiProfile } from '../src/ai/profiles';
import { MIRROR_ARCHETYPES } from '../src/data/mirror';
import { runSoak } from './soak';
import { BALANCE_TARGETS } from './balance-targets';
import type { ArchetypeId, PunchId } from '../src/sim/types';

interface Args {
  passes: number;
  bouts: number;
  seeds: number[];
  confirmBouts: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { passes: 3, bouts: 300, seeds: [70_001, 70_507], confirmBouts: BALANCE_TARGETS.certifySize };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--passes') out.passes = Number(argv[++i]);
    else if (argv[i] === '--bouts') out.bouts = Number(argv[++i]);
    else if (argv[i] === '--confirm') out.confirmBouts = Number(argv[++i]);
    else if (argv[i] === '--seeds') out.seeds = argv[++i].split(',').map(Number);
  }
  return out;
}

/**
 * The knobs the search is allowed to turn, and by how much.
 *
 * Deliberately not every field. `targetRange` and the punch weights carry the
 * archetype's identity — an out-boxer that stops jabbing from range is not a
 * balanced out-boxer, it is a different archetype wearing the name. The search
 * adjusts how hard each archetype commits and how well it protects itself, and
 * scales its power punches as a group; it does not redesign anyone.
 */
type Knob = { key: string; apply: (p: AiProfile, delta: number) => void; step: number; min?: number; max?: number };

function scalar(key: keyof AiProfile & string, step: number, min: number, max: number): Knob {
  return {
    key,
    step,
    apply: (p, delta) => {
      const current = p[key] as unknown as number;
      (p as unknown as Record<string, number>)[key] = clamp(current + delta, min, max);
    },
  };
}

const POWER_PUNCHES: PunchId[] = ['rear_hook', 'rear_upper', 'lead_hook', 'lead_upper'];

const KNOBS: Knob[] = [
  scalar('aggression', 0.05, 0.2, 0.95),
  scalar('riskTolerance', 0.06, 0.1, 0.9),
  scalar('guardDiscipline', 0.05, 0.15, 0.9),
  scalar('counterAppetite', 0.06, 0.1, 0.98),
  {
    key: 'powerMix',
    step: 0.07,
    apply: (p, delta) => {
      for (const id of POWER_PUNCHES) {
        p.punchWeights[id] = clamp(p.punchWeights[id] * (1 + delta), 0.05, 1.6);
      }
    },
  },
];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function snapshot(): Record<ArchetypeId, AiProfile> {
  const out = {} as Record<ArchetypeId, AiProfile>;
  for (const a of MIRROR_ARCHETYPES) {
    out[a] = { ...AI_PROFILES[a], punchWeights: { ...AI_PROFILES[a].punchWeights } };
  }
  return out;
}

function restore(saved: Record<ArchetypeId, AiProfile>): void {
  for (const a of MIRROR_ARCHETYPES) {
    Object.assign(AI_PROFILES[a], saved[a], { punchWeights: { ...saved[a].punchWeights } });
  }
}

/** Win rate per archetype, averaged over the paired seed set. */
function measure(bouts: number, seeds: number[]): Record<ArchetypeId, number> {
  const totals = {} as Record<ArchetypeId, { w: number; n: number }>;
  for (const a of MIRROR_ARCHETYPES) totals[a] = { w: 0, n: 0 };
  for (const seed of seeds) {
    const r = runSoak({ bouts, json: null, difficulty: 'contender', seed, mirror: true });
    for (const s of r.archetypes) {
      totals[s.archetype].w += s.wins;
      totals[s.archetype].n += s.bouts;
    }
  }
  const out = {} as Record<ArchetypeId, number>;
  for (const a of MIRROR_ARCHETYPES) out[a] = totals[a].w / Math.max(1, totals[a].n);
  return out;
}

/**
 * Cost: the worst archetype's distance from even.
 *
 * Squared deviation summed across archetypes would let the search trade a
 * catastrophic outlier for four slightly better mid-table results. The band is
 * a statement about the worst case, so the objective has to be too. The mean
 * term is a small tie-breaker between candidates with equal worst cases.
 */
function cost(rates: Record<ArchetypeId, number>): number {
  const devs = MIRROR_ARCHETYPES.map((a) => Math.abs(rates[a] - 0.5));
  const worst = Math.max(...devs);
  const mean = devs.reduce((x, y) => x + y, 0) / devs.length;
  return worst + 0.25 * mean;
}

function format(rates: Record<ArchetypeId, number>): string {
  return MIRROR_ARCHETYPES.map((a) => `${a.slice(0, 4)} ${(rates[a] * 100).toFixed(1)}%`).join('  ');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();

  console.log(`\nBALANCE SEARCH — ${args.passes} passes, ${args.bouts} bouts x ${args.seeds.length} paired seeds\n`);

  let best = measure(args.bouts, args.seeds);
  let bestCost = cost(best);
  console.log(`  baseline   cost ${bestCost.toFixed(4)}   ${format(best)}`);

  for (let pass = 1; pass <= args.passes; pass++) {
    let improvedThisPass = false;
    for (const archetype of MIRROR_ARCHETYPES) {
      for (const knob of KNOBS) {
        for (const direction of [1, -1]) {
          const saved = snapshot();
          knob.apply(AI_PROFILES[archetype], knob.step * direction);

          const rates = measure(args.bouts, args.seeds);
          const c = cost(rates);
          if (c < bestCost - 1e-6) {
            bestCost = c;
            best = rates;
            improvedThisPass = true;
            console.log(
              `  pass ${pass}  ${archetype}.${knob.key} ${direction > 0 ? '+' : '-'}${knob.step}` +
                `  cost ${c.toFixed(4)}   ${format(rates)}`,
            );
            break; // keep this change, move to the next knob
          }
          restore(saved);
        }
      }
    }
    if (!improvedThisPass) {
      console.log(`  pass ${pass}  no improvement — converged`);
      break;
    }
  }

  console.log(`\n  confirming on held-out seeds at ${args.confirmBouts} bouts …`);
  const confirmSeeds = [63_000, 88_000];
  const confirmed = measure(args.confirmBouts, confirmSeeds);
  const t = BALANCE_TARGETS.archetypeWinRate;
  let allInside = true;
  for (const a of MIRROR_ARCHETYPES) {
    const inside = confirmed[a] >= t.min && confirmed[a] <= t.max;
    if (!inside) allInside = false;
    console.log(`    ${a.padEnd(16)} ${(confirmed[a] * 100).toFixed(1)}%  ${inside ? 'in band' : 'OUTSIDE'}`);
  }

  console.log('\n  resulting profile values (apply by hand to src/ai/profiles.ts):');
  for (const a of MIRROR_ARCHETYPES) {
    const p = AI_PROFILES[a];
    console.log(
      `    ${a}: aggression ${p.aggression.toFixed(3)}  riskTolerance ${p.riskTolerance.toFixed(3)}  ` +
        `guardDiscipline ${p.guardDiscipline.toFixed(3)}  counterAppetite ${p.counterAppetite.toFixed(3)}`,
    );
    console.log(
      `      punchWeights: W(${(['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_upper', 'rear_upper'] as PunchId[])
        .map((id) => p.punchWeights[id].toFixed(3))
        .join(', ')})`,
    );
  }

  console.log(`\n  ${((Date.now() - started) / 1000).toFixed(0)}s elapsed`);
  console.log(allInside ? '  every archetype inside the documented band on held-out seeds.' : '  NOT all archetypes are inside the band.');
}

if (process.argv[1] && process.argv[1].includes('balance-tune')) main();
