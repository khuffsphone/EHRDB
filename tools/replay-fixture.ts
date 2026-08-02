/**
 * The golden replay fixture.
 *
 * A regression tripwire with teeth. The earlier "golden hash" test built the
 * same bout twice and compared it to itself, which proves only that the
 * simulation is not randomly non-deterministic within one process — it would
 * have passed unchanged through every balance edit ever made to this codebase.
 *
 * This module instead records a fixed input stream and pins the resulting
 * hashes to a committed file, in the format the unified playbook specifies:
 * `formatVersion`, build identity, `contentHashes`, `seedSet`, `tickRate`, the
 * normalised `commands` themselves, `checkpoints` and the expected `outcome`.
 *
 * The commands are stored, not regenerated. That distinction is the whole
 * point of a fixture: a file that says "run generator vN" is coupled to the
 * generator, and editing the generator would silently change what is being
 * tested while the fixture still appeared to pass. What is committed here is
 * the exact input stream that produced the exact hashes beside it.
 *
 * Regeneration is deliberate, because balance changes are legitimate:
 *
 *     npm run fixture:replay          # rewrite tests/fixtures/replay.json
 *
 * The result is a reviewable diff. The numbers move only when someone decides
 * they should, and the PR is expected to say why.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { BoutSim } from '../src/sim/bout';
import { simulateAiBout } from '../src/sim/runner';
import { encodeCommands, decodeCommands, digest, COMMAND_CODEC_VERSION } from '../src/sim/codec';
import { contentHashes, type ContentHashes } from '../src/data/content-hash';
import { makeRuleset } from '../src/data/rulesets';
import { getFighter } from '../src/data/fighters';
import { DIFFICULTIES } from '../src/ai/profiles';
import { emptyCommand, TICK_RATE, type BoutConfig, type FighterCommand } from '../src/sim/types';

export const FIXTURE_PATH = 'tests/fixtures/replay.json';

/** Replay format version. Bump when the file's shape changes. */
export const REPLAY_FORMAT_VERSION = 1;

/**
 * Long enough to cross a round boundary: a 90-second broadcast round is 5400
 * ticks, so this runs round one to the bell, through the break, and well into
 * round two. That puts round scoring, the break phase and the round-start
 * reset inside the pinned range rather than only moment-to-moment combat.
 */
const SCRIPT_TICKS = 7200;
const CHECKPOINT_EVERY = 600;

export interface ReplayConfigRef {
  rounds: number;
  pace: string;
  venueId: string;
  fighters: [string, string];
}

export interface ScriptedReplay {
  seedSet: { simulation: number };
  config: ReplayConfigRef;
  tickCount: number;
  /** Normalised commands for both corners per tick, hex-packed. */
  commands: string;
  commandsHash: string;
  checkpoints: { tick: number; hash: string }[];
  finalHash: string;
  outcome: ReplayOutcome | null;
}

export interface ReplayOutcome {
  kind: string;
  winner: number | null;
  round: number;
}

export interface AiReplay {
  seedSet: { simulation: number; ai0: string; ai1: string };
  config: ReplayConfigRef;
  difficulty: string;
  ticks: number;
  finalHash: string;
  outcome: ReplayOutcome;
  knockdowns: [number, number];
  stats: { thrown: number; landed: number; head: number; body: number }[];
}

