/**
 * Frozen data contracts for the deterministic simulation.
 *
 * Nothing in this file may reference the DOM, Phaser, wall-clock time, or
 * unseeded randomness. Presentation code consumes these types; it never
 * mutates simulation state.
 *
 * All timing is expressed in *ticks*. One tick is one simulation step at
 * `TICK_RATE` Hz. Milliseconds never appear in simulation rules.
 */

export const TICK_RATE = 60;

// ---------------------------------------------------------------------------
// Identity and taxonomy
// ---------------------------------------------------------------------------

export type Hand = 'lead' | 'rear';
export type PunchFamily = 'jab' | 'cross' | 'hook' | 'uppercut';
export type TargetLevel = 'head' | 'body';
export type Stance = 'orthodox' | 'southpaw';

/** The six punches, each of which has a head and a body variant. */
export type PunchId =
  | 'jab'
  | 'cross'
  | 'lead_hook'
  | 'rear_hook'
  | 'lead_upper'
  | 'rear_upper';

export const PUNCH_IDS: readonly PunchId[] = [
  'jab',
  'cross',
  'lead_hook',
  'rear_hook',
  'lead_upper',
  'rear_upper',
] as const;

/** A punch plus the level it was thrown at — the actual resolvable move. */
export type MoveKey = `${PunchId}_${TargetLevel}`;

export type ArchetypeId =
  | 'out_boxer'
  | 'pressure'
  | 'counterpuncher'
  | 'brawler'
  | 'boxer_puncher';

// ---------------------------------------------------------------------------
// Move definitions
// ---------------------------------------------------------------------------

/**
 * Every punch is fully data-driven. Timing is in ticks; distances are in ring
 * units (the ring interior is 320 x 176 units — see `RING`).
 */
export interface PunchDefinition {
  id: PunchId;
  /** Display name, resolved through the string table at presentation time. */
  nameKey: string;
  hand: Hand;
  family: PunchFamily;
  /** Ticks from input acknowledgement until the punch can connect. */
  startupTicks: number;
  /** Ticks during which contact is tested. */
  activeTicks: number;
  /** Ticks of commitment after the active window. */
  recoveryTicks: number;
  /** Extra recovery when the punch does not connect at all. */
  whiffExtraTicks: number;
  /** Maximum reach in ring units at a nominal 193 cm reach. */
  reach: number;
  /** Below this separation the punch smothers and cannot land cleanly. */
  minRange: number;
  /** Lateral tolerance in ring depth units. */
  depthTolerance: number;
  /** Fraction of walking speed retained while the punch runs. */
  movementAllowance: number;
  /** Damage to the opponent's immediate energy (knockdown pressure). */
  composureDamage: number;
  /** Damage to the opponent's long-term punch capacity. */
  resilienceDamage: number;
  /** Localised head or body wear, applied to whichever level was thrown. */
  traumaDamage: number;
  /** Damage dealt to a guard that absorbs it correctly. */
  guardDamage: number;
  /** Exertion spent by the attacker throwing it. */
  exertionCost: number;
  /** Base contribution to round scoring for a clean landing. */
  scoreValue: number;
  /** Multiplier applied when this punch lands inside a counter window. */
  counterBonus: number;
  /** Balance disruption inflicted — drives stagger and knockdown chance. */
  staggerPower: number;
  /**
   * Ticks after startup begins during which the *attacker* is counterable.
   * This is the explicit vulnerability window; counters are never an arbitrary
   * damage bonus.
   */
  vulnerableFrom: number;
  vulnerableTo: number;
}

// ---------------------------------------------------------------------------
// Fighter definitions
// ---------------------------------------------------------------------------

/** The four headline ratings the player sees. Range 1..100. */
export interface CoreRatings {
  power: number;
  stamina: number;
  speed: number;
  defense: number;
}

/** Derived detail ratings. Range 1..100. */
export interface SecondaryRatings {
  chin: number;
  bodyToughness: number;
  recovery: number;
  footwork: number;
  accuracy: number;
  composure: number;
}

export interface FighterBody {
  heightCm: number;
  reachCm: number;
  massKg: number;
}

export interface FighterStyle {
  archetype: ArchetypeId;
  /** 0 = patient, 1 = relentless. */
  aggression: number;
  /** Range band the fighter tries to establish. */
  preferredRange: 'outside' | 'jab' | 'pocket';
  /** 0 = head hunter, 1 = body specialist. */
  bodyAttackBias: number;
}

export interface FighterAppearance {
  /** Palette index into the generated fighter palettes. */
  paletteKey: string;
  trunksKey: string;
  /** Silhouette variation: build affects drawn proportions only. */
  buildKey: 'lean' | 'athletic' | 'heavy';
  skinKey: string;
  hairKey: string;
}

