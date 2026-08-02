/**
 * The golden replay fixture.
 *
 * A regression tripwire with teeth. The earlier "golden hash" test built the
 * same bout twice and compared it to itself, which proves only that the
 * simulation is not randomly non-deterministic within one process — it would
 * have passed unchanged through every balance edit ever made to this codebase.
 *
 * This module instead defines a fixed input script and pins the resulting
 * hashes to a committed file. A change to combat rules, ordering, or the RNG
 * draw sequence breaks the comparison against bytes that were reviewed in a
 * previous commit, which is what a golden fixture is for.
 *
 * The fixture is deliberately regenerable, because balance changes are
 * legitimate and frequent:
 *
 *     npm run fixture:replay          # rewrite tests/fixtures/replay.json
 *
 * Regenerating is a reviewable diff, not a silent pass. That is the whole
 * point: the numbers move only when someone decides they should.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BoutSim } from '../src/sim/bout';
import { simulateAiBout } from '../src/sim/runner';
import { makeRuleset } from '../src/data/rulesets';
import { getFighter } from '../src/data/fighters';
import { DIFFICULTIES } from '../src/ai/profiles';
import { emptyCommand, type BoutConfig, type FighterCommand } from '../src/sim/types';

export const FIXTURE_PATH = 'tests/fixtures/replay.json';

/** Bumped whenever the script recipe itself changes, so old fixtures fail loudly. */
export const SCRIPT_VERSION = 'scripted-v1';

/**
 * Long enough to cross a round boundary: a 90-second broadcast round is 5400
 * ticks, so this runs round one to the bell, through the break, and well into
 * round two. That puts round scoring, the break phase and the round-start
 * reset inside the pinned range rather than only the moment-to-moment combat.
 */
const SCRIPT_TICKS = 7200;
const CHECKPOINT_EVERY = 600;

export interface ReplayFixture {
  scriptVersion: string;
  note: string;
  scripted: {
    seed: number;
    rounds: number;
    venueId: string;
    fighters: [string, string];
    ticks: number;
    /** Hash of the whole simulation state at each checkpoint tick. */
    checkpoints: { tick: number; hash: string }[];
    finalHash: string;
  };
  aiBouts: {
    seed: number;
    rounds: number;
    venueId: string;
    fighters: [string, string];
    difficulty: string;
    ticks: number;
    finalHash: string;
    outcome: { kind: string; winner: number | null; round: number };
    knockdowns: [number, number];
    stats: { thrown: number; landed: number; head: number; body: number }[];
  }[];
}

const SCRIPTED_SEED = 31_337;
const SCRIPTED_FIGHTERS: [string, string] = ['nikolai_vasque', 'bram_holt'];

function scriptedConfig(): BoutConfig {
  return {
    seed: SCRIPTED_SEED,
    ruleset: makeRuleset(3, 'broadcast'),
    venueId: 'ironworks',
    fighters: [getFighter(SCRIPTED_FIGHTERS[0]), getFighter(SCRIPTED_FIGHTERS[1])],
  };
}

/**
 * The input script, `SCRIPT_VERSION`.
 *
 * Both corners are driven, so the fixture exercises exchanges rather than one
 * fighter hitting a statue. Two properties matter and were arrived at by
 * measurement, not taste:
 *
 *   - Both fighters press forward most of the time. An even split of advance
 *     and retreat drifts them past a jab's 54 units of reach and every punch
 *     misses, which pins a fixture full of nothing.
 *   - Neither commands depth. `moveZ` stays zero so the two stay in the same
 *     plane; a fixed script cannot steer toward a moving opponent, and an
 *     open-loop depth pattern simply separates them.
 *
 * The periods are mutually coprime on purpose: the corners fall in and out of
 * phase rather than trading in lockstep, which reaches guard breaks, counters,
 * clinches, body work and the input buffer.
 */
