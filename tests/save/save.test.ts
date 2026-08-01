/**
 * Saves.
 *
 * The gate: export and import round-trip, and corrupted or older saves either
 * migrate cleanly or fail safely — never silently losing data.
 */
import { describe, expect, it } from 'vitest';
import { SAVE_MAGIC, SAVE_VERSION, defaultSettings, emptySave, parseSave, serialiseSave } from '@save/schema';
import { SaveStore } from '@save/storage';
import { createCareer } from '@career/career';
import { buildFighter, defaultChoices } from '@career/creation';

const NOW = '2026-01-01T00:00:00.000Z';

/** A storage stand-in so the tests never touch a real browser. */
class FakeStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function sampleCareer() {
  const c = defaultChoices();
  c.name = 'Round Trip';
  return createCareer(1234, buildFighter(c), 'title');
}

describe('save parsing', () => {
  it('accepts a current save unchanged', () => {
    const save = emptySave();
    const result = parseSave(serialiseSave(save, NOW));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFrom).toBeNull();
      expect(result.save.version).toBe(SAVE_VERSION);
    }
  });

  it('rejects text that is not JSON, keeping the original bytes', () => {
    const result = parseSave('this is not a save');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('save.error.notJson');
      expect(result.raw).toBe('this is not a save');
    }
  });

  it('rejects a save from another game', () => {
    const result = parseSave(JSON.stringify({ magic: 'SOMETHING_ELSE', version: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('save.error.wrongGame');
  });

  it('refuses a save from a newer build rather than mangling it', () => {
    const result = parseSave(JSON.stringify({ magic: SAVE_MAGIC, version: SAVE_VERSION + 5 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('save.error.fromNewerVersion');
  });

  it('migrates a version 1 save all the way forward without losing data', () => {
    const legacy = {
      magic: SAVE_MAGIC,
      version: 1,
      savedAt: NOW,
      settings: { audio: { master: 0.5, music: 0.3, sfx: 0.9 }, difficulty: 'legend' },
      career: { player: { displayName: 'Old Timer' }, earnings: 123456, wins: 7 },
      slots: { a: { player: { displayName: 'Slot One' }, earnings: 42 } },
      legacy: [{ name: 'Ancestor', earnings: 1, wins: 1, losses: 0, draws: 0, kos: 0, peakRank: 3, titleDefences: 0, gradeKey: 'grade.contender', difficulty: 'club' }],
    };
    const result = parseSave(JSON.stringify(legacy));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.migratedFrom).toBe(1);
    expect(result.save.version).toBe(SAVE_VERSION);
    // Migration 1 -> 2 supplies the crowd bus.
    expect(result.save.settings.audio.crowd).toBeTypeOf('number');
    // Existing values survive untouched.
    expect(result.save.settings.audio.master).toBe(0.5);
    expect(result.save.settings.difficulty).toBe('legend');
    // Migration 2 -> 3 supplies accessibility defaults.
    expect(result.save.settings.accessibility.riseAssist).toBe('tap');
    // Migration 3 -> 4 supplies the news feed and available funds.
    const career = result.save.career as unknown as Record<string, unknown>;
    expect(career.news).toEqual([]);
    expect(career.availableFunds).toBe(123456);
    expect(career.rebuildUsed).toBe(false);
    // Nothing was dropped.
    expect((career.player as Record<string, unknown>).displayName).toBe('Old Timer');
    expect(result.save.legacy[0].name).toBe('Ancestor');
    expect(Object.keys(result.save.slots)).toEqual(['a']);
  });

  it('fills in fields a hand-edited save is missing', () => {
    const partial = { magic: SAVE_MAGIC, version: SAVE_VERSION, settings: { audio: { master: 0.2 } } };
    const result = parseSave(JSON.stringify(partial));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.settings.audio.master).toBe(0.2);
    expect(result.save.settings.audio.sfx).toBe(defaultSettings().audio.sfx);
    expect(result.save.settings.accessibility.textScale).toBe(1);
    expect(result.save.legacy).toEqual([]);
  });
});

describe('the save store', () => {
  it('round-trips a full career through export and import', () => {
    const storage = new FakeStorage();
    const store = new SaveStore(storage);
    store.data.career = sampleCareer();
    store.data.settings.audio.music = 0.42;
    expect(store.write(NOW)).toBe(true);

    const exported = store.exportTo(NOW);

    const fresh = new SaveStore(new FakeStorage());
    expect(fresh.data.career).toBeNull();
    expect(fresh.importFrom(exported, NOW)).toBeNull();

    expect(fresh.data.settings.audio.music).toBe(0.42);
    expect(fresh.data.career?.player.displayName).toBe('Round Trip');
    expect(fresh.data.career?.seed).toBe(1234);
    expect(fresh.data.career?.ladder.length).toBe(store.data.career!.ladder.length);
    // The career survives byte-for-byte.
    expect(JSON.stringify(fresh.data.career)).toBe(JSON.stringify(store.data.career));
  });

  it('reports an import failure instead of destroying the current save', () => {
    const storage = new FakeStorage();
    const store = new SaveStore(storage);
    store.data.career = sampleCareer();
    store.write(NOW);

    const err = store.importFrom('{ not valid', NOW);
    expect(err).toBe('save.error.notJson');
    // The existing career is untouched.
    expect(store.data.career?.player.displayName).toBe('Round Trip');
  });

  it('recovers from the backup when the primary save is corrupt', () => {
    const storage = new FakeStorage();
    const first = new SaveStore(storage);
    first.data.career = sampleCareer();
    first.write(NOW);
    // A second write rolls the good save into the backup slot.
    first.data.settings.audio.master = 0.11;
    first.write(NOW);

    // Now corrupt the primary.
    storage.setItem('tencount.save.v1', '{{{ corrupted');

    const recovered = new SaveStore(storage);
    expect(recovered.report.recovered).toBe(true);
    expect(recovered.report.messageKey).toBe('save.notice.recoveredBackup');
    expect(recovered.data.career?.player.displayName).toBe('Round Trip');
    // The unreadable bytes are preserved, not deleted.
    expect(recovered.data.quarantine?.raw).toBe('{{{ corrupted');
  });

  it('quarantines rather than deletes when nothing is readable', () => {
    const storage = new FakeStorage();
    storage.setItem('tencount.save.v1', 'garbage');
    const store = new SaveStore(storage);
    expect(store.report.recovered).toBe(true);
    expect(store.report.messageKey).toBe('save.notice.corrupt');
    expect(store.data.quarantine?.raw).toBe('garbage');
    expect(store.data.career).toBeNull();
    // The game still works from a clean state.
    expect(store.data.settings.audio.master).toBe(defaultSettings().audio.master);
  });

  it('starts clean when there is no save at all', () => {
    const store = new SaveStore(new FakeStorage());
    expect(store.report.recovered).toBe(false);
    expect(store.report.messageKey).toBeNull();
    expect(store.data.career).toBeNull();
  });

  it('reloads exactly what it wrote', () => {
    const storage = new FakeStorage();
    const a = new SaveStore(storage);
    a.data.career = sampleCareer();
    a.data.career.wins = 9;
    a.data.career.earnings = 555_000;
    a.write(NOW);

    const b = new SaveStore(storage);
    expect(b.data.career?.wins).toBe(9);
    expect(b.data.career?.earnings).toBe(555_000);
  });

  it('erases everything on reset', () => {
    const storage = new FakeStorage();
    const store = new SaveStore(storage);
    store.data.career = sampleCareer();
    store.write(NOW);
    store.reset(NOW);
    expect(store.data.career).toBeNull();
    expect(new SaveStore(storage).data.career).toBeNull();
  });

  it('survives storage that throws on write', () => {
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    };
    const store = new SaveStore(hostile);
    expect(store.write(NOW)).toBe(false);
    // The game keeps running with an in-memory save.
    expect(store.data.settings).toBeDefined();
  });
});
