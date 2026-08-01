/**
 * Outcomes and scoring.
 *
 * A bout must be able to end by knockout, by technical knockout and by the
 * judges' cards, and the cards must reconcile with the rounds that were
 * actually scored.
 */
import { describe, expect, it } from 'vitest';
import { simulateAiBout } from '@sim/runner';
import { BoutSim } from '@sim/bout';
import { makeRuleset } from '@data/rulesets';
import { ROSTER } from '@data/fighters';
import { MIRROR_ROSTER } from '@data/mirror';
import { DIFFICULTIES } from '@ai/profiles';
import { buildScorecards, decisionWinner, emptyRoundScore, JUDGES, scoreRound } from '@sim/scoring';
import { Rng } from '@sim/rng';
import { emptyCommand, type BoutOutcome, type RoundScore } from '@sim/types';

/** Runs a spread of seeds and collects which outcome kinds appeared. */
function sampleOutcomes(count: number): { kinds: Set<string>; outcomes: BoutOutcome[] } {
  const kinds = new Set<string>();
  const outcomes: BoutOutcome[] = [];
  for (let i = 0; i < count; i++) {
    const a = MIRROR_ROSTER[i % MIRROR_ROSTER.length];
    const b = MIRROR_ROSTER[(i * 3 + 1) % MIRROR_ROSTER.length];
    if (a.id === b.id) continue;
    const r = simulateAiBout({
      seed: 9000 + i,
      ruleset: makeRuleset(([3, 6, 10] as const)[i % 3], 'broadcast'),
      venueId: 'ironworks',
      fighters: [a, b],
    });
    kinds.add(r.outcome.kind);
    outcomes.push(r.outcome);
  }
  return { kinds, outcomes };
}