/** A complete, simulation-ready fighter. Fully serialisable. */
export interface FighterDefinition {
  id: string;
  displayName: string;
  nickname: string;
  hometown: string;
  stance: Stance;
  body: FighterBody;
  ratings: CoreRatings;
  secondary: SecondaryRatings;
  style: FighterStyle;
  appearance: FighterAppearance;
}

// ---------------------------------------------------------------------------
// Commands — the only way anything drives a fighter
// ---------------------------------------------------------------------------

/**
 * Normalised per-tick intent. The player's keyboard/gamepad and the AI both
 * produce exactly this shape, which is what makes the AI provably unable to
 * act on information a player could not have.
 */
export interface FighterCommand {
  /** -1 back, 0 hold, +1 forward (relative to facing). */
  moveX: number;
  /** -1 toward the camera, 0, +1 away. */
  moveZ: number;
  /** Hold to raise the guard. */
  guard: boolean;
  /** Hold to crouch — converts punches to the body and lowers the guard. */
  crouch: boolean;
  /** Punch requested this tick, or null. */
  punch: PunchId | null;
  /** -1 slip inside, +1 slip outside, 0 none. Edge-triggered. */
  slip: number;
  /** Request a clinch when in range and eligible. */
  clinch: boolean;
  /** Recovery input while grounded. Edge-triggered. */
  recover: boolean;
}

export function emptyCommand(): FighterCommand {
  return {
    moveX: 0,
    moveZ: 0,
    guard: false,
    crouch: false,
    punch: null,
    slip: 0,
    clinch: false,
    recover: false,
  };
}

// ---------------------------------------------------------------------------
// Fighter runtime state
// ---------------------------------------------------------------------------

/**
 * Explicit action state machine. Illegal transitions throw in development —
 * see `assertTransition` in `fsm.ts`.
 */
export type ActionState =
  | 'idle'
  | 'move'
  | 'guard'
  | 'crouch'
  | 'punch_startup'
  | 'punch_active'
  | 'punch_recover'
  | 'slip'
  | 'hit_light'
  | 'hit_heavy'
  | 'stagger'
  | 'clinch'
  | 'knockdown'
  | 'rising'
  | 'knocked_out'
  | 'corner'
  | 'intro'
  | 'celebrate'
  | 'defeated';

export interface FighterState {
  id: string;
  /** Index 0 or 1 — the corner, and the array slot. */
  corner: 0 | 1;

  // Spatial ------------------------------------------------------------
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** +1 faces right, -1 faces left. Always points at the opponent. */
  facing: number;

  // Action state machine ------------------------------------------------
  state: ActionState;
  /** Ticks elapsed inside the current state. */
  stateTicks: number;
  /** Punch currently being thrown, if any. */
  activePunch: PunchId | null;
  activeLevel: TargetLevel;
  /** Set once the active window has resolved, so a punch resolves exactly once. */
  punchResolved: boolean;
  /** Ticks remaining before another action may be taken. */
  commitTicks: number;

  // Condition -----------------------------------------------------------
  /** Immediate energy. Reaching 0 puts the fighter down. */
  composure: number;
  /** Current ceiling for composure — the long-term punch-absorption budget. */
  resilience: number;
  resilienceMax: number;
  /** Localised wear, 0..1. At 1.0 the region is critical. */
  headTrauma: number;
  bodyTrauma: number;
  /** Exertion, 0..1. Slows output; never fully disables. */
  exertion: number;
  /** Guard condition, 0..1. Degrades when absorbing punches. */
  guardIntegrity: number;
  /** Balance, 0..1. Low balance converts hits into staggers and knockdowns. */
  balance: number;

  // Bout bookkeeping ----------------------------------------------------
  knockdownsThisRound: number;
  knockdownsTotal: number;
  /** Referee count reached while this fighter is grounded. */
  countReached: number;
  /** Accumulated recovery progress while grounded, 0..1. */
  riseProgress: number;
  /**
   * Divisor on rise progress, fixed at the moment of the knockdown. A first
   * knockdown for a fresh fighter is near 1; a third for a badly hurt one can
   * exceed 3, which is what turns a knockdown into a knockout.
   */
  riseDifficulty: number;
  /** Ticks until the next recovery input can count. Caps mashing. */
  riseTapCooldown: number;
  punchesThrown: number;
  punchesLanded: number;
  punchesBlocked: number;
  bodyLanded: number;
  headLanded: number;
  /** Ticks spent with the back against the ropes. */
  ropeTicks: number;
  /**
   * Punches absorbed without returning to a neutral, actionable state. Damage
   * scales down as this rises, which stops a burst of heavy punches from
   * chaining hit reactions into an unanswerable knockdown.
   */
  chainHits: number;
  /** Ticks since this fighter last threw — drives referee/AI inactivity logic. */
  idleTicks: number;
  /** Ticks of clinch in the current round, used to discourage stalling. */
  clinchTicks: number;
  /** Input buffer: a punch requested during commitment, consumed on release. */
  bufferedPunch: PunchId | null;
  bufferedLevel: TargetLevel;
  bufferedAge: number;
}

