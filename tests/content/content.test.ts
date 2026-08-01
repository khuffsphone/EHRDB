/**
 * Content integrity.
 *
 * Data is validated the same way the build validates it, so a broken roster,
 * a missing string or a duplicate id fails a test rather than shipping.
 */
import { describe, expect, it } from 'vitest';
import { REQUIRED_ARCHETYPES, ROSTER, getFighter } from '@data/fighters';
import { VENUES, getVenue } from '@data/venues';
import { BOUT_LENGTHS, ROUND_SECONDS, makeRuleset } from '@data/rulesets';
import { PUNCH_TABLE, getPunch } from '@data/punches';
import { AI_PROFILES, DIFFICULTIES, DIFFICULTY_IDS } from '@ai/profiles';
import { STRINGS, money, record, t } from '@ui/strings';
import { ACTIONS, DEFAULT_GAMEPAD, DEFAULT_KEYBOARD, REQUIRED_ACTIONS } from '@input/actions';
import { FIGHTER_PALETTES, SKIN_TONES, TRUNK_PATTERNS, HAIR_STYLES, BUILDS } from '@art/palettes';
import { PUNCH_IDS, TICK_RATE, type PunchId, type TargetLevel } from '@sim/types';
import { TRAINING_CATALOGUE_IDS } from '@career/training';
import { STYLE_BASES } from '@career/creation';
import { MIRROR_ARCHETYPES } from '@data/mirror';

describe('the roster', () => {
  it('has the required number of fighters', () => {
    expect(ROSTER.length).toBe(8);
  });

  it('uses unique ids and unique starting ranks', () => {
    expect(new Set(ROSTER.map((f) => f.id)).size).toBe(ROSTER.length);
    expect(new Set(ROSTER.map((f) => f.displayName)).size).toBe(ROSTER.length);
    const ranks = ROSTER.map((f) => f.baseRank).sort((a, b) => a - b);
    ranks.forEach((r, i) => expect(r).toBe(i + 1));
  });

  it('covers every required archetype', () => {
    const present = new Set(ROSTER.map((f) => f.style.archetype));
    for (const a of REQUIRED_ARCHETYPES) expect(present.has(a), `missing archetype ${a}`).toBe(true);
    expect(present.size).toBeGreaterThanOrEqual(4);
  });

  it('keeps every rating inside a legal range', () => {
    for (const f of ROSTER) {
      for (const [k, v] of Object.entries(f.ratings)) {
        expect(v, `${f.id}.${k}`).toBeGreaterThanOrEqual(1);
        expect(v, `${f.id}.${k}`).toBeLessThanOrEqual(100);
      }
      for (const [k, v] of Object.entries(f.secondary)) {
        expect(v, `${f.id}.${k}`).toBeGreaterThanOrEqual(1);
        expect(v, `${f.id}.${k}`).toBeLessThanOrEqual(100);
      }
      expect(f.body.reachCm).toBeGreaterThan(150);
      expect(f.body.massKg).toBeGreaterThan(60);
      expect(f.style.aggression).toBeGreaterThanOrEqual(0);
      expect(f.style.aggression).toBeLessThanOrEqual(1);
    }
  });

  it('references only defined appearance keys', () => {
    for (const f of ROSTER) {
      expect(Object.keys(FIGHTER_PALETTES)).toContain(f.appearance.paletteKey);
      expect(Object.keys(SKIN_TONES)).toContain(f.appearance.skinKey);
      expect(TRUNK_PATTERNS as readonly string[]).toContain(f.appearance.trunksKey);
      expect(HAIR_STYLES as readonly string[]).toContain(f.appearance.hairKey);
      expect(Object.keys(BUILDS)).toContain(f.appearance.buildKey);
    }
  });

  it('has a scouting line for every fighter', () => {
    for (const f of ROSTER) {
      expect(STRINGS[f.scoutKey], `missing ${f.scoutKey}`).toBeDefined();
    }
  });

  it('is visually separable — no two fighters share a whole look', () => {
    const looks = ROSTER.map((f) => `${f.appearance.paletteKey}/${f.appearance.trunksKey}/${f.appearance.buildKey}`);
    expect(new Set(looks).size).toBe(looks.length);
  });

  it('throws on an unknown fighter rather than returning junk', () => {
    expect(() => getFighter('nobody')).toThrow();
  });
});

describe('venues', () => {
  it('provides the required three, with unique ids', () => {
    expect(VENUES.length).toBe(3);
    expect(new Set(VENUES.map((v) => v.id)).size).toBe(3);
  });

  it('gives each venue its own palette and name', () => {
    const backdrops = VENUES.map((v) => v.palette.backdrop);
    expect(new Set(backdrops).size).toBe(3);
    for (const v of VENUES) {
      expect(STRINGS[v.nameKey], `missing ${v.nameKey}`).toBeDefined();
      expect(STRINGS[v.descriptionKey], `missing ${v.descriptionKey}`).toBeDefined();
      expect(v.palette.rope.length).toBeGreaterThan(0);
      expect(v.crowdRows).toBeGreaterThan(0);
    }
  });

  it('throws on an unknown venue', () => {
    expect(() => getVenue('nowhere')).toThrow();
  });
});