describe('bout outcomes', () => {
  it('reaches knockout, technical knockout and decision across a sample', () => {
    const { kinds } = sampleOutcomes(120);
    expect(kinds.has('ko'), 'no knockout occurred in the sample').toBe(true);
    expect(kinds.has('tko'), 'no technical knockout occurred in the sample').toBe(true);
    expect(kinds.has('decision'), 'no decision occurred in the sample').toBe(true);
  });

  it('never returns a decision before the final round', () => {
    for (let i = 0; i < 60; i++) {
      const rounds = ([3, 6, 10] as const)[i % 3];
      const r = simulateAiBout({
        seed: 400 + i,
        ruleset: makeRuleset(rounds, 'broadcast'),
        venueId: 'harbourdome',
        fighters: [ROSTER[i % ROSTER.length], ROSTER[(i * 5 + 3) % ROSTER.length]],
      });
      if (r.outcome.kind === 'decision' || r.outcome.kind === 'draw') {
        expect(r.outcome.round).toBe(rounds);
      } else {
        expect(r.outcome.round).toBeLessThanOrEqual(rounds);
        expect(r.outcome.round).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('scorecards reconcile with their round scores', () => {
    const { outcomes } = sampleOutcomes(60);
    for (const o of outcomes) {
      expect(o.scorecards.length).toBe(3);
      for (const card of o.scorecards) {
        const t0 = card.rounds.reduce((s, r) => s + r[0], 0);
        const t1 = card.rounds.reduce((s, r) => s + r[1], 0);
        expect(t0).toBe(card.totals[0]);
        expect(t1).toBe(card.totals[1]);
        for (const [a, b] of card.rounds) {
          // Ten-point-must: one fighter always takes ten.
          expect(Math.max(a, b)).toBe(10);
          expect(Math.min(a, b)).toBeGreaterThanOrEqual(6);
        }
      }
    }
  });

  it('agrees with the cards it reports for a decision', () => {
    const { outcomes } = sampleOutcomes(80);
    for (const o of outcomes) {
      if (o.kind !== 'decision' && o.kind !== 'draw') continue;
      expect(decisionWinner(o.scorecards)).toBe(o.winner);
    }
  });

  it('a knocked-down fighter cannot win the round on any card', () => {
    const rng = new Rng(4);
    const score: RoundScore = {
      ...emptyRoundScore(1),
      clean: [50, 1],
      aggression: [20, 0],
      ringControl: [20, 0],
      defense: [10, 0],
      knockdowns: [1, 0], // corner 0 was put down
    };
    for (const j of JUDGES) {
      const [a, b] = scoreRound(score, j, rng);
      expect(b).toBe(10);
      expect(a).toBeLessThanOrEqual(9);
    }
  });

  it('scores a round with no activity even', () => {
    const rng = new Rng(11);
    const [a, b] = scoreRound(emptyRoundScore(1), JUDGES[0], rng);
    expect(a).toBe(10);
    expect(b).toBe(10);
  });

  it('builds one card per judge', () => {
    const rng = new Rng(2);
    const cards = buildScorecards([emptyRoundScore(1), emptyRoundScore(2)], rng);
    expect(cards.length).toBe(JUDGES.length);
    expect(cards[0].rounds.length).toBe(2);
  });

  it('resolves a bout even when neither fighter does anything', () => {
    // Two statues must still reach the final bell and a decision, not hang.
    const sim = new BoutSim({
      seed: 5,
      ruleset: makeRuleset(3, 'brisk'),
      venueId: 'ironworks',
      fighters: [MIRROR_ROSTER[0], MIRROR_ROSTER[1]],
    });
    let ticks = 0;
    while (!sim.isComplete && ticks < 60 * 60 * 30) {
      sim.tick([emptyCommand(), emptyCommand()]);
      ticks++;
    }
    expect(sim.isComplete).toBe(true);
    expect(sim.state.outcome).not.toBeNull();
    expect(sim.state.outcome!.kind === 'draw' || sim.state.outcome!.kind === 'decision').toBe(true);
  });

  it('counts a fighter out when they cannot beat the count', () => {
    const sim = new BoutSim({
      seed: 6,
      ruleset: makeRuleset(3, 'broadcast'),
      venueId: 'ironworks',
      fighters: [MIRROR_ROSTER[0], MIRROR_ROSTER[1]],
    });
    while (sim.state.phase === 'intro') sim.tick([emptyCommand(), emptyCommand()]);
    // Put corner 1 down in the worst possible condition and never let them tap.
    const f = sim.state.fighters[1];
    f.headTrauma = 1;
    f.bodyTrauma = 1;
    f.exertion = 1;
    f.resilience = f.resilienceMax * 0.32;
    f.composure = 0;
    f.balance = 0;

    let ticks = 0;
    while (!sim.isComplete && ticks < 60 * 120) {
      sim.tick([emptyCommand(), emptyCommand()]);
      ticks++;
    }
    expect(sim.state.outcome?.kind).toBe('ko');
    expect(sim.state.outcome?.winner).toBe(0);
  });

  it('ends the round on the three-knockdown rule', () => {
    const rules = makeRuleset(6, 'broadcast');
    expect(rules.threeKnockdownRule).toBe(true);
    expect(rules.knockdownsForTko).toBe(3);
  });

  it('never produces an impossible result', () => {
    for (let i = 0; i < 60; i++) {
      const r = simulateAiBout(
        {
          seed: 20_000 + i,
          ruleset: makeRuleset(6, 'broadcast'),
          venueId: 'goldreef',
          fighters: [ROSTER[i % ROSTER.length], ROSTER[(i * 7 + 2) % ROSTER.length]],
        },
        { difficulty: DIFFICULTIES.legend },
      );
      expect(Number.isFinite(r.ticks)).toBe(true);
      expect(r.stats[0].landed).toBeLessThanOrEqual(r.stats[0].thrown);
      expect(r.stats[1].landed).toBeLessThanOrEqual(r.stats[1].thrown);
      expect(r.stats[0].percent).toBeGreaterThanOrEqual(0);
      expect(r.stats[0].percent).toBeLessThanOrEqual(100);
      if (r.outcome.kind === 'ko' || r.outcome.kind === 'tko') {
        expect(r.outcome.winner).not.toBeNull();
      }
    }
  });
});
