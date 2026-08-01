/**
 * The roster.
 *
 * Every fighter here is entirely fictional and original to this project. No
 * name, nickname, hometown, record, likeness or biography is drawn from any
 * real person or from any other game. See docs/LEGAL_AND_ASSET_LEDGER.md.
 *
 * The ladder is ordered from rank 8 (the first fight a prospect can realistically
 * take) up to rank 1 (the champion). Ratings are tuned so that no archetype
 * dominates: `npm run soak` reports the head-to-head matrix that keeps this
 * honest.
 */
import type { ArchetypeId, FighterDefinition } from '@sim/types';

/** Roster entry plus the career-world metadata the ladder needs. */
export interface RosterEntry extends FighterDefinition {
  /** Starting rank, 1 = champion. */
  baseRank: number;
  /** Career record the world simulation starts from. */
  startRecord: { wins: number; losses: number; draws: number; kos: number };
  /** Age in years at career start; drives decline in the world simulation. */
  age: number;
  /** One-line scouting summary shown on the opponent card. */
  scoutKey: string;
}

function f(
  id: string,
  displayName: string,
  nickname: string,
  hometown: string,
  baseRank: number,
  archetype: ArchetypeId,
  body: { heightCm: number; reachCm: number; massKg: number },
  ratings: { power: number; stamina: number; speed: number; defense: number },
  secondary: { chin: number; bodyToughness: number; recovery: number; footwork: number; accuracy: number; composure: number },
  style: { aggression: number; preferredRange: 'outside' | 'jab' | 'pocket'; bodyAttackBias: number },
  appearance: FighterDefinition['appearance'],
  record: { wins: number; losses: number; draws: number; kos: number },
  age: number,
  stance: 'orthodox' | 'southpaw' = 'orthodox',
): RosterEntry {
  return {
    id,
    displayName,
    nickname,
    hometown,
    stance,
    body,
    ratings,
    secondary,
    style: { archetype, ...style },
    appearance,
    baseRank,
    startRecord: record,
    age,
    scoutKey: `scout.${id}`,
  };
}