describe('rulesets', () => {
  it('supports the required bout lengths', () => {
    expect([...BOUT_LENGTHS]).toEqual([3, 6, 10]);
    for (const n of BOUT_LENGTHS) {
      const r = makeRuleset(n);
      expect(r.rounds).toBe(n);
      expect(r.roundTicks).toBeGreaterThan(0);
      expect(r.countLimit).toBe(10);
      expect(r.scoring).toBe('ten_point_must');
      expect(r.judgeCount).toBe(3);
    }
  });

  it('expresses every duration in whole ticks', () => {
    for (const pace of Object.keys(ROUND_SECONDS) as (keyof typeof ROUND_SECONDS)[]) {
      const r = makeRuleset(6, pace);
      for (const v of [r.roundTicks, r.breakTicks, r.introTicks, r.countTicks]) {
        expect(Number.isInteger(v)).toBe(true);
      }
      expect(r.roundTicks).toBe(ROUND_SECONDS[pace] * TICK_RATE);
    }
  });
});

describe('the punch table', () => {
  it('defines every punch at both levels', () => {
    for (const id of PUNCH_IDS) {
      for (const level of ['head', 'body'] as TargetLevel[]) {
        const p = getPunch(id, level);
        expect(p.id).toBe(id);
        expect(p.startupTicks).toBeGreaterThan(0);
        expect(p.activeTicks).toBeGreaterThan(0);
        expect(p.recoveryTicks).toBeGreaterThan(0);
        expect(p.reach).toBeGreaterThan(p.minRange);
        expect(p.composureDamage).toBeGreaterThan(0);
        expect(p.scoreValue).toBeGreaterThan(0);
        expect(p.counterBonus).toBeGreaterThan(1);
        expect(p.vulnerableTo).toBeGreaterThan(p.vulnerableFrom);
        expect(STRINGS[p.nameKey], `missing ${p.nameKey}`).toBeDefined();
      }
    }
  });

  it('gives every punch a distinct tactical role', () => {
    // No punch may be strictly better than another: if it hits harder it must
    // be slower, shorter or more committal.
    const head = PUNCH_IDS.map((id) => getPunch(id, 'head'));
    for (const a of head) {
      for (const b of head) {
        if (a.id === b.id) continue;
        const strictlyBetter =
          a.composureDamage >= b.composureDamage &&
          a.reach >= b.reach &&
          a.startupTicks <= b.startupTicks &&
          a.recoveryTicks <= b.recoveryTicks &&
          a.exertionCost <= b.exertionCost;
        expect(strictlyBetter, `${a.id} strictly dominates ${b.id}`).toBe(false);
      }
    }
  });

  it('makes body shots trade knockdown pressure for lasting damage', () => {
    for (const id of PUNCH_IDS) {
      const head = getPunch(id, 'head');
      const body = getPunch(id, 'body');
      expect(body.composureDamage).toBeLessThan(head.composureDamage);
      expect(body.traumaDamage).toBeGreaterThan(head.traumaDamage);
      expect(body.staggerPower).toBeLessThan(head.staggerPower);
      expect(body.scoreValue).toBeLessThan(head.scoreValue);
    }
  });

  it('orders the jab as the fastest and the rear uppercut as the hardest', () => {
    const fastest = PUNCH_IDS.reduce((a, b) =>
      getPunch(a, 'head').startupTicks <= getPunch(b, 'head').startupTicks ? a : b,
    );
    const hardest = PUNCH_IDS.reduce((a, b) =>
      getPunch(a, 'head').composureDamage >= getPunch(b, 'head').composureDamage ? a : b,
    );
    expect(fastest).toBe('jab');
    expect(hardest).toBe('rear_upper');
  });

  it('exposes both level tables', () => {
    expect(Object.keys(PUNCH_TABLE.head).length).toBe(PUNCH_IDS.length);
    expect(Object.keys(PUNCH_TABLE.body).length).toBe(PUNCH_IDS.length);
  });
});

