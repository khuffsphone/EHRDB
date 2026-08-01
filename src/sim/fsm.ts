/**
 * The fighter action state machine.
 *
 * Transitions are declared explicitly. An illegal transition is a programming
 * error, and in development it throws immediately rather than producing a
 * fighter that silently punches while knocked down.
 */
import type { ActionState, FighterState } from './types';

/** For each state, the set of states it may move to. */
const LEGAL: Record<ActionState, readonly ActionState[]> = {
  intro: ['idle'],

  idle: ['idle', 'move', 'guard', 'crouch', 'punch_startup', 'slip', 'clinch', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],
  move: ['idle', 'move', 'guard', 'crouch', 'punch_startup', 'slip', 'clinch', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],
  guard: ['idle', 'move', 'guard', 'crouch', 'punch_startup', 'slip', 'clinch', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],
  crouch: ['idle', 'move', 'guard', 'crouch', 'punch_startup', 'slip', 'clinch', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],

  // A punch runs startup -> active -> recover and can only be interrupted by
  // being hit hard enough, by the round ending, or by going down.
  // The bell, a stoppage or a knockdown can all interrupt a punch in flight.
  punch_startup: ['punch_active', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'idle', 'celebrate', 'defeated'],
  punch_active: ['punch_recover', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'idle', 'celebrate', 'defeated'],
  punch_recover: ['idle', 'move', 'guard', 'crouch', 'punch_startup', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],

  slip: ['idle', 'move', 'guard', 'punch_startup', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],

  hit_light: ['idle', 'move', 'guard', 'crouch', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'punch_startup', 'corner', 'defeated', 'celebrate'],
  hit_heavy: ['idle', 'guard', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'defeated', 'celebrate'],
  stagger: ['idle', 'guard', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'defeated', 'celebrate'],

  clinch: ['idle', 'move', 'guard', 'hit_light', 'hit_heavy', 'stagger', 'knockdown', 'corner', 'celebrate', 'defeated'],

  knockdown: ['rising', 'knocked_out', 'defeated'],
  rising: ['idle', 'guard', 'knockdown', 'knocked_out', 'corner', 'defeated', 'celebrate'],
  knocked_out: ['defeated', 'knocked_out'],

  corner: ['idle', 'corner', 'celebrate', 'defeated'],
  celebrate: ['celebrate', 'idle'],
  defeated: ['defeated', 'idle'],
};

/** States in which the fighter is on the canvas and cannot act. */
export function isGrounded(s: ActionState): boolean {
  return s === 'knockdown' || s === 'rising' || s === 'knocked_out';
}

/** States in which the fighter is locked out of choosing a new action. */
export function isCommitted(s: ActionState): boolean {
  return (
    s === 'punch_startup' ||
    s === 'punch_active' ||
    s === 'punch_recover' ||
    s === 'hit_light' ||
    s === 'hit_heavy' ||
    s === 'stagger' ||
    s === 'slip' ||
    isGrounded(s)
  );
}

/** States in which the fighter can be hit at all. */
export function isHittable(s: ActionState): boolean {
  return !isGrounded(s) && s !== 'intro' && s !== 'corner' && s !== 'celebrate' && s !== 'defeated';
}

/** Whether a punch thrown from this state can connect. */
export function canThrow(s: ActionState): boolean {
  return s === 'idle' || s === 'move' || s === 'guard' || s === 'crouch' || s === 'punch_recover' || s === 'slip';
}

let strictMode = true;

/**
 * Illegal transitions fail loudly in development and in tests. Production
 * builds clamp instead of throwing, so a late-discovered edge case degrades
 * into a safe idle rather than a crashed bout.
 */
export function setStrictTransitions(on: boolean): void {
  strictMode = on;
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: ActionState,
    readonly to: ActionState,
    readonly fighterId: string,
  ) {
    super(`Illegal fighter state transition for ${fighterId}: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: ActionState, to: ActionState): boolean {
  return LEGAL[from].includes(to);
}

/**
 * Applies a state transition, resetting per-state bookkeeping. Returns true if
 * the transition happened.
 */
export function transition(f: FighterState, to: ActionState): boolean {
  if (f.state === to) {
    return false;
  }
  if (!canTransition(f.state, to)) {
    if (strictMode) throw new IllegalTransitionError(f.state, to, f.id);
    return false;
  }
  f.state = to;
  f.stateTicks = 0;
  return true;
}

export const LEGAL_TRANSITIONS = LEGAL;
