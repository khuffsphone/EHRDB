/**
 * Recursive save validation.
 *
 * `parseSave` checks that the top-level object is JSON, carries the right
 * magic, and is at a version we can migrate. That is where the checking used
 * to stop: the career, the slots and the legacy board were cast straight to
 * their TypeScript types and handed to the game. A type assertion is not a
 * check — it compiles to nothing. A save with `"career": 7`, or a ladder whose
 * entries are strings, or a `player` missing its `ratings`, passed validation
 * cleanly and then crashed the career hub on the first property access, long
 * after the point where a useful error could be reported.
 *
 * These validators walk the whole structure. Anything that would be read by
 * the game is confirmed to be the right kind of value; anything genuinely
 * optional is defaulted. A structure that cannot be repaired is reported with
 * the path that failed, so the quarantine message can say what was wrong
 * rather than just that something was.
 *
 * The rule for repair versus rejection: a missing value that has an obviously
 * correct default is filled, because that is how forward-compatible saves work.
 * A value that is present and of the wrong kind is rejected, because that means
 * the data is not what it claims to be and guessing would invent a career the
 * player never played.
 */
import type { CareerEnding, CareerState, LadderEntry, BoutRecord, LegacyRecord, PendingChallenge, TrainingOption } from '@career/types';
import type { FighterDefinition } from '@sim/types';

export type Validated<T> = { ok: true; value: T } | { ok: false; path: string; reason: string };