// ---------------------------------------------------------------------------
// Bout state
// ---------------------------------------------------------------------------

export type BoutPhase =
  | 'intro'
  | 'round_active'
  | 'knockdown'
  | 'round_break'
  | 'stoppage'
  | 'decision'
  | 'complete';

export type OutcomeKind = 'ko' | 'tko' | 'decision' | 'draw' | 'technical_draw';

export interface JudgeScorecard {
  judgeId: string;
  /** Points per round, index 0 = round 1. */
  rounds: number[][];
  totals: [number, number];
}

export interface BoutOutcome {
  kind: OutcomeKind;
  /** 0 or 1, or null for a draw. */
  winner: 0 | 1 | null;
  round: number;
  /** Tick within the round at which it ended. */
  tick: number;
  /** Localisation key describing why, e.g. `outcome.tko.head`. */
  reasonKey: string;
  scorecards: JudgeScorecard[];
}

export interface RoundScore {
  round: number;
  /** Raw scoring components per fighter, before judges weight them. */
  clean: [number, number];
  aggression: [number, number];
  ringControl: [number, number];
  defense: [number, number];
  knockdowns: [number, number];
}

export interface BoutState {
  phase: BoutPhase;
  round: number;
  /** Ticks elapsed in the current round. */
  roundTick: number;
  /** Total ticks elapsed in the bout, across all phases. */
  totalTicks: number;
  /** Ticks remaining in the current non-fighting phase (intro, break, count). */
  phaseTicks: number;
  fighters: [FighterState, FighterState];
  scores: RoundScore[];
  /** Set once the bout has resolved. */
  outcome: BoutOutcome | null;
  /** Which fighter is currently grounded, during the knockdown phase. */
  groundedCorner: 0 | 1 | null;
  /** Referee concern per fighter, 0..1. At 1.0 the referee may stop the bout. */
  refereeConcern: [number, number];
}

// ---------------------------------------------------------------------------
// Events — the presentation layer's only input
// ---------------------------------------------------------------------------

export type HitQuality = 'clean' | 'counter' | 'glancing' | 'blocked' | 'slipped' | 'miss';

export type BoutEvent =
  | { type: 'bout_start'; rounds: number; venueId: string }
  | { type: 'round_start'; round: number }
  | { type: 'round_end'; round: number; score: RoundScore }
  | { type: 'punch_thrown'; corner: 0 | 1; punch: PunchId; level: TargetLevel }
  | {
      type: 'punch_result';
      corner: 0 | 1;
      punch: PunchId;
      level: TargetLevel;
      quality: HitQuality;
      /** Normalised 0..1 severity, drives hitstop, shake and audio layering. */
      severity: number;
      x: number;
      z: number;
    }
  | { type: 'guard_break'; corner: 0 | 1 }
  | { type: 'stagger'; corner: 0 | 1 }
  | { type: 'knockdown'; corner: 0 | 1; round: number; count: number }
  | { type: 'count'; corner: 0 | 1; n: number }
  | { type: 'rise'; corner: 0 | 1 }
  | { type: 'clinch_start'; corner: 0 | 1 }
  | { type: 'clinch_break' }
  | { type: 'rope_pressure'; corner: 0 | 1 }
  | { type: 'referee_warning'; corner: 0 | 1; reasonKey: string }
  | { type: 'bout_end'; outcome: BoutOutcome };

// ---------------------------------------------------------------------------
// Ruleset
// ---------------------------------------------------------------------------

export interface Ruleset {
  id: string;
  rounds: number;
  /** Round length in ticks. 90 s at 60 Hz = 5400. */
  roundTicks: number;
  /** Recovery interval between rounds, in ticks. */
  breakTicks: number;
  introTicks: number;
  /** Ticks per referee count number. */
  countTicks: number;
  /** Count at which the fighter is out. */
  countLimit: number;
  /** Knockdowns in one round that end the bout. */
  threeKnockdownRule: boolean;
  knockdownsForTko: number;
  /** Whether the referee may stop the bout on accumulated trauma. */
  refereeStoppage: boolean;
  /** Scoring model. */
  scoring: 'ten_point_must';
  judgeCount: number;
}

// ---------------------------------------------------------------------------
// Bout configuration
// ---------------------------------------------------------------------------

export interface BoutConfig {
  seed: number | string;
  ruleset: Ruleset;
  venueId: string;
  fighters: [FighterDefinition, FighterDefinition];
}

/** Ring interior, in ring units. Origin is the centre. */
export const RING = {
  halfWidth: 160,
  halfDepth: 88,
  /** Distance from the rope inside which rope pressure applies. */
  ropeMargin: 22,
  /** Fighters cannot occupy the same space. */
  bodyRadius: 11,
} as const;
