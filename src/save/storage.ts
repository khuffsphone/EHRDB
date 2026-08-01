/**
 * Save persistence.
 *
 * Backed by `localStorage`, with an in-memory fallback so the game still runs
 * in a private window or a headless test. Writes are atomic in the sense that
 * a failed write never destroys the previous save: the new value is validated
 * by round-tripping it before it replaces anything.
 */
import { emptySave, parseSave, serialiseSave, SAVE_MAGIC, type SaveFile } from './schema';

const KEY = 'tencount.save.v1';
const BACKUP_KEY = 'tencount.save.backup';

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>();
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

function pickStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__tencount_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // Private browsing, disabled storage, or a sandboxed iframe.
  }
  return new MemoryStorage();
}

export interface LoadReport {
  save: SaveFile;
  /** True when the previous save could not be read and was quarantined. */
  recovered: boolean;
  migratedFrom: number | null;
  messageKey: string | null;
}

export class SaveStore {
  private readonly storage: StorageLike;
  private cache: SaveFile;
  private lastReport: LoadReport;

  constructor(storage: StorageLike = pickStorage()) {
    this.storage = storage;
    this.lastReport = this.readFromDisk();
    this.cache = this.lastReport.save;
  }

  get report(): LoadReport {
    return this.lastReport;
  }

  get data(): SaveFile {
    return this.cache;
  }

  private readFromDisk(): LoadReport {
    const raw = this.storage.getItem(KEY);
    if (raw === null) {
      return { save: emptySave(), recovered: false, migratedFrom: null, messageKey: null };
    }

    const parsed = parseSave(raw);
    if (parsed.ok) {
      return {
        save: parsed.save,
        recovered: false,
        migratedFrom: parsed.migratedFrom,
        messageKey: parsed.migratedFrom === null ? null : 'save.notice.migrated',
      };
    }

    // The primary save is unreadable. Try the rolling backup before giving up.
    const backup = this.storage.getItem(BACKUP_KEY);
    if (backup !== null) {
      const fromBackup = parseSave(backup);
      if (fromBackup.ok) {
        const save = fromBackup.save;
        save.quarantine = { reason: parsed.reason, raw: parsed.raw };
        return { save, recovered: true, migratedFrom: fromBackup.migratedFrom, messageKey: 'save.notice.recoveredBackup' };
      }
    }

    // Nothing readable. Start clean, but keep the bytes so the player can
    // export them — a corrupt save is never thrown away.
    const save = emptySave();
    save.quarantine = { reason: parsed.reason, raw: parsed.raw };
    return { save, recovered: true, migratedFrom: null, messageKey: 'save.notice.corrupt' };
  }

  /**
   * Writes the current save. The payload is re-parsed before it is committed,
   * so a bug that produces unreadable data fails here rather than on next load.
   */
  write(timestamp: string): boolean {
    const text = serialiseSave(this.cache, timestamp);
    const check = parseSave(text);
    if (!check.ok) {
      console.error('Refusing to write a save that cannot be read back:', check.reason);
      return false;
    }
    try {
      // Roll the previous good save into the backup slot first.
      const previous = this.storage.getItem(KEY);
      if (previous !== null) this.storage.setItem(BACKUP_KEY, previous);
      this.storage.setItem(KEY, text);
      return true;
    } catch (err) {
      console.error('Save write failed:', err);
      return false;
    }
  }

  /** Replaces the whole save from imported text. Returns an error key or null. */
  importFrom(raw: string, timestamp: string): string | null {
    const parsed = parseSave(raw);
    if (!parsed.ok) return parsed.reason;
    this.cache = parsed.save;
    return this.write(timestamp) ? null : 'save.error.writeFailed';
  }

  /** Produces a portable backup string. */
  exportTo(timestamp: string): string {
    return serialiseSave(this.cache, timestamp);
  }

  /** Wipes everything. Used by the settings reset, behind a confirmation. */
  reset(timestamp: string): void {
    this.cache = emptySave();
    this.storage.removeItem(BACKUP_KEY);
    this.write(timestamp);
  }

  clearQuarantine(timestamp: string): void {
    delete this.cache.quarantine;
    this.write(timestamp);
  }
}

export { SAVE_MAGIC };