export function scriptedCommands(ticks = SCRIPT_TICKS): [FighterCommand, FighterCommand][] {
  const out: [FighterCommand, FighterCommand][] = [];
  for (let i = 0; i < ticks; i++) {
    const a = emptyCommand();
    a.moveX = i % 120 < 100 ? 1 : -1;
    if (i % 11 === 0) a.punch = 'jab';
    else if (i % 31 === 0) a.punch = 'cross';
    else if (i % 97 === 0) a.punch = 'lead_hook';
    else if (i % 149 === 0) a.punch = 'rear_upper';
    a.guard = i % 23 < 4;
    // Crouching is what converts a punch to the body, so this also drives the
    // head/body split without needing a separate level command.
    a.crouch = i % 53 < 6;
    if (i % 199 === 0) a.slip = 1;

    const b = emptyCommand();
    b.moveX = i % 96 < 78 ? 1 : -1;
    if (i % 13 === 0) b.punch = 'jab';
    else if (i % 37 === 0) b.punch = 'cross';
    else if (i % 71 === 0) b.punch = 'lead_hook';
    else if (i % 167 === 0) b.punch = 'lead_upper';
    b.guard = i % 19 < 4;
    b.crouch = i % 11 === 0;
    b.clinch = i % 211 < 3;
    if (i % 173 === 0) b.slip = -1;
    b.recover = i % 5 === 0;

    out.push([a, b]);
  }
  return out;
}

/** Runs the scripted stream and collects the hashes the fixture pins. */
export function runScripted(): ReplayFixture['scripted'] {
  const sim = new BoutSim(scriptedConfig());
  const checkpoints: { tick: number; hash: string }[] = [];
  const script = scriptedCommands();

  for (let i = 0; i < script.length; i++) {
    if (sim.isComplete) break;
    sim.tick(script[i]);
    const tick = i + 1;
    if (tick % CHECKPOINT_EVERY === 0) checkpoints.push({ tick, hash: sim.hashState() });
  }

  return {
    seed: SCRIPTED_SEED,
    rounds: 3,
    venueId: 'ironworks',
    fighters: SCRIPTED_FIGHTERS,
    ticks: script.length,
    checkpoints,
    finalHash: sim.hashState(),
  };
}

const AI_CASES: { seed: number; rounds: 3 | 6 | 10; fighters: [string, string]; difficulty: 'contender' | 'title' }[] = [
  { seed: 777, rounds: 6, fighters: ['nikolai_vasque', 'bram_holt'], difficulty: 'title' },
  { seed: 4242, rounds: 3, fighters: ['silas_orrin', 'nikolai_vasque'], difficulty: 'contender' },
];

/** Pins whole AI-driven bouts: the simulation and the AI together. */
export function runAiCases(): ReplayFixture['aiBouts'] {
  return AI_CASES.map((c) => {
    const result = simulateAiBout(
      {
        seed: c.seed,
        ruleset: makeRuleset(c.rounds, 'broadcast'),
        venueId: 'ironworks',
        fighters: [getFighter(c.fighters[0]), getFighter(c.fighters[1])],
      },
      { difficulty: DIFFICULTIES[c.difficulty] },
    );
    return {
      seed: c.seed,
      rounds: c.rounds,
      venueId: 'ironworks',
      fighters: c.fighters,
      difficulty: c.difficulty,
      ticks: result.ticks,
      finalHash: result.finalHash,
      outcome: {
        kind: result.outcome.kind,
        winner: result.outcome.winner ?? null,
        round: result.outcome.round,
      },
      knockdowns: result.knockdowns,
      stats: [result.stats[0], result.stats[1]].map((s) => ({
        thrown: s.thrown,
        landed: s.landed,
        head: s.head,
        body: s.body,
      })),
    };
  });
}

export function buildFixture(): ReplayFixture {
  return {
    scriptVersion: SCRIPT_VERSION,
    note:
      'Golden replay fixture. These values are pinned, not recomputed. If a test ' +
      'fails against them the simulation changed — regenerate with `npm run fixture:replay` ' +
      'only when that change was intended, and review the diff.',
    scripted: runScripted(),
    aiBouts: runAiCases(),
  };
}

export function readFixture(): ReplayFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ReplayFixture;
}

function main(): void {
  const fixture = buildFixture();
  mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`wrote ${FIXTURE_PATH}`);
  console.log(`  scripted   ${fixture.scripted.ticks} ticks, final ${fixture.scripted.finalHash}`);
  for (const b of fixture.aiBouts) {
    console.log(`  ai seed ${b.seed}  ${b.outcome.kind} r${b.outcome.round}  final ${b.finalHash}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('replay-fixture.ts')) main();
