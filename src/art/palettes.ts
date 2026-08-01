/**
 * Colour vocabulary.
 *
 * Every colour in the game is defined here or in the venue table. Nothing is
 * sampled, traced or derived from any other work; the palettes are chosen for
 * silhouette separation and for legibility against each venue's backdrop.
 *
 * Fighter identity reads from three independent channels — trunks, skin and
 * build — so two fighters are never confusable even in the colour-safe mode.
 */

export interface FighterPalette {
  /** Trunks and glove primary. */
  primary: number;
  /** Trim, waistband and boot flash. */
  accent: number;
  /** Glove colour. */
  glove: number;
  /** Outline used to lift the fighter off the crowd. */
  outline: number;
}

export const FIGHTER_PALETTES: Record<string, FighterPalette> = {
  slate: { primary: 0x46506a, accent: 0x9aa6c4, glove: 0x2f3550, outline: 0x11131d },
  ember: { primary: 0xc0392b, accent: 0xf5b041, glove: 0x7b241c, outline: 0x2a0f0c },
  frost: { primary: 0xd6e4f0, accent: 0x2e86c1, glove: 0x1b4f72, outline: 0x14202b },
  jade: { primary: 0x1e8449, accent: 0xf7dc6f, glove: 0x145a32, outline: 0x0a2416 },
  rust: { primary: 0xb9541b, accent: 0x2c3e50, glove: 0x7e3510, outline: 0x241004 },
  violet: { primary: 0x6c3483, accent: 0xd7bde2, glove: 0x4a235a, outline: 0x1a0c20 },
  gold: { primary: 0xd4ac0d, accent: 0x1c2833, glove: 0x9a7d0a, outline: 0x2b2306 },
  crimson: { primary: 0x922b21, accent: 0xf9e79f, glove: 0x641e16, outline: 0x1f0a07 },
  teal: { primary: 0x117a8b, accent: 0xf0f3f4, glove: 0x0b4f5a, outline: 0x06222a },
  sand: { primary: 0xd5b895, accent: 0x6e2c00, glove: 0xa8875e, outline: 0x2e2416 },
};

export const SKIN_TONES: Record<string, { base: number; shade: number }> = {
  ivory: { base: 0xf0cfae, shade: 0xc9a586 },
  sand: { base: 0xdcae82, shade: 0xb58860 },
  sienna: { base: 0xb87b4e, shade: 0x8e5a36 },
  bronze: { base: 0x9c6136, shade: 0x764828 },
  umber: { base: 0x7a4a2c, shade: 0x5a351f },
  mahogany: { base: 0x5e3620, shade: 0x422516 },
  espresso: { base: 0x452a1a, shade: 0x2e1b10 },
  olive: { base: 0xa8814f, shade: 0x7e603a },
};

export const HAIR_STYLES = ['crop', 'buzz', 'fade', 'short', 'wave', 'slick', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_COLOURS: Record<string, number> = {
  crop: 0x2a1f18,
  buzz: 0x1b1512,
  fade: 0x120e0c,
  short: 0x4a3524,
  wave: 0x241a14,
  slick: 0x171214,
  bald: 0x00000000,
};

/** Trunk pattern keys. The pattern is drawn, not textured. */
export const TRUNK_PATTERNS = ['block', 'stripe', 'sash', 'chevron', 'flame', 'diamond', 'bolt', 'crown'] as const;
export type TrunkPattern = (typeof TRUNK_PATTERNS)[number];

/** Build affects drawn proportions only — never performance. */
export interface BuildProfile {
  /** Multiplier on shoulder width. */
  shoulder: number;
  /** Multiplier on torso depth. */
  torso: number;
  /** Multiplier on limb thickness. */
  limb: number;
  /** Multiplier on overall height. */
  height: number;
}

export const BUILDS: Record<string, BuildProfile> = {
  lean: { shoulder: 0.92, torso: 0.88, limb: 0.86, height: 1.05 },
  athletic: { shoulder: 1.0, torso: 1.0, limb: 1.0, height: 1.0 },
  heavy: { shoulder: 1.12, torso: 1.16, limb: 1.15, height: 0.97 },
};

export function paletteFor(key: string): FighterPalette {
  return FIGHTER_PALETTES[key] ?? FIGHTER_PALETTES.slate;
}

export function skinFor(key: string): { base: number; shade: number } {
  return SKIN_TONES[key] ?? SKIN_TONES.sienna;
}

export function buildFor(key: string): BuildProfile {
  return BUILDS[key] ?? BUILDS.athletic;
}

/** Interface palette. Deliberately high-contrast and theme-consistent. */
export const UI = {
  ink: 0x0d0f14,
  panel: 0x161b26,
  panelEdge: 0x2c3547,
  raised: 0x212938,
  text: 0xe8ecf2,
  textDim: 0x93a0b4,
  accent: 0xe0a03c,
  accentDim: 0x8a6224,
  good: 0x4caf72,
  warn: 0xe0a03c,
  bad: 0xd9534f,
  focus: 0xf2c76a,
  /** Condition bars. */
  composure: 0xd9534f,
  resilience: 0x2a2f3a,
  stamina: 0x4caf72,
  trauma: 0xb07a3c,
} as const;