function fail(path: string, reason: string): { ok: false; path: string; reason: string } {
  return { ok: false, path, reason };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A finite number. `NaN` and `Infinity` are corruption, not values. */
function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function str(v: unknown): v is string {
  return typeof v === 'string';
}

/** Reads a number, defaulting when absent but rejecting when present and wrong. */
function readNum(o: Record<string, unknown>, key: string, path: string, fallback?: number): number | { err: string } {
  const v = o[key];
  if (v === undefined || v === null) {
    if (fallback === undefined) return { err: `${path}.${key} is missing` };
    return fallback;
  }
  if (!num(v)) return { err: `${path}.${key} is not a finite number` };
  return v;
}

function readStr(o: Record<string, unknown>, key: string, path: string, fallback?: string): string | { err: string } {
  const v = o[key];
  if (v === undefined || v === null) {
    if (fallback === undefined) return { err: `${path}.${key} is missing` };
    return fallback;
  }
  if (!str(v)) return { err: `${path}.${key} is not a string` };
  return v;
}

function readBool(o: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof o[key] === 'boolean' ? (o[key] as boolean) : fallback;
}

function isErr(v: unknown): v is { err: string } {
  return isObject(v) && typeof v.err === 'string';
}

// ---------------------------------------------------------------------------
// Leaf structures
// ---------------------------------------------------------------------------

const CORE_RATINGS = ['power', 'stamina', 'speed', 'defense'] as const;
const SECONDARY_RATINGS = ['chin', 'bodyToughness', 'recovery', 'footwork', 'accuracy', 'composure'] as const;

function validateRatingBlock(v: unknown, keys: readonly string[], path: string): Validated<Record<string, number>> {
  if (!isObject(v)) return fail(path, 'is not an object');
  const out: Record<string, number> = {};
  for (const k of keys) {
    const r = readNum(v, k, path);
    if (isErr(r)) return fail(`${path}.${k}`, r.err);
    out[k] = r;
  }
  return { ok: true, value: out };
}

export function validateFighter(v: unknown, path: string): Validated<FighterDefinition> {
  if (!isObject(v)) return fail(path, 'is not an object');

  const id = readStr(v, 'id', path);
  if (isErr(id)) return fail(`${path}.id`, id.err);
  const displayName = readStr(v, 'displayName', path);
  if (isErr(displayName)) return fail(`${path}.displayName`, displayName.err);

  const ratings = validateRatingBlock(v.ratings, CORE_RATINGS, `${path}.ratings`);
  if (!ratings.ok) return ratings;
  const secondary = validateRatingBlock(v.secondary, SECONDARY_RATINGS, `${path}.secondary`);
  if (!secondary.ok) return secondary;
  const body = validateRatingBlock(v.body, ['heightCm', 'reachCm', 'massKg'], `${path}.body`);
  if (!body.ok) return body;

  if (!isObject(v.style)) return fail(`${path}.style`, 'is not an object');
  if (!str(v.style.archetype)) return fail(`${path}.style.archetype`, 'is not a string');
  if (!isObject(v.appearance)) return fail(`${path}.appearance`, 'is not an object');

  // Everything above is load-bearing. The rest is cosmetic and defaultable.
  const fighter = {
    ...(v as unknown as FighterDefinition),
    id,
    displayName,
    nickname: str(v.nickname) ? v.nickname : '',
    hometown: str(v.hometown) ? v.hometown : '',
    stance: v.stance === 'southpaw' ? 'southpaw' : 'orthodox',
  } as FighterDefinition;
  return { ok: true, value: fighter };
}

function validateLadderEntry(v: unknown, path: string): Validated<LadderEntry> {
  if (!isObject(v)) return fail(path, 'is not an object');
  const fighterId = readStr(v, 'fighterId', path);
  if (isErr(fighterId)) return fail(`${path}.fighterId`, fighterId.err);
  const rank = readNum(v, 'rank', path);
  if (isErr(rank)) return fail(`${path}.rank`, rank.err);

  const nums: Record<string, number> = {};
  for (const k of ['wins', 'losses', 'draws', 'kos', 'bouts', 'age', 'earnings', 'wear'] as const) {
    const r = readNum(v, k, path, 0);
    if (isErr(r)) return fail(`${path}.${k}`, r.err);
    nums[k] = r;
  }

  return {
    ok: true,
    value: {
      fighterId,
      rank,
      wins: nums.wins,
      losses: nums.losses,
      draws: nums.draws,
      kos: nums.kos,
      bouts: nums.bouts,
      age: nums.age,
      form: Array.isArray(v.form) ? v.form.filter(str) : [],
      retired: readBool(v, 'retired', false),
      earnings: nums.earnings,
      wear: nums.wear,
    },
  };
}

function validateBoutRecord(v: unknown, path: string): Validated<BoutRecord> {
  if (!isObject(v)) return fail(path, 'is not an object');
  for (const k of ['opponentId', 'result', 'kind'] as const) {
    if (!str(v[k])) return fail(`${path}.${k}`, 'is not a string');
  }
  for (const k of ['index', 'rounds', 'endedRound', 'purse', 'seed'] as const) {
    const r = readNum(v, k, path, 0);
    if (isErr(r)) return fail(`${path}.${k}`, r.err);
  }
  // Scorecards drive the post-fight screen; a malformed pair would crash it.
  const cards = Array.isArray(v.scorecards) ? v.scorecards : [];
  for (const c of cards) {
    if (!Array.isArray(c) || c.length !== 2 || !num(c[0]) || !num(c[1])) {
      return fail(`${path}.scorecards`, 'is not an array of [number, number]');
    }
  }
  return { ok: true, value: { ...(v as unknown as BoutRecord), scorecards: cards as [number, number][] } };
}

function validateTrainingOption(v: unknown, path: string): Validated<TrainingOption> {
  if (!isObject(v)) return fail(path, 'is not an object');
  const id = readStr(v, 'id', path);
  if (isErr(id)) return fail(`${path}.id`, id.err);
  const wearCost = readNum(v, 'wearCost', path, 0);
  if (isErr(wearCost)) return fail(`${path}.wearCost`, wearCost.err);
  return {
    ok: true,
    value: {
      ...(v as unknown as TrainingOption),
      id,
      wearCost,
      gains: isObject(v.gains) ? (v.gains as TrainingOption['gains']) : {},
      secondaryGains: isObject(v.secondaryGains) ? (v.secondaryGains as TrainingOption['secondaryGains']) : {},
    },
  };
}

function validateArray<T>(
  v: unknown,
  path: string,
  each: (item: unknown, path: string) => Validated<T>,
): Validated<T[]> {
  if (v === undefined || v === null) return { ok: true, value: [] };
  if (!Array.isArray(v)) return fail(path, 'is not an array');
  const out: T[] = [];
  for (let i = 0; i < v.length; i++) {
    const r = each(v[i], `${path}[${i}]`);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return { ok: true, value: out };
}

// ---------------------------------------------------------------------------
// Career
// ---------------------------------------------------------------------------

export function validateCareer(v: unknown, path = 'career'): Validated<CareerState> {
  if (!isObject(v)) return fail(path, 'is not an object');

  const player = validateFighter(v.player, `${path}.player`);
  if (!player.ok) return player;

  // The career RNG is what makes a career replayable. A missing or malformed
  // stream state would silently re-seed the world mid-career.
  const rngState = validateRatingBlock(v.rngState, ['a', 'b', 'c', 'd'], `${path}.rngState`);
  if (!rngState.ok) return rngState;

  const ladder = validateArray(v.ladder, `${path}.ladder`, validateLadderEntry);
  if (!ladder.ok) return ladder;
  const history = validateArray(v.history, `${path}.history`, validateBoutRecord);
  if (!history.ok) return history;
  const trainingSlate = validateArray(v.trainingSlate, `${path}.trainingSlate`, validateTrainingOption);
  if (!trainingSlate.ok) return trainingSlate;

  if (ladder.value.length === 0) return fail(`${path}.ladder`, 'is empty — a career must have a world to fight in');

  const counters: Record<string, number> = {};
  for (const k of [
    'version',
    'seed',
    'createdAtBout',
    'playerRank',
    'titleDefences',
    'boutIndex',
    'wins',
    'losses',
    'draws',
    'kos',
    'consecutiveLosses',
    'earnings',
    'availableFunds',
    'wear',
    'trainingPicks',
  ] as const) {
    const r = readNum(v, k, path, 0);
    if (isErr(r)) return fail(`${path}.${k}`, r.err);
    counters[k] = r;
  }

  if (!str(v.phase)) return fail(`${path}.phase`, 'is not a string');
  if (!str(v.stage)) return fail(`${path}.stage`, 'is not a string');
  if (!str(v.difficulty)) return fail(`${path}.difficulty`, 'is not a string');

  let ending: CareerEnding | null = null;
  if (v.ending !== undefined && v.ending !== null) {
    if (!isObject(v.ending)) return fail(`${path}.ending`, 'is not an object');
    if (!str(v.ending.reasonKey)) return fail(`${path}.ending.reasonKey`, 'is not a string');
    ending = v.ending as unknown as CareerEnding;
  }

  let pendingChallenge: PendingChallenge | null = null;
  if (v.pendingChallenge !== undefined && v.pendingChallenge !== null) {
    if (!isObject(v.pendingChallenge)) return fail(`${path}.pendingChallenge`, 'is not an object');
    if (!str(v.pendingChallenge.challengerId)) {
      return fail(`${path}.pendingChallenge.challengerId`, 'is not a string');
    }
    pendingChallenge = v.pendingChallenge as unknown as PendingChallenge;
  }

  const career: CareerState = {
    ...(v as unknown as CareerState),
    ...(counters as unknown as Pick<CareerState, 'seed' | 'boutIndex'>),
    rngState: rngState.value as unknown as CareerState['rngState'],
    player: player.value,
    ladder: ladder.value,
    history: history.value,
    trainingSlate: trainingSlate.value,
    offeredOpponents: Array.isArray(v.offeredOpponents) ? v.offeredOpponents.filter(str) : [],
    trainingLog: Array.isArray(v.trainingLog) ? v.trainingLog.filter(str) : [],
    news: Array.isArray(v.news) ? v.news.filter(str) : [],
    isChampion: readBool(v, 'isChampion', false),
    rebuildUsed: readBool(v, 'rebuildUsed', false),
    titleHolderId: str(v.titleHolderId) ? v.titleHolderId : '',
    ending,
    pendingChallenge,
  };

  // A rank pointing outside the ladder crashes every screen that resolves it.
  if (career.playerRank < 1 || career.playerRank > career.ladder.length + 1) {
    return fail(`${path}.playerRank`, `rank ${career.playerRank} is outside a ladder of ${career.ladder.length}`);
  }

  return { ok: true, value: career };
}

export function validateLegacyRecord(v: unknown, path: string): Validated<LegacyRecord> {
  if (!isObject(v)) return fail(path, 'is not an object');
  const name = readStr(v, 'name', path);
  if (isErr(name)) return fail(`${path}.name`, name.err);
  const nums: Record<string, number> = {};
  for (const k of ['earnings', 'wins', 'losses', 'draws', 'kos', 'peakRank', 'titleDefences'] as const) {
    const r = readNum(v, k, path, 0);
    if (isErr(r)) return fail(`${path}.${k}`, r.err);
    nums[k] = r;
  }
  return {
    ok: true,
    value: {
      name,
      nickname: str(v.nickname) ? v.nickname : '',
      gradeKey: str(v.gradeKey) ? v.gradeKey : '',
      difficulty: (str(v.difficulty) ? v.difficulty : 'contender') as LegacyRecord['difficulty'],
      earnings: nums.earnings,
      wins: nums.wins,
      losses: nums.losses,
      draws: nums.draws,
      kos: nums.kos,
      peakRank: nums.peakRank,
      titleDefences: nums.titleDefences,
    },
  };
}

export function validateLegacy(v: unknown, path = 'legacy'): Validated<LegacyRecord[]> {
  return validateArray(v, path, validateLegacyRecord);
}

export function validateSlots(v: unknown, path = 'slots'): Validated<Record<string, CareerState>> {
  if (v === undefined || v === null) return { ok: true, value: {} };
  if (!isObject(v)) return fail(path, 'is not an object');
  const out: Record<string, CareerState> = {};
  for (const [key, slot] of Object.entries(v)) {
    const r = validateCareer(slot, `${path}.${key}`);
    if (!r.ok) return r;
    out[key] = r.value;
  }
  return { ok: true, value: out };
}
