/**
 * The soak gate.
 *
 * At least a hundred seeded AI-versus-AI bouts must complete without deadlock,
 * NaN, an invalid transition, runaway memory or an impossible result. This is
 * the acceptance gate stated in the brief, run as a test rather than only as a
 * tool so it cannot be skipped.
 */
import { describe, expect, it } from 'vitest';
import { runSoak, type SoakReport } from '../../tools/soak';
import { BALANCE_TARGETS } from '../../tools/balance-targets';
import { MIRROR_ARCHETYPES } from '@data/mirror';
import type { ArchetypeId, PunchId } from '@sim/types';

/**
 * Runs a soak in chunks, yielding to the event loop between them.
 *
 * The simulation is synchronous by design, so a single large batch blocks the
 * worker for long enough to starve Vitest's progress heartbeat. Chunking keeps
 * the batch size identical while letting the runner breathe.
 */
async function soak(
  total: number,
  difficulty: 'club' | 'contender' | 'title' | 'legend',
  seed: number,
  mirror: boolean,
  chunk = 30,
): Promise<SoakReport> {
  let merged: SoakReport | null = null;
  for (let done = 0; done < total; done += chunk) {
    const size = Math.min(chunk, total - done);
    const part = runSoak({ bouts: size, json: null, difficulty, seed: seed + done * 977, mirror });
    merged = merged === null ? part : mergeReports(merged, part);
    await new Promise((r) => setTimeout(r, 0));
  }
  return merged!;
}

function mergeReports(a: SoakReport, b: SoakReport): SoakReport {
  const byArch = new Map<ArchetypeId, SoakReport['archetypes'][number]>();
  for (const s of [...a.archetypes, ...b.archetypes]) {
    const existing = byArch.get(s.archetype);
    if (!existing) {
      byArch.set(s.archetype, { ...s, punchMix: { ...s.punchMix } });
      continue;
    }
    existing.bouts += s.bouts;
    existing.wins += s.wins;
    existing.kos += s.kos;
    existing.thrown += s.thrown;
    existing.landed += s.landed;
    existing.headLanded += s.headLanded;
    existing.bodyLanded += s.bodyLanded;
    existing.knockdownsFor += s.knockdownsFor;
    existing.knockdownsAgainst += s.knockdownsAgainst;
    for (const p of Object.keys(existing.punchMix) as PunchId[]) existing.punchMix[p] += s.punchMix[p];
  }
  const totalBouts = a.bouts + b.bouts;
  return {
    bouts: totalBouts,
    difficulty: a.difficulty,
    outcomes: {
      ko: a.outcomes.ko + b.outcomes.ko,
      tko: a.outcomes.tko + b.outcomes.tko,
      decision: a.outcomes.decision + b.outcomes.decision,
      draw: a.outcomes.draw + b.outcomes.draw,
    },
    meanRounds: (a.meanRounds * a.bouts + b.meanRounds * b.bouts) / Math.max(1, totalBouts),
    meanTicks: Math.round((a.meanTicks * a.bouts + b.meanTicks * b.bouts) / Math.max(1, totalBouts)),
    meanLandPercent: (a.meanLandPercent * a.bouts + b.meanLandPercent * b.bouts) / Math.max(1, totalBouts),
    archetypes: [...byArch.values()],
    matchup: a.matchup,
    failures: [...a.failures, ...b.failures],
    hashes: [...a.hashes, ...b.hashes],
  };
}

