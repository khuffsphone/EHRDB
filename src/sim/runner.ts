/**
 * Headless bout drivers.
 *
 * These are used by the tests, the AI soak harness, the career world
 * simulation and the developer fast-forward tool. The interactive game uses
 * `BoutSim` directly, feeding it commands from the input layer — but it is the
 * same simulation, stepped the same way, so anything proven here holds in the
 * played game too.
 */
import { AiController } from '@ai/controller';
import { DIFFICULTIES, type Difficulty } from '@ai/profiles';
import { BoutSim } from './bout';
import { emptyCommand, type BoutConfig, type BoutEvent, type BoutOutcome, type FighterCommand } from './types';
import { publicView } from './view';

export interface SimulatedBoutResult {
  outcome: BoutOutcome;
  /** Ticks the whole bout took, including intros and breaks. */
  ticks: number;
  stats: [
    { thrown: number; landed: number; percent: number; head: number; body: number },
    { thrown: number; landed: number; percent: number; head: number; body: number },
  ];
  knockdowns: [number, number];
  finalHash: string;
  events: BoutEvent[];
}

export interface AiVsAiOptions {
  difficulty?: Difficulty;
  /** Safety valve; a bout that exceeds this is a bug, not a long fight. */
  maxTicks?: number;
  /** Retain the full event list. Off by default to keep soak runs cheap. */
  collectEvents?: boolean;
}

/**
 * Runs a complete bout with both corners driven by AI. Deterministic: the same
 * config and options always produce the same result.
 */
export function simulateAiBout(config: BoutConfig, opts: AiVsAiOptions = {}): SimulatedBoutResult {
  const difficulty = opts.difficulty ?? DIFFICULTIES.contender;
  const maxTicks = opts.maxTicks ?? 60 * 60 * 45; // 45 minutes of simulation
  const sim = new BoutSim(config);

  const ai: [AiController, AiController] = [
    new AiController(0, config.fighters[0].style.archetype, difficulty, `${config.seed}:ai0`),
    new AiController(1, config.fighters[1].style.archetype, difficulty, `${config.seed}:ai1`),
  ];

  const events: BoutEvent[] = [];
  let ticks = 0;

  while (!sim.isComplete && ticks < maxTicks) {
    const v0 = publicView(sim.state, 0, config.ruleset.rounds, config.ruleset.roundTicks);
    const v1 = publicView(sim.state, 1, config.ruleset.rounds, config.ruleset.roundTicks);
    const cmds: [FighterCommand, FighterCommand] = [ai[0].decide(v0), ai[1].decide(v1)];
    const out = sim.tick(cmds);
    if (opts.collectEvents) events.push(...out);
    ticks++;
  }

  if (!sim.state.outcome) {
    throw new Error(`Bout failed to resolve within ${maxTicks} ticks (seed ${config.seed})`);
  }

  return {
    outcome: sim.state.outcome,
    ticks,
    stats: [sim.stats(0), sim.stats(1)],
    knockdowns: [sim.state.fighters[0].knockdownsTotal, sim.state.fighters[1].knockdownsTotal],
    finalHash: sim.hashState(),
    events,
  };
}

/**
 * Replays a recorded command stream. Used by the determinism tests: the same
 * seed and the same inputs must reproduce the same state hash on every tick.
 */
export function replayCommands(
  config: BoutConfig,
  commands: readonly [FighterCommand, FighterCommand][],
): { hashes: string[]; outcome: BoutOutcome | null } {
  const sim = new BoutSim(config);
  const hashes: string[] = [];
  for (const cmd of commands) {
    if (sim.isComplete) break;
    sim.tick(cmd);
    hashes.push(sim.hashState());
  }
  return { hashes, outcome: sim.state.outcome };
}

/** Records the command stream an AI-vs-AI bout produces, for replay tests. */
export function recordAiCommands(
  config: BoutConfig,
  difficulty: Difficulty = DIFFICULTIES.contender,
  maxTicks = 60 * 60 * 45,
): [FighterCommand, FighterCommand][] {
  const sim = new BoutSim(config);
  const ai: [AiController, AiController] = [
    new AiController(0, config.fighters[0].style.archetype, difficulty, `${config.seed}:ai0`),
    new AiController(1, config.fighters[1].style.archetype, difficulty, `${config.seed}:ai1`),
  ];
  const out: [FighterCommand, FighterCommand][] = [];
  let ticks = 0;
  while (!sim.isComplete && ticks < maxTicks) {
    const cmds: [FighterCommand, FighterCommand] = [
      ai[0].decide(publicView(sim.state, 0, config.ruleset.rounds, config.ruleset.roundTicks)),
      ai[1].decide(publicView(sim.state, 1, config.ruleset.rounds, config.ruleset.roundTicks)),
    ];
    out.push([{ ...cmds[0] }, { ...cmds[1] }]);
    sim.tick(cmds);
    ticks++;
  }
  return out;
}

/** A command stream of pure inactivity, for tests that need a still opponent. */
export function idleCommands(n: number): [FighterCommand, FighterCommand][] {
  return Array.from({ length: n }, () => [emptyCommand(), emptyCommand()] as [FighterCommand, FighterCommand]);
}
