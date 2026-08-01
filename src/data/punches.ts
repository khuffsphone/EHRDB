/**
 * The punch table.
 *
 * Every value here is a design decision tuned through the AI soak harness
 * (`npm run soak`) — see docs/COMBAT_SPEC.md for the tactical role each punch
 * is meant to occupy and the balance evidence behind these numbers.
 *
 * Timing is in ticks at 60 Hz. Reach and range are in ring units, where the
 * ring interior is 320 x 176 and a fighter's body radius is 11.
 */
import type { PunchDefinition, PunchId, TargetLevel } from '@sim/types';

/**
 * Head-level definitions. Body variants are derived by `bodyVariant` so the two
 * levels can never drift apart structurally.
 */
const HEAD_PUNCHES: Record<PunchId, PunchDefinition> = {
  // Long, cheap, safe. Owns the outside. Cannot end a fight on its own.
  jab: {
    id: 'jab',
    nameKey: 'punch.jab',
    hand: 'lead',
    family: 'jab',
    startupTicks: 5,
    activeTicks: 3,
    recoveryTicks: 9,
    whiffExtraTicks: 4,
    reach: 54,
    minRange: 26,
    depthTolerance: 26,
    movementAllowance: 0.55,
    composureDamage: 4.05,
    resilienceDamage: 0.510,
    traumaDamage: 0.0078,
    guardDamage: 0.05,
    exertionCost: 0.0153,
    scoreValue: 1.15,
    counterBonus: 1.35,
    staggerPower: 0.07,
    vulnerableFrom: 4,
    vulnerableTo: 12,
  },

  // The rear straight. Long and genuinely dangerous, but a real commitment.
  cross: {
    id: 'cross',
    nameKey: 'punch.cross',
    hand: 'rear',
    family: 'cross',
    startupTicks: 9,
    activeTicks: 3,
    recoveryTicks: 16,
    whiffExtraTicks: 9,
    reach: 51,
    minRange: 24,
    depthTolerance: 24,
    movementAllowance: 0.28,
    composureDamage: 9.07,
    resilienceDamage: 1.388,
    traumaDamage: 0.0195,
    guardDamage: 0.13,
    exertionCost: 0.0340,
    scoreValue: 1.60,
    counterBonus: 1.55,
    staggerPower: 0.19,
    vulnerableFrom: 6,
    vulnerableTo: 24,
  },

  // Short lead hook. Fast for its damage, but only inside the jab.
  lead_hook: {
    id: 'lead_hook',
    nameKey: 'punch.leadHook',
    hand: 'lead',
    family: 'hook',
    startupTicks: 8,
    activeTicks: 3,
    recoveryTicks: 14,
    whiffExtraTicks: 8,
    reach: 40,
    minRange: 16,
    depthTolerance: 22,
    movementAllowance: 0.34,
    composureDamage: 8.99,
    resilienceDamage: 1.155,
    traumaDamage: 0.0183,
    guardDamage: 0.16,
    exertionCost: 0.0289,
    scoreValue: 1.50,
    counterBonus: 1.5,
    staggerPower: 0.22,
    vulnerableFrom: 5,
    vulnerableTo: 21,
  },

  // Rear hook: the widest, slowest swing. Ends rounds, loses exchanges.
  rear_hook: {
    id: 'rear_hook',
    nameKey: 'punch.rearHook',
    hand: 'rear',
    family: 'hook',
    startupTicks: 12,
    activeTicks: 3,
    recoveryTicks: 21,
    whiffExtraTicks: 14,
    reach: 38,
    minRange: 15,
    depthTolerance: 21,
    movementAllowance: 0.20,
    composureDamage: 13.02,
    resilienceDamage: 1.990,
    traumaDamage: 0.0267,
    guardDamage: 0.21,
    exertionCost: 0.0493,
    scoreValue: 1.90,
    counterBonus: 1.6,
    staggerPower: 0.30,
    vulnerableFrom: 7,
    vulnerableTo: 32,
  },

  // Lead uppercut. Beats a high guard's underside and punishes crouching.
  lead_upper: {
    id: 'lead_upper',
    nameKey: 'punch.leadUpper',
    hand: 'lead',
    family: 'uppercut',
    startupTicks: 10,
    activeTicks: 3,
    recoveryTicks: 17,
    whiffExtraTicks: 10,
    reach: 33,
    minRange: 12,
    depthTolerance: 19,
    movementAllowance: 0.26,
    composureDamage: 10.02,
    resilienceDamage: 1.388,
    traumaDamage: 0.0234,
    guardDamage: 0.27,
    exertionCost: 0.0357,
    scoreValue: 1.60,
    counterBonus: 1.65,
    staggerPower: 0.25,
    vulnerableFrom: 6,
    vulnerableTo: 26,
  },

  // The shortest, slowest, hardest punch in the game. Pure knockdown threat.
  rear_upper: {
    id: 'rear_upper',
    nameKey: 'punch.rearUpper',
    hand: 'rear',
    family: 'uppercut',
    startupTicks: 14,
    activeTicks: 3,
    recoveryTicks: 24,
    whiffExtraTicks: 16,
    reach: 31,
    minRange: 11,
    depthTolerance: 18,
    movementAllowance: 0.16,
    composureDamage: 15.06,
    resilienceDamage: 2.405,
    traumaDamage: 0.0313,
    guardDamage: 0.33,
    exertionCost: 0.0578,
    scoreValue: 2.10,
    counterBonus: 1.7,
    staggerPower: 0.34,
    vulnerableFrom: 8,
    vulnerableTo: 37,
  },
};

