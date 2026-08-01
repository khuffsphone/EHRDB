/**
 * Career progression.
 *
 * Covers the acceptance gate directly: a career can be created, advanced, won
 * and lost, completed and retired, with no dead ends and no incoherent state.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '@sim/rng';
import {
  CAREER_VERSION,
  UNRANKED,
  acceptChallenge,
  boutConfigFor,
  boutsRemaining,
  createCareer,
  describeBout,
  finishTraining,
  gradeFor,
  legalOpponents,
  purseFor,
  refuseChallenge,
  resolveBout,
  retire,
  roundsFor,
  takeTraining,
  toLegacyRecord,
} from '@career/career';
import { CAREER_RULES, type CareerState } from '@career/types';
import { applyGain, rollTrainingSlate, TRAINING_CATALOGUE_IDS } from '@career/training';
import { BASE_RATING, CREATION_CAP, POINT_POOL, STYLE_BASES, buildFighter, defaultChoices, pointsRemaining, validateChoices } from '@career/creation';
import { simulateAiBout } from '@sim/runner';
import { DIFFICULTIES } from '@ai/profiles';
import type { BoutOutcome, FighterDefinition } from '@sim/types';

function player(name = 'Test Boxer'): FighterDefinition {
  const c = defaultChoices();
  c.name = name;
  return buildFighter(c);
}

function newCareer(seed = 1): CareerState {
  return createCareer(seed, player(), 'contender');
}

/** A synthetic outcome so career logic can be tested without running a bout. */
function outcome(winner: 0 | 1 | null, kind: BoutOutcome['kind'] = 'decision', round = 3): BoutOutcome {
  return {
    kind,
    winner,
    round,
    tick: 0,
    reasonKey: 'outcome.decision.unanimous',
    scorecards: [
      { judgeId: 'judge.vance', rounds: [[10, 9]], totals: winner === 0 ? [30, 27] : [27, 30] },
      { judgeId: 'judge.okonjo', rounds: [[10, 9]], totals: winner === 0 ? [30, 27] : [27, 30] },
      { judgeId: 'judge.serrano', rounds: [[10, 9]], totals: winner === 0 ? [30, 27] : [27, 30] },
    ],
  };
}

/**
 * Seats the player at a given rank and renumbers the roster densely around
 * them. Assigning `playerRank` directly would leave two fighters sharing a
 * rank, which is not a state the career can ever actually reach.
 */
function placePlayerAt(c: CareerState, rank: number): void {
  const active = c.ladder.filter((e) => !e.retired).sort((a, b) => a.rank - b.rank);
  c.playerRank = rank;
  let next = 1;
  for (const e of active) {
    if (next === rank) next++;
    e.rank = next++;
  }
}

/** The ladder must always be a dense 1..n permutation including the player. */
function assertLadderIsDense(c: CareerState): void {
  const ranks = c.ladder
    .filter((e) => !e.retired)
    .map((e) => e.rank)
    .concat(c.playerRank)
    .sort((a, b) => a - b);
  ranks.forEach((r, i) => expect(r, `ladder ranks: ${ranks.join(',')}`).toBe(i + 1));
}

describe('boxer creation', () => {
  it('spends exactly the point pool by default', () => {
    expect(pointsRemaining(defaultChoices().allocation)).toBe(0);
  });

  it('rejects an unnamed boxer and an unspent pool', () => {
    const c = defaultChoices();
    expect(validateChoices(c)).toContain('creation.error.name');
    c.name = 'Someone';
    expect(validateChoices(c)).toEqual([]);
    c.allocation.power -= 3;
    expect(validateChoices(c)).toContain('creation.error.points');
  });

  it('gives every style base a genuine trade-off', () => {
    for (const style of STYLE_BASES) {
      const mods = Object.values(style.modifiers);
      const secondary = Object.values(style.secondary);
      if (style.archetype === 'boxer_puncher') continue; // the deliberate all-rounder
      expect(mods.some((v) => v > 0) || secondary.some((v) => v > 0), `${style.archetype} has no upside`).toBe(true);
      expect(mods.some((v) => v < 0) || secondary.some((v) => v < 0), `${style.archetype} has no cost`).toBe(true);
    }
  });

  it('has no allocation that maximises everything', () => {
    // Spending the whole pool on one rating must starve the others.
    const c = defaultChoices();
    c.name = 'Max';
    c.allocation = { power: POINT_POOL, stamina: 0, speed: 0, defense: 0 };
    // The cap prevents this from even being legal.
    expect(BASE_RATING + c.allocation.power).toBeGreaterThan(CREATION_CAP);
    expect(validateChoices(c)).toContain('creation.error.range');
  });

  it('derives secondary ratings rather than letting them be bought', () => {
    const a = buildFighter({ ...defaultChoices(), name: 'A', archetype: 'brawler' });
    const b = buildFighter({ ...defaultChoices(), name: 'B', archetype: 'out_boxer' });
    expect(a.secondary.chin).not.toBe(b.secondary.chin);
    expect(a.body.reachCm).not.toBe(b.body.reachCm);
  });
});

