/**
 * Turns a `FighterDefinition` (the authored, player-facing data) into the
 * derived scalars the simulation actually runs on, and builds the initial
 * per-bout runtime state.
 *
 * Keeping this conversion in one place means ratings can be re-tuned without
 * hunting for magic numbers scattered through the bout loop.
 */
import { clamp, clamp01, remap } from './fixed';
import type { FighterDefinition, FighterState, Ruleset } from './types';
import { RING } from './types';

/** Maps a 1..100 rating onto roughly -1..+1, with 50 as the neutral centre. */
function n(rating: number): number {
  return (clamp(rating, 1, 100) - 50) / 50;
}

export interface DerivedStats {
  /** Multiplies every punch's reach. */
  reachScale: number;
  /** Multiplies punch startup ticks. Below 1 is faster. */
  startupScale: number;
  /** Multiplies punch recovery ticks. */
  recoveryScale: number;
  /** Peak locomotion speed, ring units per tick. */
  moveSpeed: number;
  /** Locomotion acceleration, ring units per tick squared. */
  accel: number;
  /** Multiplies all outgoing damage. */
  powerScale: number;
  /** Fraction of a correctly-guarded punch that the guard eats, at full guard. */
  guardAbsorb: number;
  /** Guard integrity regained per tick while guarding. */
  guardRegen: number;
  /** Divides incoming composure damage — a good chin. */
  chinResist: number;
  /** Divides incoming head trauma. */
  headResist: number;
  /** Divides incoming body trauma. */
  bodyResist: number;
  /** Composure regained per tick when not being hit. */
  composureRegen: number;
  /** Long-term punch-absorption budget. */
  resilienceMax: number;
  /** Fraction of lost resilience recovered during a round break. */
  breakRecovery: number;
  /** Multiplies exertion gained from throwing and moving. */
  exertionRate: number;
  /** Exertion shed per tick while not exerting. */
  exertionRecovery: number;
  /** Rise progress per successful recovery input while grounded. */
  riseRate: number;
  /** Rise progress accrued passively per tick — the accessibility floor. */
  risePassive: number;
  /** Ticks a slip stays evasive. */
  slipTicks: number;
  /** Balance restored per tick. */
  balanceRegen: number;
}

export function deriveStats(def: FighterDefinition): DerivedStats {
  const { power, stamina, speed, defense } = def.ratings;
  const s = def.secondary;

  // Reach comes from the body, not from a rating, so a tall fighter's
  // advantage is visible in the silhouette rather than hidden in a number.
  const reachScale = clamp(def.body.reachCm / 193, 0.9, 1.12);

  // Mass makes a fighter slower to start and stop but harder to move.
  const massFactor = remap(def.body.massKg, 84, 118, 1.08, 0.9);

  return {
    reachScale,
    startupScale: clamp(1 - n(speed) * 0.22, 0.72, 1.3),
    recoveryScale: clamp(1 - n(speed) * 0.18, 0.78, 1.26),
    moveSpeed: clamp(0.62 + n(s.footwork) * 0.20 + n(speed) * 0.08, 0.40, 0.95) * massFactor,
    accel: clamp(0.085 + n(s.footwork) * 0.030, 0.045, 0.13) * massFactor,
    powerScale: clamp(0.7 + n(power) * 0.42, 0.5, 1.34),
    guardAbsorb: clamp(0.58 + n(defense) * 0.22, 0.4, 0.86),
    guardRegen: clamp(0.0042 + n(defense) * 0.0018, 0.002, 0.008),
    chinResist: clamp(1 + n(s.chin) * 0.34, 0.7, 1.4),
    headResist: clamp(1 + n(s.chin) * 0.28, 0.72, 1.36),
    bodyResist: clamp(1 + n(s.bodyToughness) * 0.32, 0.7, 1.38),
    composureRegen: clamp(0.0175 + n(s.recovery) * 0.0080 + n(stamina) * 0.0035, 0.008, 0.032),
    resilienceMax: clamp(96 + n(stamina) * 28 + n(s.chin) * 12, 62, 142),
    breakRecovery: clamp(0.15 + n(s.recovery) * 0.11 + n(stamina) * 0.05, 0.07, 0.32),
    exertionRate: clamp(1 - n(stamina) * 0.34, 0.6, 1.42),
    exertionRecovery: clamp(0.00022 + n(stamina) * 0.00011 + n(s.recovery) * 0.00005, 0.00010, 0.00042),
    riseRate: clamp(0.033 + n(s.recovery) * 0.011, 0.020, 0.048),
    risePassive: clamp(0.0024 + n(s.recovery) * 0.0009, 0.0013, 0.0038),
    slipTicks: Math.round(clamp(7 + n(defense) * 3 + n(speed) * 2, 5, 13)),
    balanceRegen: clamp(0.0058 + n(s.composure) * 0.0028, 0.003, 0.010),
  };
}

