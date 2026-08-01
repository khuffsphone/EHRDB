/**
 * Ten-point-must judging.
 *
 * Three judges each score every round. The round winner takes 10, the loser 9,
 * minus one point per knockdown and one more for a genuinely dominant round.
 * Judges differ in how they weight clean punching, aggression, ring control and
 * defence, and each carries a small bounded preference — that is what makes a
 * close bout worth arguing about, without ever being unseeded or unfair.
 */
import type { Rng } from './rng';
import { clamp } from './fixed';
import type { JudgeScorecard, RoundScore } from './types';

interface JudgeProfile {
  id: string;
  weights: { clean: number; aggression: number; ringControl: number; defense: number };
  /** How much this judge's view can drift from the raw components, 0..1. */
  noise: number;
}

/**
 * Three named judges with deliberately different eyes. The out-boxer's rounds
 * play better to Vance; the pressure fighter's play better to Okonjo.
 */
export const JUDGES: readonly JudgeProfile[] = [
  { id: 'judge.vance', weights: { clean: 1.0, aggression: 0.34, ringControl: 0.42, defense: 0.40 }, noise: 0.05 },
  { id: 'judge.okonjo', weights: { clean: 1.0, aggression: 0.45, ringControl: 0.30, defense: 0.24 }, noise: 0.06 },
  { id: 'judge.serrano', weights: { clean: 1.0, aggression: 0.36, ringControl: 0.34, defense: 0.34 }, noise: 0.045 },
] as const;

function judgeRoundValue(score: RoundScore, corner: 0 | 1, j: JudgeProfile): number {
  return (
    score.clean[corner] * j.weights.clean +
    score.aggression[corner] * j.weights.aggression +
    score.ringControl[corner] * j.weights.ringControl +
    score.defense[corner] * j.weights.defense
  );
}

/**
 * Scores one round for one judge. Returns `[pointsFor0, pointsFor1]`.
 *
 * Knockdowns are decisive: a knocked-down fighter cannot win the round, and
 * each knockdown costs a further point.
 */
export function scoreRound(score: RoundScore, j: JudgeProfile, rng: Rng): [number, number] {
  const a = judgeRoundValue(score, 0, j) * rng.variance(j.noise);
  const b = judgeRoundValue(score, 1, j) * rng.variance(j.noise);

  const kd0 = score.knockdowns[0];
  const kd1 = score.knockdowns[1];

  let winner: 0 | 1 | null;
  if (kd0 > kd1) winner = 1;
  else if (kd1 > kd0) winner = 0;
  else if (a > b) winner = 0;
  else if (b > a) winner = 1;
  else winner = null;

  // A round with no scoring activity at all is even.
  if (winner === null || (a === 0 && b === 0)) return [10, 10];

  const loser: 0 | 1 = winner === 0 ? 1 : 0;
  const winVal = winner === 0 ? a : b;
  const loseVal = winner === 0 ? b : a;

  let loserPoints = 9;
  // Each knockdown the loser suffered costs a point.
  loserPoints -= score.knockdowns[loser];

  // A shutout round without a knockdown can still be a 10-8.
  const dominance = loseVal <= 0 ? 4 : winVal / loseVal;
  if (score.knockdowns[loser] === 0 && dominance >= 2.6) loserPoints -= 1;

  loserPoints = clamp(loserPoints, 6, 9);

  return winner === 0 ? [10, loserPoints] : [loserPoints, 10];
}

/**
 * Produces one scorecard per judge for the rounds completed so far.
 * A bout that ends inside the distance still scores its completed rounds, so a
 * technical decision (were one ever enabled) reconciles with the same data.
 */
export function buildScorecards(scores: readonly RoundScore[], rng: Rng): JudgeScorecard[] {
  return JUDGES.map((j) => {
    const rounds: number[][] = [];
    let t0 = 0;
    let t1 = 0;
    for (const s of scores) {
      const [p0, p1] = scoreRound(s, j, rng);
      rounds.push([p0, p1]);
      t0 += p0;
      t1 += p1;
    }
    return { judgeId: j.id, rounds, totals: [t0, t1] as [number, number] };
  });
}

/**
 * Resolves the scorecards into a winner. A majority of judges decides; a split
 * with no majority is a draw.
 */
export function decisionWinner(cards: readonly JudgeScorecard[]): 0 | 1 | null {
  let for0 = 0;
  let for1 = 0;
  for (const c of cards) {
    if (c.totals[0] > c.totals[1]) for0++;
    else if (c.totals[1] > c.totals[0]) for1++;
  }
  if (for0 > for1) return 0;
  if (for1 > for0) return 1;
  return null;
}

/** Describes the decision type for the result screen. */
export function decisionKindKey(cards: readonly JudgeScorecard[], winner: 0 | 1 | null): string {
  if (winner === null) return 'outcome.decision.draw';
  let agreeing = 0;
  for (const c of cards) {
    if ((c.totals[0] > c.totals[1] ? 0 : c.totals[1] > c.totals[0] ? 1 : null) === winner) agreeing++;
  }
  if (agreeing === cards.length) return 'outcome.decision.unanimous';
  if (agreeing === cards.length - 1) return 'outcome.decision.majority';
  return 'outcome.decision.split';
}

export function emptyRoundScore(round: number): RoundScore {
  return {
    round,
    clean: [0, 0],
    aggression: [0, 0],
    ringControl: [0, 0],
    defense: [0, 0],
    knockdowns: [0, 0],
  };
}
