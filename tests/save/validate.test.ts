/**
 * Recursive save validation.
 *
 * Everything here used to pass. `parseSave` checked the top-level envelope and
 * then cast the career, the slots and the legacy board to their TypeScript
 * types — an assertion that compiles to nothing, so a malformed save loaded
 * cleanly and crashed three screens later, far from anything that could report
 * a useful error.
 *
 * The rule these tests pin: a missing value with an obvious default is filled,
 * because that is how a save written by an older build stays loadable. A value
 * that is present and of the wrong kind is rejected, because guessing would
 * invent a career the player never played.
 */
import { describe, expect, it } from 'vitest';
import { parseSave, serialiseSave, emptySave } from '@save/schema';
import { validateCareer, validateLegacy } from '@save/validate';
import { createCareer } from '@career/career';
import { buildFighter, defaultChoices } from '@career/creation';

const NOW = '2026-01-01T00:00:00.000Z';

function career() {
  const c = defaultChoices();
  c.name = 'Vera Kade';
  return createCareer(4242, buildFighter(c), 'contender');
}

/** A save whose career has been tampered with at `path`. */
function tampered(mutate: (c: Record<string, unknown>) => void): string {
  const save = emptySave();
  save.career = career();
  const raw = JSON.parse(serialiseSave(save, NOW)) as Record<string, unknown>;
  mutate(raw.career as Record<string, unknown>);
  return JSON.stringify(raw);
}

describe('career validation', () => {
  it('accepts a career this build wrote', () => {
    const result = validateCareer(JSON.parse(JSON.stringify(career())));
    expect(result.ok).toBe(true);
  });

  it.each([
    ['career is a number', (s: Record<string, unknown>) => void s, true],
    ['ladder is a string', (c: Record<string, unknown>) => void (c.ladder = 'nope'), false],
    ['ladder is empty', (c: Record<string, unknown>) => void (c.ladder = []), false],
    ['a ladder entry is a string', (c: Record<string, unknown>) => void ((c.ladder as unknown[])[0] = 'x'), false],
    [
      'a ladder rank is not a number',
      (c: Record<string, unknown>) => void (((c.ladder as Record<string, unknown>[])[0].rank = 'first')),
      false,
    ],
    ['player is missing', (c: Record<string, unknown>) => void delete c.player, false],
    ['player has no ratings', (c: Record<string, unknown>) => void delete (c.player as Record<string, unknown>).ratings, false],
    [
      'a rating is NaN',
      (c: Record<string, unknown>) =>
        void (((c.player as Record<string, Record<string, unknown>>).ratings.power = 'strong')),
      false,
    ],
    ['the RNG state is gone', (c: Record<string, unknown>) => void delete c.rngState, false],
    ['history is an object', (c: Record<string, unknown>) => void (c.history = { nope: 1 }), false],
    [
      'a scorecard is malformed',
      (c: Record<string, unknown>) => void (c.history = [{ opponentId: 'a', result: 'win', kind: 'ko', scorecards: [[1]] }]),
      false,
    ],
    ['playerRank points off the ladder', (c: Record<string, unknown>) => void (c.playerRank = 9999), false],
  ])('rejects a save where %s', (_label, mutate, replaceWholeCareer) => {
    const raw = replaceWholeCareer
      ? (() => {
          const save = emptySave();
          const o = JSON.parse(serialiseSave(save, NOW)) as Record<string, unknown>;
          o.career = 7;
          return JSON.stringify(o);
        })()
      : tampered(mutate as (c: Record<string, unknown>) => void);

    const result = parseSave(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The reason names the path, so the quarantine notice can say what broke.
      expect(result.reason).toMatch(/invalid(Career|Slot|Legacy)/);
      expect(result.raw).toBe(raw);
    }
  });

  it('fills in optional collections a partial save omits', () => {
    const raw = tampered((c) => {
      delete c.news;
      delete c.trainingLog;
      delete c.offeredOpponents;
      delete c.trainingSlate;
      delete c.pendingChallenge;
      delete c.ending;
    });
    const result = parseSave(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.career?.news).toEqual([]);
      expect(result.save.career?.trainingLog).toEqual([]);
      expect(result.save.career?.offeredOpponents).toEqual([]);
      expect(result.save.career?.trainingSlate).toEqual([]);
      expect(result.save.career?.pendingChallenge).toBeNull();
      expect(result.save.career?.ending).toBeNull();
    }
  });

  it('preserves a valid career exactly', () => {
    const original = career();
    const save = emptySave();
    save.career = original;
    const result = parseSave(serialiseSave(save, NOW));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.career?.player.displayName).toBe('Vera Kade');
      expect(result.save.career?.ladder.length).toBe(original.ladder.length);
      expect(result.save.career?.rngState).toEqual(original.rngState);
      expect(result.save.career?.playerRank).toBe(original.playerRank);
    }
  });
});