describe('AI soak', () => {
  it('completes 120 seeded bouts on the ranked roster with no failures', async () => {
    const report = await soak(120, 'contender', 61_000, false);
    expect(report.failures, report.failures.slice(0, 5).join(' | ')).toEqual([]);
    expect(report.bouts).toBe(120);

    // Every outcome kind should be reachable across a batch this size.
    expect(report.outcomes.ko + report.outcomes.tko).toBeGreaterThan(0);
    expect(report.outcomes.decision).toBeGreaterThan(0);

    // Bouts must actually be contested, not resolved instantly or hung.
    expect(report.meanRounds).toBeGreaterThan(1.5);
    expect(report.meanTicks).toBeGreaterThan(60 * 30);
    expect(report.meanTicks).toBeLessThan(60 * 60 * 40);

    // Accuracy in a plausible range for the sport.
    expect(report.meanLandPercent).toBeGreaterThan(15);
    expect(report.meanLandPercent).toBeLessThan(60);
  }, 300_000);

  it('completes 120 control bouts where only the archetype differs', async () => {
    const report = await soak(120, 'title', 62_000, true);
    expect(report.failures, report.failures.slice(0, 5).join(' | ')).toEqual([]);
    expect(report.bouts).toBe(120);
  }, 300_000);

  it('keeps every archetype competitive when ratings are held equal', async () => {
    /*
     * The balance target, at the sample size where the target means something.
     *
     * This assertion used to be 20–80% while every document claimed 40–60%.
     * The gate that was cited as proving the claim had four times the slack of
     * the claim, so the two drifted for the entire project without anything
     * failing. Both numbers now come from BALANCE_TARGETS, and this test runs
     * the iteration sample against the widened band; the full documented band
     * is certified at `certifySize` by the `soak-mirror-certify` stage of
     * `npm run verify`, which is the run the documentation may cite.
     *
     * The widening is not a fudge, it is arithmetic: at `iterationSize` each
     * archetype contests roughly 80 bouts, and a win rate over 80 bouts has a
     * standard error near 5.6%. Asserting ±10 points on that sample would fail
     * on seed choice alone even from a perfectly balanced model.
     */
    const t = BALANCE_TARGETS;
    const report = await soak(t.iterationSize, 'contender', 63_000, true, 40);
    expect(report.failures).toEqual([]);
    expect(report.archetypes.length).toBe(MIRROR_ARCHETYPES.length);

    for (const a of report.archetypes) {
      const winRate = a.wins / Math.max(1, a.bouts);
      const where = `${a.archetype} win rate ${(winRate * 100).toFixed(1)}% over ${a.bouts} bouts`;
      expect(winRate, where).toBeGreaterThanOrEqual(t.iterationBand.min);
      expect(winRate, where).toBeLessThanOrEqual(t.iterationBand.max);
      // And every archetype has to actually throw punches.
      expect(a.thrown / Math.max(1, a.bouts), `${a.archetype} volume`).toBeGreaterThan(40);
    }
  }, 300_000);

  it('hits the documented accuracy, pacing and stoppage targets', async () => {
    // The other three quantitative claims in CLAUDE.md, asserted rather than
    // asserted-about. Same source of truth as the archetype band.
    const t = BALANCE_TARGETS;
    const report = await soak(t.iterationSize, 'contender', 66_000, true, 40);
    expect(report.failures).toEqual([]);

    const accuracy = report.meanLandPercent / 100;
    expect(accuracy, `accuracy ${report.meanLandPercent.toFixed(1)}%`).toBeGreaterThanOrEqual(t.accuracy.min);
    expect(accuracy, `accuracy ${report.meanLandPercent.toFixed(1)}%`).toBeLessThanOrEqual(t.accuracy.max);

    expect(report.meanRounds, `mean rounds ${report.meanRounds.toFixed(2)}`).toBeGreaterThanOrEqual(t.meanRounds.min);
    expect(report.meanRounds, `mean rounds ${report.meanRounds.toFixed(2)}`).toBeLessThanOrEqual(t.meanRounds.max);

    const stoppages = (report.outcomes.ko + report.outcomes.tko) / Math.max(1, report.bouts);
    expect(stoppages, `stoppage rate ${(stoppages * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(t.stoppageRate.min);
    expect(stoppages, `stoppage rate ${(stoppages * 100).toFixed(1)}%`).toBeLessThanOrEqual(t.stoppageRate.max);
  }, 300_000);

  it('produces reproducible results across identical runs', () => {
    const args = { bouts: 24, json: null, difficulty: 'contender' as const, seed: 64_000, mirror: false };
    const a = runSoak(args);
    const b = runSoak(args);
    expect(b.hashes).toEqual(a.hashes);
    expect(b.outcomes).toEqual(a.outcomes);
    expect(b.meanRounds).toBe(a.meanRounds);
  }, 300_000);

  it('does not leak memory across a long batch', async () => {
    // A crude but effective check: heap growth must not scale with bout count.
    if (typeof globalThis.gc === 'function') globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    await soak(150, 'club', 65_000, false);
    if (typeof globalThis.gc === 'function') globalThis.gc();
    const after = process.memoryUsage().heapUsed;
    // Allow generous headroom for V8 not having collected; a real leak from
    // 150 bouts would be far larger than this.
    expect((after - before) / 1_000_000).toBeLessThan(220);
  }, 300_000);
});
