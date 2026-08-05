/**
 * The balance targets, as data.
 *
 * These numbers used to live in three places that disagreed: prose in
 * CLAUDE.md and docs/PRODUCT_CANON.md claimed a 40–60% archetype band, the
 * soak test asserted 20–80%, and the committed evidence showed 35–60%. The
 * documentation was cited as proven by a gate that was never checking it.
 *
 * So there is now exactly one definition, here, and everything else refers to
 * it: the soak test asserts these values, the soak tool prints them alongside
 * the measurement, and `npm run assets:validate` fails if the documentation
 * states a different number. A claim that no test enforces is not allowed to
 * appear in a specification.
 *
 * ## On sample size
 *
 * A win rate measured over n bouts has a standard error near
 * `sqrt(0.25 / n)`. At the 200-bout mirror soak used for day-to-day work each
 * archetype contests 80 bouts, giving SE ≈ 5.6% and a 95% interval of roughly
 * ±11% — wider than the entire 40–60% band. Asserting the band at that sample
 * size measures the seed, not the balance.
 *
 * `certifySize` is therefore the sample the acceptance gate uses, and it is
 * large enough that the band means something: 1200 bouts is 480 per archetype,
 * SE ≈ 2.3%, 95% interval ±4.5%. Smaller runs remain useful for iteration and
 * are checked against `iterationBand`, which is the certification band widened
 * by the sampling error the smaller sample actually carries.
 */

export interface BalanceTargets {
  /** Mirror-soak win rate per archetype, as fractions. */
  archetypeWinRate: { min: number; max: number };
  /** Punches landed as a share of punches thrown, across the batch. */
  accuracy: { min: number; max: number };
  /** Mean rounds completed, against the scheduled mean. */
  meanRounds: { min: number; max: number };
  /** Share of bouts ending inside the distance. */
  stoppageRate: { min: number; max: number };
  /** Bouts the acceptance gate runs before it is entitled to an opinion. */
  certifySize: number;
  /** Widened band for the smaller batches used during iteration. */
  iterationBand: { min: number; max: number };
  /** Bouts below which the archetype band is not asserted at all. */
  iterationSize: number;
}

export const BALANCE_TARGETS: BalanceTargets = {
  archetypeWinRate: { min: 0.4, max: 0.6 },
  accuracy: { min: 0.3, max: 0.4 },
  meanRounds: { min: 4.4, max: 5.6 },
  stoppageRate: { min: 0.3, max: 0.45 },
  certifySize: 1200,
  iterationBand: { min: 0.33, max: 0.67 },
  iterationSize: 200,
};

/** Renders a fraction as the whole-number percentage the documents quote. */
export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * The exact strings the documentation must contain.
 *
 * `npm run assets:validate` greps for these. If someone edits a target here
 * without editing the prose, or edits the prose without editing the target,
 * the build fails — which is the whole mechanism that stops the two drifting
 * apart again.
 */
export function documentedClaims(): { label: string; text: string }[] {
  const t = BALANCE_TARGETS;
  return [
    { label: 'archetype band', text: `${pct(t.archetypeWinRate.min)}–${pct(t.archetypeWinRate.max)}` },
    { label: 'accuracy band', text: `${pct(t.accuracy.min)}–${pct(t.accuracy.max)}` },
    { label: 'stoppage band', text: `${pct(t.stoppageRate.min)}–${pct(t.stoppageRate.max)}` },
    { label: 'certification sample', text: `${t.certifySize} mirror bouts` },
  ];
}