/**
 * Body variants trade knockdown pressure for lasting damage.
 *
 * A body shot scores less and rocks less, but drains exertion hard and builds
 * body trauma quickly. Investing rounds in the body is what makes a late-fight
 * head shot land — which is the strategic spine of the whole combat model.
 */
function bodyVariant(p: PunchDefinition): PunchDefinition {
  return {
    ...p,
    // Reaching down costs a little range and demands tighter alignment.
    reach: p.reach - 4,
    minRange: Math.max(8, p.minRange - 4),
    depthTolerance: p.depthTolerance - 2,
    startupTicks: p.startupTicks + 1,
    recoveryTicks: p.recoveryTicks + 1,
    composureDamage: p.composureDamage * 0.62,
    resilienceDamage: p.resilienceDamage * 1.35,
    traumaDamage: p.traumaDamage * 1.65,
    guardDamage: p.guardDamage * 1.15,
    exertionCost: p.exertionCost * 1.1,
    scoreValue: p.scoreValue * 0.82,
    staggerPower: p.staggerPower * 0.45,
    // A body shot that lands is worth more later, not now.
    counterBonus: p.counterBonus * 0.92,
  };
}

const BODY_PUNCHES: Record<PunchId, PunchDefinition> = {
  jab: bodyVariant(HEAD_PUNCHES.jab),
  cross: bodyVariant(HEAD_PUNCHES.cross),
  lead_hook: bodyVariant(HEAD_PUNCHES.lead_hook),
  rear_hook: bodyVariant(HEAD_PUNCHES.rear_hook),
  lead_upper: bodyVariant(HEAD_PUNCHES.lead_upper),
  rear_upper: bodyVariant(HEAD_PUNCHES.rear_upper),
};

/** Look up the resolved definition for a punch thrown at a given level. */
export function getPunch(id: PunchId, level: TargetLevel): PunchDefinition {
  return level === 'head' ? HEAD_PUNCHES[id] : BODY_PUNCHES[id];
}

/** Total committed ticks for a punch that connects or is blocked. */
export function punchDuration(p: PunchDefinition): number {
  return p.startupTicks + p.activeTicks + p.recoveryTicks;
}

export const PUNCH_TABLE = { head: HEAD_PUNCHES, body: BODY_PUNCHES } as const;