describe('training', () => {
  it('offers a slate of distinct, catalogued items', () => {
    const rng = new Rng(5);
    const slate = rollTrainingSlate(rng, player(), 'prospect', CAREER_RULES.slateSize);
    expect(slate.length).toBe(CAREER_RULES.slateSize);
    expect(new Set(slate.map((s) => s.id)).size).toBe(slate.length);
    for (const item of slate) expect(TRAINING_CATALOGUE_IDS).toContain(item.id);
  });

  it('applies diminishing returns above the soft cap', () => {
    const low = applyGain(50, 4, 'prime') - 50;
    const high = applyGain(90, 4, 'prime') - 90;
    expect(high).toBeLessThan(low);
  });

  it('never exceeds the hard cap', () => {
    expect(applyGain(95, 40, 'prospect')).toBeLessThanOrEqual(CAREER_RULES.hardCap);
  });

  it('improves an older fighter more slowly', () => {
    const young = applyGain(50, 4, 'prospect') - 50;
    const old = applyGain(50, 4, 'declining') - 50;
    expect(old).toBeLessThan(young);
  });

  it('actually raises the fighter when taken', () => {
    const c = newCareer();
    resolveBout(c, c.offeredOpponents[0], outcome(0));
    expect(c.phase).toBe('training');
    expect(c.trainingPicks).toBe(CAREER_RULES.picksOnWin);
    const before = { ...c.player.ratings };
    const picked = c.trainingSlate[0];
    takeTraining(c, picked.id);
    expect(c.trainingPicks).toBe(CAREER_RULES.picksOnWin - 1);
    const changed =
      c.player.ratings.power !== before.power ||
      c.player.ratings.stamina !== before.stamina ||
      c.player.ratings.speed !== before.speed ||
      c.player.ratings.defense !== before.defense ||
      Object.keys(picked.secondaryGains).length > 0;
    expect(changed).toBe(true);
  });

  it('awards fewer choices for a loss than for a win', () => {
    expect(CAREER_RULES.picksOnLoss).toBeLessThan(CAREER_RULES.picksOnWin);
  });
});

