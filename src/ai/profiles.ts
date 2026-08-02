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
    aggression: 0.55,
    riskTolerance: 0.2,
    bodyBias: 0.16,
    counterAppetite: 0.45,
    guardDiscipline: 0.42,
    slipPreference: 0.6,
    clinchAppetite: 0.45,
    // An out-boxer wins by throwing the most punches, not the fewest. The jab
    // is weighted well above every other option so the profile actually
    // produces the high-volume long-range game it is meant to.
    punchWeights: W(1.2, 0.64, 0.26, 0.09, 0.13, 0.06),
    movementHold: 16,
  },

  // Wins by never leaving. Walks through the jab, works the body, throws in
  // volume and accepts being hit to get there.
  pressure: {
    archetype: 'pressure',
    /*
     * Just outside the clinch, not inside it. A target of 27 sat one unit off
     * `RANGE.clinch`, so the archetype meant to throw the most punches threw
     * the fewest: it spent the round tied up, and its straight punches were
     * gated out by range while hooks and uppercuts carried 69% of the mix.
     * Backing off four units restores the volume the identity depends on.
     */
    targetRange: 29,
    rangeTolerance: 7,
    aggression: 0.9,
    riskTolerance: 0.62,
    bodyBias: 0.52,
    counterAppetite: 0.24,
    // Walking through punches is the identity; being unable to survive doing
    // it is not. This is still the least disciplined guard of the five.
    guardDiscipline: 0.3,
    slipPreference: 0.3,
    clinchAppetite: 0.2,
    punchWeights: W(0.72, 0.6, 0.9, 0.62, 0.62, 0.4),
    movementHold: 10,
  },

  // Wins by making you lead. Holds the mid range, guards, and punishes the
  // vulnerability window of whatever you just threw.
  counterpuncher: {
    archetype: 'counterpuncher',
    // Just outside the pocket: close enough to punish a lead, far enough that
    // the lead has to be committed before it arrives.
    targetRange: 42,
    rangeTolerance: 8,
    aggression: 0.38,
    riskTolerance: 0.42,
    bodyBias: 0.3,
    counterAppetite: 0.95,
    guardDiscipline: 0.78,
    slipPreference: 0.55,
    clinchAppetite: 0.4,
    punchWeights: W(0.7, 0.98, 0.5, 0.55, 0.5, 0.55),
    movementHold: 18,
  },

  // Wins in one shot. Patient in a lazy way, then commits everything. Fades
  // late, which is the counterplay.
  brawler: {
    archetype: 'brawler',
    /*
     * Two units further out than the pocket it used to sit in. Its heavy
     * punches are its identity and also the shortest-reach punches in the
     * game, so distance is the honest lever: it lands fewer of them without
     * throwing fewer of them. Paying for the power in volume alone left it
     * beating the boxer-puncher badly enough to push that archetype under the
     * band.
     */
    targetRange: 35,
    rangeTolerance: 9,
    aggression: 0.56,
    riskTolerance: 0.6,
    bodyBias: 0.22,
    counterAppetite: 0.35,
    guardDiscipline: 0.22,
    slipPreference: 0.1,
    clinchAppetite: 0.22,
    /*
     * The heaviest mix in the game, and it has to stay that way.
     *
     * The brawler was the dominant archetype at 59% and won 94% of its bouts
     * by stoppage. The first fix was to trade rear-hand weight for the jab,
     * which balanced it beautifully and was wrong: its power-punch share fell
     * from 31% to 10%, and `tests/ai/fairness.test.ts` failed on exactly that.
     * Balance had been bought by deleting the archetype's identity — the same
     * mistake as making every fighter identical and calling the result fair.
     *
     * So the power mix is restored and the cost is paid in `aggression`
     * instead: the brawler throws the fewest punches of the five and each one
     * matters. Low volume, high consequence, no defence to speak of — patient
     * in a lazy way, then commits everything, and fades. That is the design,
     * and now it is also the measurement.
     */
    punchWeights: W(0.55, 0.7, 0.7, 0.95, 0.45, 0.75),
    movementHold: 14,
  },

  // Wins by having no hole. Shifts range and mix between rounds.
  boxer_puncher: {
    archetype: 'boxer_puncher',
    /*
     * Just outside the pocket rather than inside it. At 38 it sat squarely in
     * RANGE.pocket, took the most punishment in the game, and had neither the
     * out-boxer's escape nor the brawler's power to make the exchange worth
     * it — the weakest archetype by a distance, with the worst accuracy of the
     * five because much of its volume was thrown from the wrong distance for
     * its own mix. "No hole" has to mean it picks its range, not that it
     * stands in everyone else's.
     */
    targetRange: 39,
    rangeTolerance: 8,
    aggression: 0.58,
    // It is a *puncher*. It previously carried the lightest rear hand of
    // anyone but the out-boxer, which is not what the name promises.
    riskTolerance: 0.58,
    bodyBias: 0.38,
    counterAppetite: 0.7,
    guardDiscipline: 0.72,
    // Slipping beats a committed power punch; blocking only softens it. This
    // is the boxer-puncher's answer to the brawler.
    slipPreference: 0.55,
    clinchAppetite: 0.35,
    /*
     * Weighted toward the two punches that reach from its own range. Four of
     * six weights previously favoured short-reach power punches thrown from
     * 39 units, which is why it carried the worst accuracy of the five while
     * throwing the most punches. It keeps a real rear hand — it is a puncher —
     * but it now leads with what actually lands from where it chooses to stand.
     */
    punchWeights: W(0.95, 0.9, 0.62, 0.58, 0.5, 0.55),
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
