/**
 * Create-a-boxer.
 *
 * The player picks a name, a look, a stance and a style base, then spends a
 * fixed pool of points across the four headline ratings. Secondary ratings are
 * derived from those choices, so what the player sees on the creation screen
 * genuinely determines how the fighter performs.
 *
 * The allocation is deliberately not free: every style base carries its own
 * bonuses *and* its own penalties, and the pool is small enough that a build
 * maximising one thing is visibly poor at another. There is no dominant
 * allocation, which the balance test asserts.
 */
import { clamp } from '@sim/fixed';
import type { ArchetypeId, CoreRatings, FighterDefinition, Stance } from '@sim/types';

/** Every rating starts here before the player spends anything. */
export const BASE_RATING = 42;
/** Points the player distributes across the four headline ratings. */
export const POINT_POOL = 60;
/** No single rating may be pushed beyond this at creation. */
export const CREATION_CAP = 74;
export const CREATION_FLOOR = 30;

export interface StyleBase {
  archetype: ArchetypeId;
  nameKey: string;
  descriptionKey: string;
  /** Applied to the headline ratings after the player's points. */
  modifiers: Partial<CoreRatings>;
  /** Applied to derived secondary ratings. */
  secondary: Partial<{
    chin: number;
    bodyToughness: number;
    recovery: number;
    footwork: number;
    accuracy: number;
    composure: number;
  }>;
  /** Body preset. Reach is the single biggest hidden advantage, so it is paid for. */
  body: { heightCm: number; reachCm: number; massKg: number };
}

/**
 * Five style bases. Each is a genuine trade: the out-boxer's reach and
 * footwork are paid for in power and chin; the slugger's power is paid for in
 * stamina and footwork.
 */
export const STYLE_BASES: readonly StyleBase[] = [
  {
    archetype: 'out_boxer',
    nameKey: 'style.outBoxer.name',
    descriptionKey: 'style.outBoxer.desc',
    modifiers: { speed: 6, defense: 4, power: -7, stamina: -1 },
    secondary: { footwork: 10, accuracy: 6, chin: -6, bodyToughness: -4 },
    body: { heightCm: 195, reachCm: 201, massKg: 95 },
  },
  {
    archetype: 'pressure',
    nameKey: 'style.pressure.name',
    descriptionKey: 'style.pressure.desc',
    modifiers: { stamina: 8, speed: 2, defense: -6, power: -2 },
    secondary: { bodyToughness: 8, recovery: 6, accuracy: -4, composure: -3 },
    body: { heightCm: 183, reachCm: 186, massKg: 96 },
  },
  {
    archetype: 'counterpuncher',
    nameKey: 'style.counter.name',
    descriptionKey: 'style.counter.desc',
    modifiers: { defense: 8, speed: 3, stamina: -5, power: -4 },
    secondary: { accuracy: 9, composure: 8, bodyToughness: -5, recovery: -3 },
    body: { heightCm: 189, reachCm: 194, massKg: 97 },
  },
  {
    archetype: 'brawler',
    nameKey: 'style.brawler.name',
    descriptionKey: 'style.brawler.desc',
    modifiers: { power: 10, defense: -5, speed: -4, stamina: -1 },
    secondary: { chin: 8, bodyToughness: 4, footwork: -9, accuracy: -4 },
    body: { heightCm: 191, reachCm: 196, massKg: 107 },
  },
  {
    archetype: 'boxer_puncher',
    nameKey: 'style.boxerPuncher.name',
    descriptionKey: 'style.boxerPuncher.desc',
    modifiers: {},
    secondary: { accuracy: 2, composure: 2 },
    body: { heightCm: 190, reachCm: 193, massKg: 100 },
  },
];

export function getStyleBase(archetype: ArchetypeId): StyleBase {
  const s = STYLE_BASES.find((x) => x.archetype === archetype);
  if (!s) throw new Error(`Unknown style base: ${archetype}`);
  return s;
}

export interface CreationChoices {
  name: string;
  nickname: string;
  hometown: string;
  stance: Stance;
  archetype: ArchetypeId;
  /** Points spent above `BASE_RATING`, one per headline rating. */
  allocation: CoreRatings;
  paletteKey: string;
  trunksKey: string;
  buildKey: 'lean' | 'athletic' | 'heavy';
  skinKey: string;
  hairKey: string;
}

