/**
 * Bout rulesets. Round length is expressed in ticks so that nothing in the
 * simulation ever has to reason about milliseconds.
 */
import { TICK_RATE, type Ruleset } from '@sim/types';

const seconds = (s: number): number => Math.round(s * TICK_RATE);

/**
 * Broadcast pace is the default: 90-second rounds keep a ten-rounder inside a
 * sitting while preserving the shape of a real fight. Championship pace runs
 * full three-minute rounds for players who want the long haul.
 * See docs/DECISIONS.md (D-004).
 */
export type PaceId = 'brisk' | 'broadcast' | 'championship';

export const ROUND_SECONDS: Record<PaceId, number> = {
  brisk: 60,
  broadcast: 90,
  championship: 180,
};

export function makeRuleset(rounds: 3 | 6 | 10 | 12, pace: PaceId = 'broadcast'): Ruleset {
  return {
    id: `${rounds}r_${pace}`,
    rounds,
    roundTicks: seconds(ROUND_SECONDS[pace]),
    breakTicks: seconds(12),
    introTicks: seconds(2),
    countTicks: seconds(1),
    countLimit: 10,
    threeKnockdownRule: true,
    knockdownsForTko: 3,
    refereeStoppage: true,
    scoring: 'ten_point_must',
    judgeCount: 3,
  };
}

/** The lengths a bout may be contested over. */
export const BOUT_LENGTHS = [3, 6, 10] as const;
export type BoutLength = (typeof BOUT_LENGTHS)[number];

export const DEFAULT_RULESET = makeRuleset(3, 'broadcast');
