/**
 * The career state machine.
 *
 * Deterministic from (seed, player decisions). Every mutation goes through a
 * function here, so a career can be replayed, fast-forwarded and tested
 * without a renderer.
 *
 * The shape follows the design the research established: an open challenge
 * ladder where beating a higher-ranked fighter exchanges ranks, purses that
 * are a legacy score rather than a training currency, training awarded after
 * bouts, a finite career with decline, and retirement as a conclusion rather
 * than a failure state.
 */
import { Rng } from '@sim/rng';
import { clamp, clamp01 } from '@sim/fixed';
import type { BoutOutcome, FighterDefinition } from '@sim/types';
import { makeRuleset } from '@data/rulesets';
import { ROSTER, getFighter } from '@data/fighters';
import { VENUES } from '@data/venues';
import type { DifficultyId } from '@ai/profiles';
import { applyTraining, rollTrainingSlate } from './training';
import {
  CAREER_RULES,
  type BoutRecord,
  type CareerEnding,
  type CareerStage,
  type CareerState,
  type LadderEntry,
  type LegacyRecord,
  type PendingChallenge,
} from './types';

export const CAREER_VERSION = 4;

/** The rank the player occupies before they have beaten anybody. */
export const UNRANKED = 9;

/**
 * Purse by opponent rank. A table rather than a formula because `Math.pow` is
 * not guaranteed bit-identical across engines, and every career number has to
 * reproduce exactly.
 */
const PURSE_BY_RANK: Record<number, number> = {
  1: 420_000,
  2: 260_000,
  3: 170_000,
  4: 110_000,
  5: 70_000,
  6: 44_000,
  7: 26_000,
  8: 14_000,
  9: 8_000,
};

/** A title bout pays a multiple of the ordinary purse for that rank. */
const TITLE_MULTIPLIER = 2.5;
/** Share of the purse a losing fighter still collects. */
const LOSER_SHARE = 0.38;
const DRAW_SHARE = 0.62;

export function purseFor(opponentRank: number, titleBout: boolean): number {
  const base = PURSE_BY_RANK[clamp(Math.round(opponentRank), 1, 9)] ?? PURSE_BY_RANK[9];
  return titleBout ? Math.round(base * TITLE_MULTIPLIER) : base;
}

/** Scheduled distance grows with the stakes. */
export function roundsFor(opponentRank: number, titleBout: boolean): 3 | 6 | 10 {
  if (titleBout) return 10;
  if (opponentRank >= 7) return 3;
  if (opponentRank >= 4) return 6;
  return 10;
}