describe('legacy board validation', () => {
  it('rejects a legacy row that is not an object', () => {
    const result = validateLegacy(['not a record']);
    expect(result.ok).toBe(false);
  });

  it('rejects a legacy row whose earnings are not a number', () => {
    const result = validateLegacy([{ name: 'A', earnings: 'lots' }]);
    expect(result.ok).toBe(false);
  });

  it('defaults the cosmetic fields of an otherwise sound row', () => {
    const result = validateLegacy([{ name: 'A', earnings: 10 }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0].nickname).toBe('');
      expect(result.value[0].wins).toBe(0);
      expect(result.value[0].difficulty).toBe('contender');
    }
  });

  it('treats a missing legacy board as an empty one', () => {
    const result = validateLegacy(undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([]);
  });
});

describe('roster references', () => {
  it('rejects a ladder entry naming a fighter this build does not have', () => {
    // A save can outlive the content it points at. Rejecting at load beats
    // throwing from getFighter() on the opponent-selection screen, where
    // nothing indicates the cause was a stale save.
    const raw = tampered((c) => {
      (c.ladder as Record<string, unknown>[])[0].fighterId = 'someone_who_retired_in_a_previous_build';
    });
    const result = parseSave(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not in this build's roster/);
  });

  it('drops a stale offered opponent instead of rejecting the career', () => {
    // Repairable: the offer list is regenerated every bout, so a stale entry
    // costs nothing to drop. A ladder entry is not — it carries a record.
    const raw = tampered((c) => {
      c.offeredOpponents = ['nikolai_vasque', 'a_fighter_that_no_longer_exists'];
    });
    const result = parseSave(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.career?.offeredOpponents).toEqual(['nikolai_vasque']);
    }
  });

  it('clears a challenge from a fighter who no longer exists', () => {
    const raw = tampered((c) => {
      c.pendingChallenge = { challengerId: 'gone', challengerName: 'Gone', challengerRank: 2, rounds: 10, purse: 1, refusalRank: 9 };
    });
    const result = parseSave(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.career?.pendingChallenge).toBeNull();
  });

  it('accepts the player themselves, who is never on the roster', () => {
    const result = parseSave(tampered(() => undefined));
    expect(result.ok).toBe(true);
  });
});

describe('save export identity', () => {
  it('records which build wrote the save', () => {
    const save = emptySave();
    const written = JSON.parse(serialiseSave(save, NOW)) as Record<string, unknown>;
    expect(written.build).toBeDefined();
    const build = written.build as Record<string, unknown>;
    expect(typeof build.version).toBe('string');
    expect(typeof build.commit).toBe('string');
    expect(typeof build.ci).toBe('string');
    // Schema version travels with it, so an export names both the data shape
    // and the artifact that produced it.
    expect(written.version).toBe(save.version);
  });

  it('loads a save that carries no build stamp', () => {
    // Saves written before build stamping existed must still load.
    const save = emptySave();
    const o = JSON.parse(serialiseSave(save, NOW)) as Record<string, unknown>;
    delete o.build;
    expect(parseSave(JSON.stringify(o)).ok).toBe(true);
  });
});
