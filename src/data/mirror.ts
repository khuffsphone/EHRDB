/**
 * Controlled archetype test fighters.
 *
 * Every one of these has *identical* ratings and an identical body; the only
 * difference is the archetype, and therefore the AI's goals. That isolates
 * strategy from statistics, which is the only way to tell whether the four
 * required archetypes are actually balanced against one another or whether a
 * win rate is really just a ratings advantage in disguise.
 *
 * Used by `npm run soak -- --mirror` and by the archetype balance test.
 */
import type { ArchetypeId, FighterDefinition } from '@sim/types';

const NEUTRAL = {
  body: { heightCm: 190, reachCm: 193, massKg: 99 },
  ratings: { power: 60, stamina: 60, speed: 60, defense: 60 },
  secondary: { chin: 60, bodyToughness: 60, recovery: 60, footwork: 60, accuracy: 60, composure: 60 },
} as const;

const STYLE: Record<ArchetypeId, { aggression: number; preferredRange: 'outside' | 'jab' | 'pocket'; bodyAttackBias: number }> = {
  out_boxer: { aggression: 0.4, preferredRange: 'outside', bodyAttackBias: 0.18 },
  pressure: { aggression: 0.85, preferredRange: 'pocket', bodyAttackBias: 0.5 },
  counterpuncher: { aggression: 0.3, preferredRange: 'jab', bodyAttackBias: 0.3 },
  brawler: { aggression: 0.6, preferredRange: 'pocket', bodyAttackBias: 0.25 },
  boxer_puncher: { aggression: 0.5, preferredRange: 'jab', bodyAttackBias: 0.4 },
};

export const MIRROR_ARCHETYPES: readonly ArchetypeId[] = [
  'out_boxer',
  'pressure',
  'counterpuncher',
  'brawler',
  'boxer_puncher',
];

export function mirrorFighter(archetype: ArchetypeId): FighterDefinition {
  return {
    id: `mirror_${archetype}`,
    displayName: `Test ${archetype}`,
    nickname: 'Control',
    hometown: 'Test Gym',
    stance: 'orthodox',
    body: { ...NEUTRAL.body },
    ratings: { ...NEUTRAL.ratings },
    secondary: { ...NEUTRAL.secondary },
    style: { archetype, ...STYLE[archetype] },
    appearance: {
      paletteKey: 'slate',
      trunksKey: 'block',
      buildKey: 'athletic',
      skinKey: 'umber',
      hairKey: 'crop',
    },
  };
}

export const MIRROR_ROSTER: readonly FighterDefinition[] = MIRROR_ARCHETYPES.map(mirrorFighter);
