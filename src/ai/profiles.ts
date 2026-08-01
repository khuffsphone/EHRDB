/**
 * AI archetype profiles and difficulty.
 *
 * Archetypes differ in *goals* — preferred range, punch mix, risk appetite,
 * defensive habits and pacing — not in stat multipliers. Difficulty adjusts
 * perception, planning and discipline, never the fighter's ratings. That
 * separation is what keeps a hard opponent fair.
 */
import type { ArchetypeId, PunchId } from '@sim/types';

/** Range bands in ring units, measured between fighter centres. */
export const RANGE = {
  /** Touching. */
  clinch: 26,
  pocket: 36,
  jab: 52,
  outside: 74,
} as const;

export interface AiProfile {
  archetype: ArchetypeId;
  /** Separation the fighter tries to hold. */
  targetRange: number;
  /** How far from `targetRange` is tolerable before repositioning. */
  rangeTolerance: number;
  /** 0..1 — how readily this fighter initiates. */
  aggression: number;
  /** 0..1 — willingness to throw the slow, heavy, counterable punches. */
  riskTolerance: number;
  /** 0..1 — fraction of punches aimed at the body. */
  bodyBias: number;
  /** 0..1 — how much a committed opponent tempts a counter. */
  counterAppetite: number;
  /** 0..1 — how often the fighter holds a guard when not attacking. */
  guardDiscipline: number;
  /** 0..1 — preference for slipping over blocking. */
  slipPreference: number;
  /** 0..1 — willingness to clinch when hurt. */
  clinchAppetite: number;
  /** Relative weight per punch when choosing what to throw. */
  punchWeights: Record<PunchId, number>;
  /** Ticks the fighter will keep circling before re-deciding. */
  movementHold: number;
}

const W = (jab: number, cross: number, lh: number, rh: number, lu: number, ru: number): Record<PunchId, number> => ({
  jab,
  cross,
  lead_hook: lh,
  rear_hook: rh,
  lead_upper: lu,
  rear_upper: ru,
});

export const AI_PROFILES: Record<ArchetypeId, AiProfile> = {
  // Wins by never being there. Long jab, constant lateral movement, retreats
  // the moment the pocket closes.
  out_boxer: {
    archetype: 'out_boxer',
    targetRange: 46,
    rangeTolerance: 9,
    aggression: 0.52,
    riskTolerance: 0.2,
    bodyBias: 0.16,
    counterAppetite: 0.45,
    guardDiscipline: 0.42,
    slipPreference: 0.6,
    clinchAppetite: 0.45,
    // An out-boxer wins by throwing the most punches, not the fewest. The jab
    // is weighted well above every other option so the profile actually
    // produces the high-volume long-range game it is meant to.
    punchWeights: W(1.3, 0.62, 0.26, 0.09, 0.13, 0.06),
    movementHold: 16,
  },

  // Wins by never leaving. Walks through the jab, works the body, throws in
  // volume and accepts being hit to get there.
  pressure: {
    archetype: 'pressure',
    targetRange: 27,
    rangeTolerance: 7,
    aggression: 0.9,
    riskTolerance: 0.62,
    bodyBias: 0.52,
    counterAppetite: 0.24,
    guardDiscipline: 0.28,
    slipPreference: 0.3,
    clinchAppetite: 0.2,
    punchWeights: W(0.6, 0.4, 0.9, 0.62, 0.7, 0.4),
    movementHold: 10,
  },

  // Wins by making you lead. Holds the mid range, guards, and punishes the
  // vulnerability window of whatever you just threw.
  counterpuncher: {
    archetype: 'counterpuncher',
    targetRange: 40,
    rangeTolerance: 8,
    aggression: 0.34,
    riskTolerance: 0.34,
    bodyBias: 0.3,
    counterAppetite: 0.95,
    guardDiscipline: 0.78,
    slipPreference: 0.55,
    clinchAppetite: 0.4,
    punchWeights: W(0.7, 0.95, 0.5, 0.42, 0.5, 0.42),
    movementHold: 18,
  },

  // Wins in one shot. Patient in a lazy way, then commits everything. Fades
  // late, which is the counterplay.
  brawler: {
    archetype: 'brawler',
    targetRange: 33,
    rangeTolerance: 9,
    aggression: 0.66,
    riskTolerance: 0.78,
    bodyBias: 0.22,
    counterAppetite: 0.35,
    guardDiscipline: 0.3,
    slipPreference: 0.15,
    clinchAppetite: 0.3,
    punchWeights: W(0.75, 0.85, 0.85, 0.95, 0.6, 0.85),
    movementHold: 14,
  },

  // Wins by having no hole. Shifts range and mix between rounds.
  boxer_puncher: {
    archetype: 'boxer_puncher',
    targetRange: 40,
    rangeTolerance: 8,
    aggression: 0.52,
    riskTolerance: 0.5,
    bodyBias: 0.38,
    counterAppetite: 0.6,
    guardDiscipline: 0.58,
    slipPreference: 0.42,
    clinchAppetite: 0.35,
    punchWeights: W(0.85, 0.75, 0.6, 0.45, 0.55, 0.45),
    movementHold: 16,
  },
};

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export type DifficultyId = 'club' | 'contender' | 'title' | 'legend';

export interface Difficulty {
  id: DifficultyId;
  nameKey: string;
  /** Ticks of perception delay. Higher means the AI reacts later. */
  perceptionLatency: number;
  /** Ticks between tactical re-decisions. */
  decisionInterval: number;
  /** Multiplier on utility noise — how often it picks a worse option. */
  noise: number;
  /** 0..1 chance of correctly reading the level of an incoming punch. */
  readAccuracy: number;
  /** Length of planned combinations. */
  planDepth: number;
  /** 0..1 how strongly it adapts to what has been working. */
  adaptation: number;
  /** 0..1 discipline in protecting a lead late. */
  tacticalDiscipline: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  // Reacts about a fifth of a second late and guesses often. A new player can
  // out-jab it immediately.
  club: {
    id: 'club',
    nameKey: 'difficulty.club',
    perceptionLatency: 16,
    decisionInterval: 16,
    noise: 1.0,
    readAccuracy: 0.4,
    planDepth: 1,
    adaptation: 0.15,
    tacticalDiscipline: 0.25,
  },
  contender: {
    id: 'contender',
    nameKey: 'difficulty.contender',
    perceptionLatency: 12,
    decisionInterval: 12,
    noise: 0.68,
    readAccuracy: 0.58,
    planDepth: 2,
    adaptation: 0.4,
    tacticalDiscipline: 0.5,
  },
  title: {
    id: 'title',
    nameKey: 'difficulty.title',
    perceptionLatency: 9,
    decisionInterval: 9,
    noise: 0.44,
    readAccuracy: 0.72,
    planDepth: 3,
    adaptation: 0.65,
    tacticalDiscipline: 0.75,
  },
  // Still cannot see a jab coming: 7 ticks of latency against a 5-tick jab
  // startup means the fastest punch in the game remains unreactable. Legend
  // wins by position and prediction, not by cheating.
  legend: {
    id: 'legend',
    nameKey: 'difficulty.legend',
    perceptionLatency: 7,
    decisionInterval: 7,
    noise: 0.3,
    readAccuracy: 0.84,
    planDepth: 3,
    adaptation: 0.85,
    tacticalDiscipline: 0.92,
  },
};

export const DIFFICULTY_IDS: readonly DifficultyId[] = ['club', 'contender', 'title', 'legend'];