export interface ReplayFixture {
  formatVersion: number;
  commandCodecVersion: number;
  tickRate: number;
  note: string;
  /** Identity of the source that recorded this fixture. Informational. */
  recordedAt: { commit: string };
  contentHashes: ContentHashes;
  scripted: ScriptedReplay;
  aiBouts: AiReplay[];
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
 * The input script.
 *
 * Used only to *record* the fixture. Verification replays the committed
 * `commands` string, so this function's output is not part of the contract and
 * changing it does not silently change what the tests check — it changes what
 * the next regeneration records, which is a diff.
 *
 * Two properties matter and were arrived at by measurement, not taste:
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

/**
 * Replays a stored command stream and collects the hashes a fixture pins.
 *
 * Shared by the recorder and the test, so the two cannot drift: whatever the
 * test does to verify is exactly what the recorder did to produce.
 */
export function runScripted(commands: readonly (readonly [FighterCommand, FighterCommand])[]): {
  checkpoints: { tick: number; hash: string }[];
  finalHash: string;
  outcome: ReplayOutcome | null;
  ticksRun: number;
} {
  const sim = new BoutSim(scriptedConfig());
  const checkpoints: { tick: number; hash: string }[] = [];
  let ticksRun = 0;

  for (let i = 0; i < commands.length; i++) {
    if (sim.isComplete) break;
    sim.tick(commands[i] as [FighterCommand, FighterCommand]);
    ticksRun++;
    if (ticksRun % CHECKPOINT_EVERY === 0) checkpoints.push({ tick: ticksRun, hash: sim.hashState() });
  }

  const o = sim.state.outcome;
  return {
    checkpoints,
    finalHash: sim.hashState(),
    outcome: o === null ? null : { kind: o.kind, winner: o.winner ?? null, round: o.round },
    ticksRun,
  };
}

function recordScripted(): ScriptedReplay {
  const stream = scriptedCommands();
  const commands = encodeCommands(stream);
  // Round-trip before committing: a fixture whose stored commands do not decode
  // to what was simulated is worse than no fixture.
  const decoded = decodeCommands(commands);
  if (JSON.stringify(decoded) !== JSON.stringify(stream)) {
    throw new Error('command codec round-trip failed; refusing to write a fixture');
  }

  const result = runScripted(decoded);
  return {
    seedSet: { simulation: SCRIPTED_SEED },
    config: { rounds: 3, pace: 'broadcast', venueId: 'ironworks', fighters: SCRIPTED_FIGHTERS },
    tickCount: stream.length,
    commands,
    commandsHash: digest(commands),
    checkpoints: result.checkpoints,
    finalHash: result.finalHash,
    outcome: result.outcome,
  };
}

const AI_CASES: { seed: number; rounds: 3 | 6 | 10; fighters: [string, string]; difficulty: 'contender' | 'title' }[] = [
  { seed: 777, rounds: 6, fighters: ['nikolai_vasque', 'bram_holt'], difficulty: 'title' },
  { seed: 4242, rounds: 3, fighters: ['silas_orrin', 'nikolai_vasque'], difficulty: 'contender' },
];

/** Pins whole AI-driven bouts: the simulation and the AI together. */
export function runAiCases(): AiReplay[] {
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
      // The AI forks its own streams from the bout seed; recorded explicitly so
      // the fixture documents every stream that fed the result.
      seedSet: { simulation: c.seed, ai0: `${c.seed}:ai0`, ai1: `${c.seed}:ai1` },
      config: { rounds: c.rounds, pace: 'broadcast', venueId: 'ironworks', fighters: c.fighters },
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
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    /* not a checkout; the fixture is still valid, it just cannot say where it came from */
  }

  return {
    formatVersion: REPLAY_FORMAT_VERSION,
    commandCodecVersion: COMMAND_CODEC_VERSION,
    tickRate: TICK_RATE,
    note:
      'Golden replay fixture. These values are pinned, not recomputed. If a test fails ' +
      'against them the simulation or its data changed — regenerate with ' +
      '`npm run fixture:replay` only when that change was intended, and review the diff. ' +
      'contentHashes distinguish a data edit from a combat-model edit.',
    recordedAt: { commit },
    contentHashes: contentHashes(),
    scripted: recordScripted(),
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
  console.log(`  format v${fixture.formatVersion}, codec v${fixture.commandCodecVersion}, ${fixture.tickRate} Hz`);
  console.log(`  content    punches ${fixture.contentHashes.punches}  ai ${fixture.contentHashes.aiProfiles}`);
  console.log(
    `  scripted   ${fixture.scripted.tickCount} ticks, ${fixture.scripted.checkpoints.length} checkpoints, ` +
      `final ${fixture.scripted.finalHash}`,
  );
  for (const b of fixture.aiBouts) {
    console.log(`  ai seed ${b.seedSet.simulation}  ${b.outcome.kind} r${b.outcome.round}  final ${b.finalHash}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('replay-fixture.ts')) main();