export function stageFor(boutIndex: number, wear: number): CareerStage {
  if (boutIndex >= CAREER_RULES.agingStartsAt + 5 || wear > 26) return 'declining';
  if (boutIndex >= CAREER_RULES.agingStartsAt || wear > 18) return 'veteran';
  if (boutIndex >= 7) return 'prime';
  if (boutIndex >= 3) return 'developing';
  return 'prospect';
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export function createCareer(seed: number, player: FighterDefinition, difficulty: DifficultyId): CareerState {
  const rng = new Rng(seed);
  const ladder: LadderEntry[] = ROSTER.map((r) => ({
    fighterId: r.id,
    rank: r.baseRank,
    wins: r.startRecord.wins,
    losses: r.startRecord.losses,
    draws: r.startRecord.draws,
    kos: r.startRecord.kos,
    bouts: 0,
    age: r.age,
    form: [],
    retired: false,
    earnings: r.startRecord.wins * 60_000,
    wear: 0,
  }));

  const state: CareerState = {
    version: CAREER_VERSION,
    seed,
    rngState: rng.save(),
    createdAtBout: 0,
    phase: 'select_opponent',
    difficulty,
    player,
    playerRank: UNRANKED,
    titleHolderId: 'silas_orrin',
    isChampion: false,
    titleDefences: 0,
    boutIndex: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    kos: 0,
    consecutiveLosses: 0,
    earnings: 0,
    availableFunds: 0,
    wear: 0,
    stage: 'prospect',
    ladder,
    history: [],
    offeredOpponents: [],
    trainingSlate: [],
    trainingPicks: 0,
    trainingLog: [],
    pendingChallenge: null,
    rebuildUsed: false,
    ending: null,
    news: [],
  };

  state.offeredOpponents = legalOpponents(state);
  return state;
}

/** Restores the career RNG, runs `fn`, and stores the advanced state back. */
function withRng<T>(state: CareerState, fn: (rng: Rng) => T): T {
  const rng = new Rng(state.seed);
  rng.restore(state.rngState);
  const result = fn(rng);
  state.rngState = rng.save();
  return result;
}

// ---------------------------------------------------------------------------
// Opponent selection
// ---------------------------------------------------------------------------

/**
 * Which opponents the player may legally face.
 *
 * A prospect may look one or two ranks up. After a win the window widens to
 * three; after a loss it narrows to one. Anyone ranked below the player is
 * always available — which is exactly the trap the challenge system exists to
 * close, since ducking upward costs rank.
 */
export function legalOpponents(state: CareerState): string[] {
  if (state.ending) return [];
  const active = state.ladder.filter((e) => !e.retired);

  let reach: number;
  if (state.boutIndex === 0) reach = CAREER_RULES.challengeUpFirstBout;
  else {
    const last = state.history[state.history.length - 1];
    reach = last?.result === 'win' ? CAREER_RULES.challengeUpAfterWin : CAREER_RULES.challengeUpAfterLoss;
  }

  const best = state.playerRank - reach;
  return active
    .filter((e) => e.rank >= best)
    .sort((a, b) => a.rank - b.rank)
    .map((e) => e.fighterId);
}

export function isTitleBout(state: CareerState, opponentId: string): boolean {
  const entry = state.ladder.find((e) => e.fighterId === opponentId);
  if (!entry) return false;
  // Either the player is challenging for the belt, or defending it.
  return entry.rank === 1 || (state.isChampion && state.playerRank === 1);
}

/** Everything the pre-fight screen needs, computed the same way the result will be. */
export interface BoutOffer {
  opponentId: string;
  opponentName: string;
  opponentRank: number;
  rounds: 3 | 6 | 10;
  purse: number;
  titleBout: boolean;
  /** Rank the player would hold after a win, and after a loss. */
  rankIfWin: number;
  rankIfLoss: number;
  venueId: string;
}

export function describeBout(state: CareerState, opponentId: string): BoutOffer {
  const entry = state.ladder.find((e) => e.fighterId === opponentId);
  if (!entry) throw new Error(`Opponent not on the ladder: ${opponentId}`);
  const def = getFighter(opponentId);
  const title = isTitleBout(state, opponentId);
  const rounds = roundsFor(entry.rank, title);

  return {
    opponentId,
    opponentName: def.displayName,
    opponentRank: entry.rank,
    rounds,
    purse: purseFor(entry.rank, title),
    titleBout: title,
    rankIfWin: entry.rank < state.playerRank ? entry.rank : state.playerRank,
    rankIfLoss: entry.rank > state.playerRank ? entry.rank : state.playerRank,
    venueId: venueForRank(entry.rank),
  };
}

/** Bigger fights happen in bigger rooms. */
export function venueForRank(rank: number): string {
  if (rank <= 2) return VENUES[2].id;
  if (rank <= 5) return VENUES[1].id;
  return VENUES[0].id;
}

/** Builds the simulation config for a chosen bout. Seeded from the career. */
export function boutConfigFor(state: CareerState, opponentId: string) {
  const offer = describeBout(state, opponentId);
  const opponent = scaledOpponent(state, opponentId);
  return {
    seed: state.seed * 7919 + state.boutIndex * 104_729 + 13,
    ruleset: makeRuleset(offer.rounds, 'broadcast'),
    venueId: offer.venueId,
    fighters: [state.player, opponent] as [FighterDefinition, FighterDefinition],
    offer,
  };
}

/**
 * Opponents age and wear along with the player, so a rematch late in a career
 * is genuinely a different fight.
 */
export function scaledOpponent(state: CareerState, opponentId: string): FighterDefinition {
  const base = getFighter(opponentId);
  const entry = state.ladder.find((e) => e.fighterId === opponentId);
  if (!entry) return base;

  const decline = clamp01(entry.wear / 40) * 12;
  const seasoning = Math.min(entry.bouts * 0.5, 4);
  const adj = seasoning - decline;

  const shift = (v: number): number => clamp(Math.round((v + adj) * 10) / 10, 1, CAREER_RULES.hardCap);
  return {
    ...base,
    ratings: {
      power: shift(base.ratings.power),
      stamina: shift(base.ratings.stamina),
      speed: shift(base.ratings.speed),
      defense: shift(base.ratings.defense),
    },
    secondary: { ...base.secondary },
    body: { ...base.body },
    style: { ...base.style },
    appearance: { ...base.appearance },
  };
}

// ---------------------------------------------------------------------------
// Result resolution
// ---------------------------------------------------------------------------

/**
 * Applies a completed bout: rank exchange, purse, record, wear, ageing, the
 * world's own results, the training slate, and any incoming challenge.
 */
export function resolveBout(state: CareerState, opponentId: string, outcome: BoutOutcome): BoutRecord {
  const offer = describeBout(state, opponentId);
  const entry = state.ladder.find((e) => e.fighterId === opponentId)!;
  const playerWon = outcome.winner === 0;
  const drew = outcome.winner === null;
  const result: 'win' | 'loss' | 'draw' = drew ? 'draw' : playerWon ? 'win' : 'loss';

  const rankBefore = state.playerRank;
  const oppRankBefore = entry.rank;

  // --- Rank exchange ----------------------------------------------------
  // Beating someone above you takes their place. Losing to someone below you
  // gives them yours. That single rule is the whole progression system.
  if (result === 'win' && oppRankBefore < rankBefore) {
    state.playerRank = oppRankBefore;
    entry.rank = rankBefore === UNRANKED ? oppRankBefore + 1 : rankBefore;
    normaliseLadder(state);
  } else if (result === 'loss' && oppRankBefore > rankBefore) {
    state.playerRank = oppRankBefore;
    entry.rank = rankBefore;
    normaliseLadder(state);
  }

  // --- Title ------------------------------------------------------------
  let titleDefence = false;
  if (offer.titleBout && result === 'win') {
    if (state.isChampion) {
      state.titleDefences++;
      titleDefence = true;
    } else {
      state.isChampion = true;
      state.playerRank = 1;
      normaliseLadder(state);
    }
  } else if (offer.titleBout && result === 'loss' && state.isChampion) {
    state.isChampion = false;
  }

  // --- Purse ------------------------------------------------------------
  const share = result === 'win' ? 1 : result === 'draw' ? DRAW_SHARE : LOSER_SHARE;
  const purse = Math.round(offer.purse * share);
  state.earnings += purse;
  state.availableFunds += purse;
  entry.earnings += Math.round(offer.purse * (result === 'win' ? LOSER_SHARE : 1));

  // --- Records ----------------------------------------------------------
  state.boutIndex++;
  if (result === 'win') {
    state.wins++;
    state.consecutiveLosses = 0;
    if (outcome.kind === 'ko' || outcome.kind === 'tko') state.kos++;
  } else if (result === 'loss') {
    state.losses++;
    state.consecutiveLosses++;
  } else {
    state.draws++;
    state.consecutiveLosses = 0;
  }

  entry.bouts++;
  if (result === 'win') entry.losses++;
  else if (result === 'loss') {
    entry.wins++;
    if (outcome.kind === 'ko' || outcome.kind === 'tko') entry.kos++;
  } else entry.draws++;
  entry.form.push(result === 'win' ? 'L' : result === 'loss' ? 'W' : 'D');
  if (entry.form.length > 5) entry.form.shift();

  // --- Wear and ageing --------------------------------------------------
  // Distance, damage and knockdowns all leave a mark. A fighter who is
  // stopped ages faster than one who wins comfortably.
  const punishment =
    offer.rounds * 0.35 +
    (result === 'loss' ? 1.4 : 0) +
    (outcome.kind === 'ko' || outcome.kind === 'tko' ? (playerWon ? 0.2 : 2.2) : 0);
  state.wear += punishment;
  entry.wear += punishment * 0.7;
  entry.age += 0.25;

  state.stage = stageFor(state.boutIndex, state.wear);
  applyAgeing(state);

  const record: BoutRecord = {
    index: state.boutIndex,
    opponentId,
    opponentName: offer.opponentName,
    playerRankBefore: rankBefore,
    opponentRankBefore: oppRankBefore,
    playerRankAfter: state.playerRank,
    rounds: offer.rounds,
    venueId: offer.venueId,
    result,
    kind: outcome.kind,
    reasonKey: outcome.reasonKey,
    endedRound: outcome.round,
    purse,
    scorecards: outcome.scorecards.map((c) => [c.totals[0], c.totals[1]] as [number, number]),
    titleBout: offer.titleBout,
    seed: state.seed,
  };
  state.history.push(record);

  if (titleDefence) {
    state.news.unshift(`news.titleDefence|${state.titleDefences}`);
  }

  // --- The rest of the ladder fights too --------------------------------
  withRng(state, (rng) => simulateWorldRound(state, rng, opponentId));

  // --- Training ---------------------------------------------------------
  state.trainingPicks =
    result === 'win' ? CAREER_RULES.picksOnWin : result === 'draw' ? CAREER_RULES.picksOnDraw : CAREER_RULES.picksOnLoss;
  withRng(state, (rng) => {
    state.trainingSlate = rollTrainingSlate(rng, state.player, state.stage, CAREER_RULES.slateSize);
  });
  state.phase = 'training';

  return record;
}

/** Ranks must stay a dense 1..n permutation after any exchange. */
function normaliseLadder(state: CareerState): void {
  const active = state.ladder.filter((e) => !e.retired);
  // The player occupies a rank too; sort everyone and reassign densely.
  const slots: { id: string | null; rank: number }[] = active.map((e) => ({ id: e.fighterId, rank: e.rank }));
  slots.push({ id: null, rank: state.playerRank });
  slots.sort((a, b) => a.rank - b.rank || (a.id === null ? -1 : 1));

  slots.forEach((s, i) => {
    const rank = i + 1;
    if (s.id === null) state.playerRank = rank;
    else state.ladder.find((e) => e.fighterId === s.id)!.rank = rank;
  });
}

/** Decline. Once the career clock passes the ageing threshold, ratings slip. */
function applyAgeing(state: CareerState): void {
  if (state.boutIndex < CAREER_RULES.agingStartsAt) return;
  const past = state.boutIndex - CAREER_RULES.agingStartsAt + 1;
  // The slide accelerates, and hard miles make it worse.
  const rate = 0.5 + past * 0.22 + clamp01(state.wear / 45) * 0.9;

  const r = state.player.ratings;
  const s = state.player.secondary;
  // Speed and stamina go first; power and experience hold on longest.
  r.speed = clamp(Math.round((r.speed - rate * 1.25) * 10) / 10, 1, CAREER_RULES.hardCap);
  r.stamina = clamp(Math.round((r.stamina - rate * 1.1) * 10) / 10, 1, CAREER_RULES.hardCap);
  r.defense = clamp(Math.round((r.defense - rate * 0.8) * 10) / 10, 1, CAREER_RULES.hardCap);
  r.power = clamp(Math.round((r.power - rate * 0.4) * 10) / 10, 1, CAREER_RULES.hardCap);
  s.footwork = clamp(Math.round((s.footwork - rate * 1.2) * 10) / 10, 1, CAREER_RULES.hardCap);
  s.recovery = clamp(Math.round((s.recovery - rate * 1.0) * 10) / 10, 1, CAREER_RULES.hardCap);
  s.chin = clamp(Math.round((s.chin - rate * 0.9) * 10) / 10, 1, CAREER_RULES.hardCap);
  // A veteran reads the fight better even as the legs go.
  s.composure = clamp(Math.round((s.composure + rate * 0.25) * 10) / 10, 1, CAREER_RULES.hardCap);
}

// ---------------------------------------------------------------------------
// World simulation
// ---------------------------------------------------------------------------

/**
 * Resolves bouts among the rest of the ladder.
 *
 * These are settled statistically from ratings rather than by running the full
 * combat simulation: a career fast-forward has to complete in seconds, and the
 * outcome distribution from the statistical model is calibrated against the
 * real simulation. Recorded as design decision D-011.
 */
function simulateWorldRound(state: CareerState, rng: Rng, skipId: string): void {
  const active = state.ladder.filter((e) => !e.retired && e.fighterId !== skipId);
  rng.shuffle(active);

  for (let i = 0; i + 1 < active.length; i += 2) {
    const a = active[i];
    const b = active[i + 1];
    // Fighters far apart on the ladder do not meet.
    if (Math.abs(a.rank - b.rank) > 4) continue;

    const sa = fighterStrength(state, a);
    const sb = fighterStrength(state, b);
    const total = sa + sb;
    const roll = rng.next() * total;
    const aWins = roll < sa;
    const winner = aWins ? a : b;
    const loser = aWins ? b : a;

    winner.wins++;
    loser.losses++;
    winner.bouts++;
    loser.bouts++;
    const stoppage = rng.chance(0.34);
    if (stoppage) winner.kos++;
    winner.form.push('W');
    loser.form.push('L');
    if (winner.form.length > 5) winner.form.shift();
    if (loser.form.length > 5) loser.form.shift();
    winner.earnings += purseFor(loser.rank, false);
    loser.earnings += Math.round(purseFor(winner.rank, false) * LOSER_SHARE);

    const wear = 1.5 + (stoppage ? 1.2 : 0);
    winner.wear += wear * 0.6;
    loser.wear += wear;
    winner.age += 0.2;
    loser.age += 0.2;

    // Rank exchange applies to the world exactly as it does to the player.
    if (winner.rank > loser.rank) {
      const t = winner.rank;
      winner.rank = loser.rank;
      loser.rank = t;
      state.news.unshift(`news.upset|${winner.fighterId}|${loser.fighterId}`);
    }
  }

  // Ageing and retirement for the world.
  for (const e of state.ladder) {
    if (e.retired) continue;
    if (e.age >= 38 || e.wear >= 42 || (e.form.length >= 4 && e.form.slice(-4).every((f) => f === 'L'))) {
      // The champion never vacates while the player is still chasing them.
      if (e.rank === 1 && !state.isChampion) continue;
      e.retired = true;
      state.news.unshift(`news.retired|${e.fighterId}`);
    }
  }
  if (state.ladder.some((e) => e.retired)) normaliseLadder(state);
  if (state.news.length > 12) state.news.length = 12;
}

/** Relative strength used only by the statistical world model. */
function fighterStrength(state: CareerState, e: LadderEntry): number {
  const def = scaledOpponent(state, e.fighterId);
  const r = def.ratings;
  const base = r.power * 0.9 + r.stamina * 0.8 + r.speed * 0.95 + r.defense * 0.95;
  const form = e.form.filter((f) => f === 'W').length - e.form.filter((f) => f === 'L').length;
  return Math.max(20, base + form * 6 - e.wear * 0.8);
}

// ---------------------------------------------------------------------------
// Training and challenges
// ---------------------------------------------------------------------------

export function takeTraining(state: CareerState, optionId: string): void {
  if (state.trainingPicks <= 0) return;
  const idx = state.trainingSlate.findIndex((o) => o.id === optionId);
  if (idx < 0) return;
  const option = state.trainingSlate[idx];
  applyTraining(state.player, option);
  state.wear = Math.max(0, state.wear + option.wearCost);
  state.trainingLog.push(option.id);
  state.trainingSlate.splice(idx, 1);
  state.trainingPicks--;
}

/** Ends the training step and moves the career on, retiring if it must. */
export function finishTraining(state: CareerState): void {
  state.trainingSlate = [];
  state.trainingPicks = 0;
  state.stage = stageFor(state.boutIndex, state.wear);

  if (state.boutIndex >= CAREER_RULES.maxBouts) {
    retire(state, 'ending.boutLimit');
    return;
  }
  if (state.consecutiveLosses >= CAREER_RULES.forcedRetirementLossStreak) {
    // A bad run early in a career is a setback, not a deletion. Once per
    // career the fighter rebuilds from the bottom of the ladder instead of
    // being retired; after that the streak rule applies in full.
    if (!state.rebuildUsed && state.boutIndex < CAREER_RULES.rebuildAvailableBefore) {
      state.rebuildUsed = true;
      state.consecutiveLosses = 0;
      const active = state.ladder.filter((e) => !e.retired);
      state.playerRank = active.length + 1;
      normaliseLadder(state);
      state.news.unshift('news.rebuild');
    } else {
      retire(state, 'ending.lossStreak');
      return;
    }
  }

  // A well-placed fighter attracts challenges they cannot simply ignore.
  const challenge = withRng(state, (rng) => rollChallenge(state, rng));
  if (challenge) {
    state.pendingChallenge = challenge;
    state.phase = 'challenge';
    return;
  }

  state.offeredOpponents = legalOpponents(state);
  state.phase = 'select_opponent';
}

/**
 * Fighters ranked one to four places below a well-placed boxer can demand a
 * fight. Refusing is legal and costs the challenger's rank — rank is a
 * position you have to keep defending, not a trophy.
 */
function rollChallenge(state: CareerState, rng: Rng): PendingChallenge | null {
  if (state.playerRank > 4) return null;
  if (state.boutIndex >= CAREER_RULES.maxBouts - 1) return null;
  if (!rng.chance(0.45)) return null;

  const candidates = state.ladder.filter(
    (e) => !e.retired && e.rank > state.playerRank && e.rank <= state.playerRank + 4,
  );
  if (candidates.length === 0) return null;

  const pick = rng.pick(candidates);
  const def = getFighter(pick.fighterId);
  const title = state.isChampion;
  return {
    challengerId: pick.fighterId,
    challengerName: def.displayName,
    challengerRank: pick.rank,
    rounds: roundsFor(pick.rank, title),
    purse: purseFor(pick.rank, title),
    refusalRank: pick.rank,
  };
}

export function acceptChallenge(state: CareerState): string {
  const c = state.pendingChallenge;
  if (!c) throw new Error('No challenge pending');
  state.pendingChallenge = null;
  state.offeredOpponents = [c.challengerId];
  state.phase = 'select_opponent';
  return c.challengerId;
}

/** Refusing drops the player to the challenger's rank and offers the exit. */
export function refuseChallenge(state: CareerState): void {
  const c = state.pendingChallenge;
  if (!c) throw new Error('No challenge pending');
  const challenger = state.ladder.find((e) => e.fighterId === c.challengerId)!;
  const playerRank = state.playerRank;
  state.playerRank = c.refusalRank;
  challenger.rank = playerRank;
  if (state.isChampion) state.isChampion = false;
  normaliseLadder(state);
  state.pendingChallenge = null;
  state.news.unshift(`news.refused|${c.challengerId}`);
  state.offeredOpponents = legalOpponents(state);
  state.phase = 'select_opponent';
}

// ---------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------

export function retire(state: CareerState, reasonKey: CareerEnding['reasonKey'] = 'ending.voluntary'): CareerEnding {
  const peakRank = state.history.reduce((best, h) => Math.min(best, h.playerRankAfter), state.playerRank);
  const ending: CareerEnding = {
    reasonKey,
    finalRank: state.playerRank,
    wasChampion: state.isChampion || state.history.some((h) => h.titleBout && h.result === 'win'),
    titleDefences: state.titleDefences,
    earnings: state.earnings,
    record: { wins: state.wins, losses: state.losses, draws: state.draws, kos: state.kos },
    gradeKey: gradeFor(state, peakRank),
    boutsFought: state.boutIndex,
  };
  state.ending = ending;
  state.phase = 'retired';
  return ending;
}

/**
 * A single legacy grade. Weighted toward what the career actually achieved —
 * the belt, the defences and the money — rather than a clean record built on
 * safe fights.
 */
export function gradeFor(state: CareerState, peakRank: number): string {
  let points = 0;
  points += Math.max(0, 10 - peakRank) * 4;
  points += state.wins * 2.2;
  points += state.kos * 1.6;
  points -= state.losses * 1.4;
  points += state.titleDefences * 7;
  if (state.isChampion || state.history.some((h) => h.titleBout && h.result === 'win')) points += 22;
  points += (state.earnings / CAREER_RULES.legacyTarget) * 26;

  if (points >= 168) return 'grade.allTime';
  if (points >= 132) return 'grade.great';
  if (points >= 100) return 'grade.champion';
  if (points >= 68) return 'grade.contender';
  if (points >= 38) return 'grade.journeyman';
  return 'grade.clubFighter';
}

export function toLegacyRecord(state: CareerState): LegacyRecord {
  const peakRank = state.history.reduce((best, h) => Math.min(best, h.playerRankAfter), state.playerRank);
  return {
    name: state.player.displayName,
    nickname: state.player.nickname,
    earnings: state.earnings,
    wins: state.wins,
    losses: state.losses,
    draws: state.draws,
    kos: state.kos,
    peakRank,
    titleDefences: state.titleDefences,
    gradeKey: state.ending?.gradeKey ?? gradeFor(state, peakRank),
    difficulty: state.difficulty,
  };
}

/** Bouts remaining before the mandatory end of the career. */
export function boutsRemaining(state: CareerState): number {
  return Math.max(0, CAREER_RULES.maxBouts - state.boutIndex);
}