describe('the ladder', () => {
  it('starts the player unranked with a legal set of opponents', () => {
    const c = newCareer();
    expect(c.version).toBe(CAREER_VERSION);
    expect(c.playerRank).toBe(UNRANKED);
    expect(c.offeredOpponents.length).toBeGreaterThan(0);
    // A first-time prospect may look two ranks up, no further.
    const best = Math.min(...c.offeredOpponents.map((id) => c.ladder.find((e) => e.fighterId === id)!.rank));
    expect(best).toBeGreaterThanOrEqual(UNRANKED - CAREER_RULES.challengeUpFirstBout);
  });

  it('exchanges ranks when the player beats someone above them', () => {
    const c = newCareer();
    const target = c.offeredOpponents[0];
    const targetRank = c.ladder.find((e) => e.fighterId === target)!.rank;
    expect(targetRank).toBeLessThan(c.playerRank);
    resolveBout(c, target, outcome(0));
    expect(c.playerRank).toBe(targetRank);
    assertLadderIsDense(c);
  });

  it('exchanges ranks when the player loses to someone below them', () => {
    const c = newCareer();
    // Climb first so there is someone below.
    resolveBout(c, c.offeredOpponents[0], outcome(0));
    finishTraining(c);
    const below = c.ladder.filter((e) => !e.retired && e.rank > c.playerRank).sort((a, b) => a.rank - b.rank)[0];
    expect(below).toBeDefined();
    const beforeRank = c.playerRank;
    // Capture the value, not the entry: resolveBout mutates the entry in place.
    const belowRank = below.rank;
    resolveBout(c, below.fighterId, outcome(1));
    expect(c.playerRank).toBe(belowRank);
    expect(c.playerRank).toBeGreaterThan(beforeRank);
    expect(below.rank).toBe(beforeRank);
    assertLadderIsDense(c);
  });

  it('does not move the player for losing to someone ranked above them', () => {
    const c = newCareer();
    const target = c.offeredOpponents[0];
    const before = c.playerRank;
    resolveBout(c, target, outcome(1));
    expect(c.playerRank).toBe(before);
  });

  it('scales purse and distance with the stakes', () => {
    expect(purseFor(1, true)).toBeGreaterThan(purseFor(1, false));
    expect(purseFor(1, false)).toBeGreaterThan(purseFor(8, false));
    expect(roundsFor(8, false)).toBe(3);
    expect(roundsFor(5, false)).toBe(6);
    expect(roundsFor(2, false)).toBe(10);
    expect(roundsFor(1, true)).toBe(10);
  });

  it('describes a bout the same way the result will resolve it', () => {
    const c = newCareer();
    const id = c.offeredOpponents[0];
    const offer = describeBout(c, id);
    resolveBout(c, id, outcome(0));
    expect(c.playerRank).toBe(offer.rankIfWin);
    expect(c.history[0].purse).toBe(offer.purse);
  });

  it('builds a runnable bout configuration', () => {
    const c = newCareer();
    const cfg = boutConfigFor(c, c.offeredOpponents[0]);
    expect(cfg.fighters.length).toBe(2);
    expect(cfg.ruleset.rounds).toBe(cfg.offer.rounds);
    const result = simulateAiBout(
      { seed: cfg.seed, ruleset: cfg.ruleset, venueId: cfg.venueId, fighters: cfg.fighters },
      { difficulty: DIFFICULTIES.club },
    );
    expect(result.outcome).toBeDefined();
  });
});

describe('challenges', () => {
  it('accepting a challenge queues that opponent', () => {
    const c = newCareer(9);
    placePlayerAt(c, 3);
    c.pendingChallenge = {
      challengerId: c.ladder.find((e) => e.rank === 5)!.fighterId,
      challengerName: 'X',
      challengerRank: 5,
      rounds: 6,
      purse: 1000,
      refusalRank: 5,
    };
    const id = acceptChallenge(c);
    expect(c.offeredOpponents).toEqual([id]);
    expect(c.pendingChallenge).toBeNull();
  });

  it('refusing a challenge costs the challenger’s rank', () => {
    const c = newCareer(9);
    placePlayerAt(c, 3);
    assertLadderIsDense(c);
    const challenger = c.ladder.find((e) => e.rank === 5)!;
    c.pendingChallenge = {
      challengerId: challenger.fighterId,
      challengerName: 'X',
      challengerRank: 5,
      rounds: 6,
      purse: 1000,
      refusalRank: 5,
    };
    refuseChallenge(c);
    expect(c.playerRank).toBe(5);
    expect(challenger.rank).toBe(3);
    assertLadderIsDense(c);
  });
});

