/**
 * The public view of the bout.
 *
 * This is the *only* thing the AI is allowed to see. It is built by projecting
 * the authoritative state through a deliberately lossy filter that drops
 * everything a player could not perceive:
 *
 *   - the opponent's buffered input,
 *   - whether a punch has already resolved internally,
 *   - the simulation's random stream,
 *   - anything about future ticks.
 *
 * Because `AiController.decide` accepts only this type, "the AI cannot read
 * future inputs" is enforced by the type system rather than by good intentions,
 * and `tests/ai/fairness.test.ts` asserts it.
 */
import type { ActionState, BoutState, PunchId, TargetLevel } from './types';

export interface PublicFighterView {
  corner: 0 | 1;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  state: ActionState;
  stateTicks: number;
  /** Visible because the punch is already in motion on screen. */
  activePunch: PunchId | null;
  activeLevel: TargetLevel;
  /** Condition as fractions, matching exactly what the HUD bars show. */
  composureFrac: number;
  resilienceFrac: number;
  headTrauma: number;
  bodyTrauma: number;
  exertion: number;
  guardIntegrity: number;
  balance: number;
  knockdownsThisRound: number;
  punchesThrown: number;
  punchesLanded: number;
}

export interface PublicBoutView {
  round: number;
  roundTick: number;
  roundTicks: number;
  totalRounds: number;
  phase: BoutState['phase'];
  self: PublicFighterView;
  opponent: PublicFighterView;
  /** Round scores completed so far, as the corner would know them. */
  roundsWonSelf: number;
  roundsWonOpponent: number;
}

function project(s: BoutState, corner: 0 | 1): PublicFighterView {
  const f = s.fighters[corner];
  const max = Math.max(1, f.resilienceMax);
  return {
    corner,
    x: f.x,
    z: f.z,
    vx: f.vx,
    vz: f.vz,
    facing: f.facing,
    state: f.state,
    stateTicks: f.stateTicks,
    activePunch: f.activePunch,
    activeLevel: f.activeLevel,
    composureFrac: f.composure / max,
    resilienceFrac: f.resilience / max,
    headTrauma: f.headTrauma,
    bodyTrauma: f.bodyTrauma,
    exertion: f.exertion,
    guardIntegrity: f.guardIntegrity,
    balance: f.balance,
    knockdownsThisRound: f.knockdownsThisRound,
    punchesThrown: f.punchesThrown,
    punchesLanded: f.punchesLanded,
  };
}

/**
 * A punch that has not yet started is invisible: `activePunch` is only
 * populated once the fighter is visibly in a punch state. This mirrors what a
 * human opponent can see on screen.
 */
export function publicView(s: BoutState, corner: 0 | 1, totalRounds: number, roundTicks: number): PublicBoutView {
  const other: 0 | 1 = corner === 0 ? 1 : 0;
  let won = 0;
  let lost = 0;
  for (const r of s.scores) {
    const a = r.clean[corner] + r.knockdowns[corner] * 8;
    const b = r.clean[other] + r.knockdowns[other] * 8;
    if (a > b) won++;
    else if (b > a) lost++;
  }
  const self = project(s, corner);
  const opponent = project(s, other);
  // Sanity: a fighter who is not visibly punching exposes no punch at all.
  if (opponent.state !== 'punch_startup' && opponent.state !== 'punch_active' && opponent.state !== 'punch_recover') {
    opponent.activePunch = null;
  }
  if (self.state !== 'punch_startup' && self.state !== 'punch_active' && self.state !== 'punch_recover') {
    self.activePunch = null;
  }
  return {
    round: s.round,
    roundTick: s.roundTick,
    roundTicks,
    totalRounds,
    phase: s.phase,
    self,
    opponent,
    roundsWonSelf: won,
    roundsWonOpponent: lost,
  };
}
