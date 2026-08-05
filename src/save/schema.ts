/**
 * Save schema, versioning and migrations.
 *
 * A save is never silently discarded. Anything that cannot be parsed or
 * migrated is preserved verbatim in a quarantine slot so the player can export
 * it, and the game falls back to a clean state rather than crashing.
 */
import type { CareerState, LegacyRecord } from '@career/types';
import type { DifficultyId } from '@ai/profiles';
import { validateCareer, validateLegacy, validateSlots } from './validate';
import { BUILD } from '@util/build-info';

/** Current top-level save version. Bump whenever the shape changes. */
export const SAVE_VERSION = 4;
export const SAVE_MAGIC = 'TENCOUNT';

export interface AccessibilitySettings {
  reducedMotion: boolean;
  /** Adds shape and text cues wherever colour carries meaning. */
  colorSafe: boolean;
  screenShake: boolean;
  hitFlash: boolean;
  /** 0.8 .. 1.6 */
  textScale: number;
  /** Hold to guard, or press to toggle it. */
  holdToGuard: boolean;
  /** Knockdown recovery method. */
  riseAssist: 'tap' | 'hold' | 'auto';
  /** Shows the AI's intent overlay. Off in normal play. */
  showAiDebug: boolean;
  /** Draws hitbox / hurtbox and frame state. Training tool. */
  showFrameData: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  crowd: number;
  muted: boolean;
}

export interface Settings {
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  difficulty: DifficultyId;
  /** Keyboard binding map: action -> KeyboardEvent.code. */
  keyboard: Record<string, string>;
  /** Gamepad binding map: action -> button index, or `axis:N:+/-`. */
  gamepad: Record<string, string>;
  /** Whether the intro tutorial prompt has been dismissed. */
  seenTutorial: boolean;
}

export interface SaveFile {
  magic: string;
  version: number;
  /** ISO date string, informational only — never used by the simulation. */
  savedAt: string;
  settings: Settings;
  /** The active career, if any. */
  career: CareerState | null;
  /** Manual save slots. */
  slots: Record<string, CareerState>;
  /** Retired careers, newest first. */
  legacy: LegacyRecord[];
  /** A save that could not be read, kept so the player can export it. */
  quarantine?: { reason: string; raw: string };
}

export type MigrationResult =
  | { ok: true; save: SaveFile; migratedFrom: number | null; notes: string[] }
  | { ok: false; reason: string; raw: string };

/**
 * Migrations, applied in order. Each takes the save shape at version `from`
 * and returns the shape at `from + 1`. Data is transformed, never dropped.
 */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 -> v2: audio gained a dedicated crowd bus.
  1: (s) => {
    const settings = (s.settings ?? {}) as Record<string, unknown>;
    const audio = (settings.audio ?? {}) as Record<string, unknown>;
    if (typeof audio.crowd !== 'number') audio.crowd = 0.7;
    settings.audio = audio;
    s.settings = settings;
    return s;
  },
  // v2 -> v3: accessibility options were split out and gained rise assist.
  2: (s) => {
    const settings = (s.settings ?? {}) as Record<string, unknown>;
    const a = (settings.accessibility ?? {}) as Record<string, unknown>;
    a.reducedMotion ??= false;
    a.colorSafe ??= false;
    a.screenShake ??= true;
    a.hitFlash ??= true;
    a.textScale ??= 1;
    a.holdToGuard ??= true;
    a.riseAssist ??= 'tap';
    a.showAiDebug ??= false;
    a.showFrameData ??= false;
    settings.accessibility = a;
    s.settings = settings;
    return s;
  },
  // v3 -> v4: careers gained the news feed and explicit available funds.
  3: (s) => {
    const patch = (c: Record<string, unknown> | null | undefined): void => {
      if (!c) return;
      c.news ??= [];
      c.availableFunds ??= c.earnings ?? 0;
      c.trainingLog ??= [];
      c.titleDefences ??= 0;
      c.rebuildUsed ??= false;
    };
    patch(s.career as Record<string, unknown> | null);
    for (const v of Object.values((s.slots ?? {}) as Record<string, Record<string, unknown>>)) patch(v);
    return s;
  },
};

export function defaultSettings(): Settings {
  return {
    audio: { master: 0.8, music: 0.55, sfx: 0.85, crowd: 0.6, muted: false },
    accessibility: {
      reducedMotion: false,
      colorSafe: false,
      screenShake: true,
      hitFlash: true,
      textScale: 1,
      holdToGuard: true,
      riseAssist: 'tap',
      showAiDebug: false,
      showFrameData: false,
    },
    difficulty: 'contender',
    keyboard: {},
    gamepad: {},
    seenTutorial: false,
  };
}