export function defaultAllocation(): CoreRatings {
  const each = Math.floor(POINT_POOL / 4);
  return { power: each, stamina: each, speed: each, defense: POINT_POOL - each * 3 };
}

export function pointsSpent(a: CoreRatings): number {
  return a.power + a.stamina + a.speed + a.defense;
}

export function pointsRemaining(a: CoreRatings): number {
  return POINT_POOL - pointsSpent(a);
}

/** A rating may only be raised while points remain and the cap allows it. */
export function canRaise(a: CoreRatings, key: keyof CoreRatings): boolean {
  return pointsRemaining(a) > 0 && BASE_RATING + a[key] < CREATION_CAP;
}

export function canLower(a: CoreRatings, key: keyof CoreRatings): boolean {
  return BASE_RATING + a[key] > CREATION_FLOOR;
}

/** Validation used by both the UI and the tests. */
export function validateChoices(c: CreationChoices): string[] {
  const errors: string[] = [];
  if (c.name.trim().length === 0) errors.push('creation.error.name');
  if (c.name.length > 18) errors.push('creation.error.nameLong');
  if (pointsRemaining(c.allocation) !== 0) errors.push('creation.error.points');
  for (const k of ['power', 'stamina', 'speed', 'defense'] as const) {
    const v = BASE_RATING + c.allocation[k];
    if (v > CREATION_CAP || v < CREATION_FLOOR) errors.push('creation.error.range');
  }
  return errors;
}

/** Turns creation choices into a simulation-ready fighter. */
export function buildFighter(c: CreationChoices): FighterDefinition {
  const base = getStyleBase(c.archetype);
  const r = (k: keyof CoreRatings): number =>
    clamp(BASE_RATING + c.allocation[k] + (base.modifiers[k] ?? 0), 1, 96);

  const ratings: CoreRatings = {
    power: r('power'),
    stamina: r('stamina'),
    speed: r('speed'),
    defense: r('defense'),
  };

  // Secondary ratings are derived, not allocated, so the player cannot spend
  // their way to a fighter with no weaknesses.
  const s = base.secondary;
  const derive = (v: number, bonus: number | undefined): number => clamp(Math.round(v + (bonus ?? 0)), 1, 96);

  return {
    id: 'player',
    displayName: c.name.trim() || 'Newcomer',
    nickname: c.nickname.trim(),
    hometown: c.hometown.trim() || 'Unlisted',
    stance: c.stance,
    body: { ...base.body },
    ratings,
    secondary: {
      chin: derive(ratings.defense * 0.4 + ratings.stamina * 0.5 + 12, s.chin),
      bodyToughness: derive(ratings.stamina * 0.65 + ratings.defense * 0.25 + 12, s.bodyToughness),
      recovery: derive(ratings.stamina * 0.7 + 14, s.recovery),
      footwork: derive(ratings.speed * 0.6 + ratings.defense * 0.25 + 12, s.footwork),
      accuracy: derive(ratings.speed * 0.4 + ratings.defense * 0.3 + 22, s.accuracy),
      composure: derive(ratings.defense * 0.55 + ratings.stamina * 0.2 + 18, s.composure),
    },
    style: {
      archetype: c.archetype,
      aggression: c.archetype === 'pressure' ? 0.85 : c.archetype === 'brawler' ? 0.62 : c.archetype === 'out_boxer' ? 0.45 : c.archetype === 'counterpuncher' ? 0.3 : 0.5,
      preferredRange: c.archetype === 'pressure' || c.archetype === 'brawler' ? 'pocket' : c.archetype === 'out_boxer' ? 'outside' : 'jab',
      bodyAttackBias: c.archetype === 'pressure' ? 0.5 : c.archetype === 'brawler' ? 0.25 : 0.35,
    },
    appearance: {
      paletteKey: c.paletteKey,
      trunksKey: c.trunksKey,
      buildKey: c.buildKey,
      skinKey: c.skinKey,
      hairKey: c.hairKey,
    },
  };
}

export function defaultChoices(): CreationChoices {
  return {
    name: '',
    nickname: '',
    hometown: 'Meridian City',
    stance: 'orthodox',
    archetype: 'boxer_puncher',
    allocation: defaultAllocation(),
    paletteKey: 'frost',
    trunksKey: 'stripe',
    buildKey: 'athletic',
    skinKey: 'sienna',
    hairKey: 'crop',
  };
}