describe('a complete career', () => {
  it('runs to a conclusion without dead ends', () => {
    const rng = new Rng(31);
    const c = newCareer(31);
    let guard = 0;
    while (!c.ending && guard < CAREER_RULES.maxBouts * 5) {
      guard++;
      if (c.phase === 'challenge') {
        acceptChallenge(c);
        continue;
      }
      if (c.phase === 'select_opponent') {
        const legal = c.offeredOpponents.length > 0 ? c.offeredOpponents : legalOpponents(c);
        expect(legal.length, `no legal opponent at bout ${c.boutIndex}`).toBeGreaterThan(0);
        // Alternate wins and losses so both branches are exercised.
        resolveBout(c, legal[0], outcome(rng.chance(0.55) ? 0 : 1));
        assertLadderIsDense(c);
        continue;
      }
      if (c.phase === 'training') {
        while (c.trainingPicks > 0 && c.trainingSlate.length > 0) takeTraining(c, c.trainingSlate[0].id);
        finishTraining(c);
        continue;
      }
      throw new Error(`unexpected phase ${c.phase}`);
    }
    expect(c.ending).not.toBeNull();
    expect(c.boutIndex).toBeLessThanOrEqual(CAREER_RULES.maxBouts);
    expect(c.wins + c.losses + c.draws).toBe(c.boutIndex);
    expect(boutsRemaining(c)).toBeGreaterThanOrEqual(0);
  });

  it('ends at the bout cap', () => {
    const c = newCareer(2);
    c.boutIndex = CAREER_RULES.maxBouts;
    c.phase = 'training';
    finishTraining(c);
    expect(c.ending?.reasonKey).toBe('ending.boutLimit');
  });

  it('rebuilds once before retiring a losing run, then retires', () => {
    const c = newCareer(3);
    c.boutIndex = 4;
    c.consecutiveLosses = CAREER_RULES.forcedRetirementLossStreak;
    c.phase = 'training';
    finishTraining(c);
    // First time: a rebuild, not a retirement.
    expect(c.ending).toBeNull();
    expect(c.rebuildUsed).toBe(true);
    expect(c.consecutiveLosses).toBe(0);
    assertLadderIsDense(c);

    // Second time: the streak rule applies in full.
    c.consecutiveLosses = CAREER_RULES.forcedRetirementLossStreak;
    c.phase = 'training';
    finishTraining(c);
    expect(c.ending?.reasonKey).toBe('ending.lossStreak');
  });

  it('ages the fighter after the career clock passes the threshold', () => {
    const c = newCareer(4);
    c.boutIndex = CAREER_RULES.agingStartsAt - 1;
    const before = c.player.ratings.speed;
    for (let i = 0; i < 6; i++) {
      resolveBout(c, legalOpponents(c)[0], outcome(0));
      c.trainingPicks = 0;
      c.trainingSlate = [];
      if (!c.ending) finishTraining(c);
      if (c.ending) break;
    }
    expect(c.player.ratings.speed).toBeLessThan(before);
  });

  it('grades a title-winning career above a losing one', () => {
    const good = newCareer(5);
    good.wins = 16;
    good.losses = 2;
    good.kos = 10;
    good.isChampion = true;
    good.titleDefences = 4;
    good.earnings = 7_000_000;
    good.boutIndex = 18;

    const poor = newCareer(6);
    poor.wins = 3;
    poor.losses = 9;
    poor.earnings = 200_000;
    poor.boutIndex = 12;

    const goodGrade = gradeFor(good, 1);
    const poorGrade = gradeFor(poor, 8);
    expect(goodGrade).not.toBe(poorGrade);
    expect(['grade.allTime', 'grade.great', 'grade.champion']).toContain(goodGrade);
    expect(['grade.journeyman', 'grade.clubFighter']).toContain(poorGrade);
  });

  it('produces a legacy record on retirement', () => {
    const c = newCareer(7);
    c.wins = 5;
    c.earnings = 900_000;
    const ending = retire(c, 'ending.voluntary');
    const legacy = toLegacyRecord(c);
    expect(legacy.name).toBe(c.player.displayName);
    expect(legacy.earnings).toBe(900_000);
    expect(legacy.gradeKey).toBe(ending.gradeKey);
    expect(legacy.difficulty).toBe('contender');
  });

  it('is reproducible from its seed', () => {
    const play = (): string => {
      const c = newCareer(4242);
      for (let i = 0; i < 6 && !c.ending; i++) {
        if (c.phase === 'challenge') { acceptChallenge(c); continue; }
        if (c.phase === 'training') {
          while (c.trainingPicks > 0 && c.trainingSlate.length > 0) takeTraining(c, c.trainingSlate[0].id);
          finishTraining(c);
          continue;
        }
        resolveBout(c, (c.offeredOpponents[0] ?? legalOpponents(c)[0]), outcome(0));
      }
      return JSON.stringify({
        rank: c.playerRank,
        earnings: c.earnings,
        ratings: c.player.ratings,
        ladder: c.ladder.map((e) => `${e.fighterId}:${e.rank}:${e.wins}`),
      });
    };
    expect(play()).toBe(play());
  });
});