describe('AI data', () => {
  it('defines a profile for every archetype used by the roster', () => {
    for (const f of ROSTER) expect(AI_PROFILES[f.style.archetype], `no profile for ${f.style.archetype}`).toBeDefined();
    for (const a of MIRROR_ARCHETYPES) expect(AI_PROFILES[a]).toBeDefined();
  });

  it('gives every archetype a distinct preferred range and punch mix', () => {
    const ranges = MIRROR_ARCHETYPES.map((a) => AI_PROFILES[a].targetRange);
    expect(new Set(ranges).size).toBe(ranges.length);
    const mixes = MIRROR_ARCHETYPES.map((a) => Object.values(AI_PROFILES[a].punchWeights).join(','));
    expect(new Set(mixes).size).toBe(mixes.length);
  });

  it('keeps every profile weight inside its stated bounds', () => {
    for (const a of MIRROR_ARCHETYPES) {
      const p = AI_PROFILES[a];
      for (const k of ['aggression', 'riskTolerance', 'bodyBias', 'counterAppetite', 'guardDiscipline', 'slipPreference', 'clinchAppetite'] as const) {
        expect(p[k], `${a}.${k}`).toBeGreaterThanOrEqual(0);
        expect(p[k], `${a}.${k}`).toBeLessThanOrEqual(1);
      }
      for (const id of PUNCH_IDS) expect(p.punchWeights[id as PunchId]).toBeGreaterThanOrEqual(0);
    }
  });

  it('names every difficulty in the string table', () => {
    for (const id of DIFFICULTY_IDS) {
      expect(STRINGS[DIFFICULTIES[id].nameKey], `missing ${DIFFICULTIES[id].nameKey}`).toBeDefined();
    }
  });
});

describe('input bindings', () => {
  it('binds every action on both devices by default', () => {
    for (const a of ACTIONS) {
      expect(DEFAULT_KEYBOARD[a], `keyboard missing ${a}`).toBeTruthy();
      expect(DEFAULT_GAMEPAD[a], `gamepad missing ${a}`).toBeTruthy();
      expect(STRINGS[`action.${a}`], `missing action.${a}`).toBeDefined();
    }
  });

  it('never binds two different keyboard actions to one key', () => {
    // Confirm and cancel deliberately share buttons with jab and cross on a
    // gamepad, but the keyboard defaults must be unambiguous.
    const used = Object.values(DEFAULT_KEYBOARD);
    expect(new Set(used).size).toBe(used.length);
  });

  it('marks the actions the remap screen refuses to leave unbound', () => {
    for (const a of REQUIRED_ACTIONS) expect(ACTIONS).toContain(a);
  });
});

describe('the string table', () => {
  it('resolves every key referenced by content', () => {
    const referenced = [
      ...STYLE_BASES.flatMap((s) => [s.nameKey, s.descriptionKey]),
      ...TRAINING_CATALOGUE_IDS.flatMap((id) => [`training.${id}.name`, `training.${id}.desc`]),
      ...MIRROR_ARCHETYPES.map((a) => `archetype.${a}`),
      'outcome.ko.count',
      'outcome.tko.head',
      'outcome.tko.body',
      'outcome.tko.threeKnockdown',
      'outcome.decision.unanimous',
      'outcome.decision.majority',
      'outcome.decision.split',
      'outcome.decision.draw',
      'referee.holding',
      'judge.vance',
      'judge.okonjo',
      'judge.serrano',
      'grade.allTime',
      'grade.great',
      'grade.champion',
      'grade.contender',
      'grade.journeyman',
      'grade.clubFighter',
      'ending.boutLimit',
      'ending.lossStreak',
      'ending.voluntary',
      'ending.refusedChallenge',
      'news.upset',
      'news.retired',
      'news.titleDefence',
      'news.refused',
      'news.rebuild',
    ];
    for (const key of referenced) {
      expect(STRINGS[key], `missing string: ${key}`).toBeDefined();
    }
  });

  it('has no blank entries', () => {
    for (const [k, v] of Object.entries(STRINGS)) {
      expect(v.length, `empty string for ${k}`).toBeGreaterThan(0);
    }
  });

  it('substitutes arguments and leaves unknown keys visible', () => {
    expect(t('training.picks', 3)).toContain('3');
    expect(t('definitely.not.a.key')).toBe('definitely.not.a.key');
  });

  it('formats money and records consistently', () => {
    expect(money(1_500_000)).toBe('$1.50M');
    expect(money(42_000)).toBe('$42k');
    expect(money(300)).toBe('$300');
    expect(record(10, 2, 0)).toBe('10-2');
    expect(record(10, 2, 1, 5)).toBe('10-2-1 (5 KO)');
  });

  it('contains no reference to the historical work this project draws on', () => {
    // The shipping build must be entirely original. This is a guard against a
    // stray name creeping into player-facing text.
    const forbidden = ['holyfield', 'sega', 'genesis', 'mega drive', 'real deal', 'evander'];
    const blob = JSON.stringify(STRINGS).toLowerCase();
    for (const word of forbidden) {
      expect(blob.includes(word), `string table mentions "${word}"`).toBe(false);
    }
  });
});