export const ROSTER: readonly RosterEntry[] = [
  // -- Rank 8: the honest gatekeeper. Slow, tough, teaches range. ------------
  f(
    'rook_maddox', 'Rook Maddox', 'The Anvil', 'Kelso Flats', 8, 'brawler',
    { heightCm: 187, reachCm: 189, massKg: 104 },
    { power: 58, stamina: 54, speed: 38, defense: 40 },
    { chin: 68, bodyToughness: 62, recovery: 52, footwork: 34, accuracy: 46, composure: 48 },
    { aggression: 0.62, preferredRange: 'pocket', bodyAttackBias: 0.34 },
    { paletteKey: 'slate', trunksKey: 'block', buildKey: 'heavy', skinKey: 'umber', hairKey: 'crop' },
    { wins: 14, losses: 9, draws: 1, kos: 9 }, 31,
  ),

  // -- Rank 7: pure volume pressure. Punishes passivity. --------------------
  f(
    'teo_alvarra', 'Teo Alvarra', 'Motor', 'Puerto Vela', 7, 'pressure',
    { heightCm: 181, reachCm: 183, massKg: 92 },
    { power: 48, stamina: 74, speed: 62, defense: 42 },
    { chin: 58, bodyToughness: 66, recovery: 64, footwork: 60, accuracy: 55, composure: 52 },
    { aggression: 0.88, preferredRange: 'pocket', bodyAttackBias: 0.52 },
    { paletteKey: 'ember', trunksKey: 'sash', buildKey: 'athletic', skinKey: 'sienna', hairKey: 'wave' },
    { wins: 19, losses: 6, draws: 0, kos: 7 }, 27,
  ),

  // -- Rank 6: the long jab. Punishes anyone who cannot get inside. ---------
  f(
    'linus_kade', 'Linus Kade', 'Longitude', 'Northgate', 6, 'out_boxer',
    { heightCm: 196, reachCm: 203, massKg: 96 },
    { power: 46, stamina: 62, speed: 66, defense: 64 },
    { chin: 50, bodyToughness: 48, recovery: 58, footwork: 74, accuracy: 68, composure: 62 },
    { aggression: 0.28, preferredRange: 'outside', bodyAttackBias: 0.18 },
    { paletteKey: 'frost', trunksKey: 'stripe', buildKey: 'lean', skinKey: 'ivory', hairKey: 'short' },
    { wins: 21, losses: 3, draws: 1, kos: 5 }, 26,
  ),

  // -- Rank 5: southpaw counterpuncher. Teaches patience. -------------------
  f(
    'dez_okonkwo', 'Dez Okonkwo', 'The Ledger', 'Bright Harbour', 5, 'counterpuncher',
    { heightCm: 189, reachCm: 194, massKg: 98 },
    { power: 62, stamina: 60, speed: 70, defense: 72 },
    { chin: 60, bodyToughness: 56, recovery: 60, footwork: 68, accuracy: 76, composure: 74 },
    { aggression: 0.22, preferredRange: 'jab', bodyAttackBias: 0.3 },
    { paletteKey: 'jade', trunksKey: 'chevron', buildKey: 'athletic', skinKey: 'espresso', hairKey: 'fade' },
    { wins: 23, losses: 2, draws: 0, kos: 12 }, 29, 'southpaw',
  ),

  // -- Rank 4: the swarmer with real power. A genuine difficulty step. ------
  f(
    'bram_holt', 'Bram Holt', 'Furnace', 'Ash Quarter', 4, 'pressure',
    { heightCm: 184, reachCm: 186, massKg: 101 },
    { power: 72, stamina: 70, speed: 58, defense: 50 },
    { chin: 70, bodyToughness: 72, recovery: 62, footwork: 54, accuracy: 58, composure: 56 },
    { aggression: 0.84, preferredRange: 'pocket', bodyAttackBias: 0.58 },
    { paletteKey: 'rust', trunksKey: 'flame', buildKey: 'heavy', skinKey: 'sand', hairKey: 'buzz' },
    { wins: 26, losses: 3, draws: 0, kos: 20 }, 28,
  ),

  // -- Rank 3: complete boxer-puncher. No obvious hole. ---------------------
  f(
    'nikolai_vasque', 'Nikolai Vasque', 'The Clockmaker', 'Verdun Row', 3, 'boxer_puncher',
    { heightCm: 191, reachCm: 196, massKg: 100 },
    { power: 68, stamina: 68, speed: 68, defense: 68 },
    { chin: 66, bodyToughness: 64, recovery: 66, footwork: 66, accuracy: 72, composure: 70 },
    { aggression: 0.5, preferredRange: 'jab', bodyAttackBias: 0.4 },
    { paletteKey: 'violet', trunksKey: 'diamond', buildKey: 'athletic', skinKey: 'olive', hairKey: 'slick' },
    { wins: 28, losses: 2, draws: 1, kos: 17 }, 30,
  ),

  // -- Rank 2: one-punch slugger. Terrifying early, fadeable late. ----------
  f(
    'kwame_asare', 'Kwame Asare', 'Thunderhead', 'Cape Tema', 2, 'brawler',
    { heightCm: 193, reachCm: 198, massKg: 108 },
    { power: 88, stamina: 52, speed: 54, defense: 46 },
    { chin: 74, bodyToughness: 58, recovery: 54, footwork: 44, accuracy: 56, composure: 50 },
    { aggression: 0.7, preferredRange: 'pocket', bodyAttackBias: 0.24 },
    { paletteKey: 'gold', trunksKey: 'bolt', buildKey: 'heavy', skinKey: 'mahogany', hairKey: 'crop' },
    { wins: 30, losses: 4, draws: 0, kos: 28 }, 33,
  ),

  // -- Rank 1: the champion. Adapts between rounds; tests everything. -------
  f(
    'silas_orrin', 'Silas Orrin', 'The Standard', 'Meridian City', 1, 'boxer_puncher',
    { heightCm: 192, reachCm: 199, massKg: 102 },
    { power: 76, stamina: 78, speed: 76, defense: 78 },
    { chin: 78, bodyToughness: 74, recovery: 76, footwork: 76, accuracy: 80, composure: 84 },
    { aggression: 0.46, preferredRange: 'jab', bodyAttackBias: 0.42 },
    { paletteKey: 'crimson', trunksKey: 'crown', buildKey: 'athletic', skinKey: 'bronze', hairKey: 'fade' },
    { wins: 37, losses: 1, draws: 0, kos: 24 }, 32,
  ),
];

export function getFighter(id: string): RosterEntry {
  const x = ROSTER.find((r) => r.id === id);
  if (!x) throw new Error(`Unknown fighter: ${id}`);
  return x;
}

/** Archetypes actually represented on the ladder — asserted by the tests. */
export const REQUIRED_ARCHETYPES: readonly ArchetypeId[] = [
  'out_boxer',
  'pressure',
  'counterpuncher',
  'brawler',
] as const;