export function emptySave(): SaveFile {
  return {
    magic: SAVE_MAGIC,
    version: SAVE_VERSION,
    savedAt: '',
    settings: defaultSettings(),
    career: null,
    slots: {},
    legacy: [],
  };
}

/**
 * Parses and migrates raw save text.
 *
 * Returns `ok: false` with the original text preserved when the data cannot be
 * understood — the caller quarantines it rather than deleting it.
 */
export function parseSave(raw: string): MigrationResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'save.error.notJson', raw };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'save.error.notObject', raw };
  }

  const obj = data as Record<string, unknown>;
  if (obj.magic !== SAVE_MAGIC) {
    return { ok: false, reason: 'save.error.wrongGame', raw };
  }

  const version = typeof obj.version === 'number' ? obj.version : 1;
  if (version > SAVE_VERSION) {
    // A save from a newer build. Refuse rather than corrupt it.
    return { ok: false, reason: 'save.error.fromNewerVersion', raw };
  }

  const notes: string[] = [];
  let working = obj;
  let v = version;
  while (v < SAVE_VERSION) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { ok: false, reason: `save.error.noMigration.${v}`, raw };
    working = migrate(working);
    v++;
    notes.push(`migrated to v${v}`);
  }
  working.version = SAVE_VERSION;

  const merged = normalise(working);
  if (!merged.ok) return { ok: false, reason: merged.reason, raw };
  return { ok: true, save: merged.save, migratedFrom: version === SAVE_VERSION ? null : version, notes };
}

/**
 * Fills in anything a hand-edited or partial save is missing, and validates
 * everything it cannot fill in.
 *
 * Settings are merged over defaults, because a missing option has an obviously
 * right answer. The career, slots and legacy board are structurally validated
 * instead (see `./validate`): they used to be cast straight to their types,
 * which checks nothing at runtime and turned malformed data into a crash three
 * screens later rather than a readable load failure here.
 */
function normalise(o: Record<string, unknown>): { ok: true; save: SaveFile } | { ok: false; reason: string } {
  const base = emptySave();
  const settings = (o.settings ?? {}) as Partial<Settings>;

  let career: CareerState | null = null;
  if (o.career !== undefined && o.career !== null) {
    const v = validateCareer(o.career);
    if (!v.ok) return { ok: false, reason: `save.error.invalidCareer:${v.path}: ${v.reason}` };
    career = v.value;
  }

  const slots = validateSlots(o.slots);
  if (!slots.ok) return { ok: false, reason: `save.error.invalidSlot:${slots.path}: ${slots.reason}` };

  const legacy = validateLegacy(o.legacy);
  if (!legacy.ok) return { ok: false, reason: `save.error.invalidLegacy:${legacy.path}: ${legacy.reason}` };

  return {
    ok: true,
    save: {
      magic: SAVE_MAGIC,
      version: SAVE_VERSION,
      savedAt: typeof o.savedAt === 'string' ? o.savedAt : '',
      settings: {
        audio: { ...base.settings.audio, ...(settings.audio ?? {}) },
        accessibility: { ...base.settings.accessibility, ...(settings.accessibility ?? {}) },
        difficulty: settings.difficulty ?? base.settings.difficulty,
        keyboard: { ...(settings.keyboard ?? {}) },
        gamepad: { ...(settings.gamepad ?? {}) },
        seenTutorial: settings.seenTutorial ?? false,
      },
      career,
      slots: slots.value,
      legacy: legacy.value,
      ...(o.quarantine ? { quarantine: o.quarantine as { reason: string; raw: string } } : {}),
    },
  };
}

/**
 * Serialises a save.
 *
 * `build` records which build wrote it: a save that came out of a specific
 * artifact should say so, because the first question about a corrupt or
 * unexpected save is which version produced it. It is metadata only — nothing
 * reads it back, migrations key off `version`, and a save from an unknown
 * build still loads.
 */
export function serialiseSave(save: SaveFile, timestamp: string): string {
  return JSON.stringify({
    ...save,
    magic: SAVE_MAGIC,
    version: SAVE_VERSION,
    savedAt: timestamp,
    build: { version: BUILD.version, commit: BUILD.commitShort, ci: BUILD.ci },
  });
}