/** Starting ring positions: fighters face each other across the centre. */
export function createFighterState(
  def: FighterDefinition,
  derived: DerivedStats,
  corner: 0 | 1,
  _ruleset: Ruleset,
): FighterState {
  const startX = corner === 0 ? -46 : 46;
  return {
    id: def.id,
    corner,
    x: startX,
    z: 0,
    vx: 0,
    vz: 0,
    facing: corner === 0 ? 1 : -1,

    state: 'intro',
    stateTicks: 0,
    activePunch: null,
    activeLevel: 'head',
    punchResolved: false,
    commitTicks: 0,

    composure: derived.resilienceMax,
    resilience: derived.resilienceMax,
    resilienceMax: derived.resilienceMax,
    headTrauma: 0,
    bodyTrauma: 0,
    exertion: 0,
    guardIntegrity: 1,
    balance: 1,

    knockdownsThisRound: 0,
    knockdownsTotal: 0,
    countReached: 0,
    riseProgress: 0,
    riseDifficulty: 1,
    riseTapCooldown: 0,
    punchesThrown: 0,
    punchesLanded: 0,
    punchesBlocked: 0,
    bodyLanded: 0,
    headLanded: 0,
    ropeTicks: 0,
    chainHits: 0,
    idleTicks: 0,
    clinchTicks: 0,
    bufferedPunch: null,
    bufferedLevel: 'head',
    bufferedAge: 0,
  };
}

/**
 * How hurt a fighter is, 0 (fresh) to 1 (about to go). Presentation uses this
 * for condition bars; the AI uses it for planning. It is derived, never stored,
 * so it can never disagree with the authoritative state.
 */
export function distressLevel(f: FighterState): number {
  const composureLoss = 1 - clamp01(f.composure / Math.max(1, f.resilienceMax));
  const resilienceLoss = 1 - clamp01(f.resilience / Math.max(1, f.resilienceMax));
  const trauma = Math.max(f.headTrauma, f.bodyTrauma);
  return clamp01(composureLoss * 0.5 + resilienceLoss * 0.28 + trauma * 0.22);
}

/** True when the fighter is one clean shot from going down. */
export function isHurt(f: FighterState): boolean {
  return f.composure < f.resilienceMax * 0.3 || f.balance < 0.4;
}

/** True when the fighter's back is against the ropes. */
export function onRopes(f: FighterState): boolean {
  return (
    Math.abs(f.x) > RING.halfWidth - RING.ropeMargin ||
    Math.abs(f.z) > RING.halfDepth - RING.ropeMargin
  );
}

/** Effective speed penalty from exertion. Never fully disables the fighter. */
export function exertionPenalty(f: FighterState): number {
  // At maximum exertion a fighter still retains 62% of their output. Being
  // tired must be a real cost without turning one bad round into a coma.
  return 1 - clamp01(f.exertion) * 0.38;
}
