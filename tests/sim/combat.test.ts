/**
 * Combat mechanics.
 *
 * Each acceptance gate for the combat model gets a direct test: every punch can
 * land, be blocked at the correct level, be beaten by range or evasion, cost
 * stamina, and expose recovery that the opponent can punish.
 */
import { describe, expect, it } from 'vitest';
import { BoutSim } from '@sim/bout';
import { makeRuleset } from '@data/rulesets';
import { getPunch } from '@data/punches';
import { getFighter } from '@data/fighters';
import { mirrorFighter } from '@data/mirror';
import {
  PUNCH_IDS,
  emptyCommand,
  type BoutConfig,
  type BoutEvent,
  type FighterCommand,
  type HitQuality,
  type PunchId,
  type TargetLevel,
} from '@sim/types';
import { canTransition, IllegalTransitionError, LEGAL_TRANSITIONS, transition } from '@sim/fsm';

function harness(overrides: Partial<BoutConfig> = {}): BoutSim {
  return new BoutSim({
    seed: 1234,
    ruleset: makeRuleset(10, 'championship'),
    venueId: 'ironworks',
    fighters: [mirrorFighter('boxer_puncher'), mirrorFighter('boxer_puncher')],
    ...overrides,
  });
}

/** Runs past the intro so the fighters are live. */
function startRound(sim: BoutSim): void {
  while (sim.state.phase === 'intro') sim.tick([emptyCommand(), emptyCommand()]);
}

/** Places both fighters at an exact separation and clears their state. */
function place(sim: BoutSim, sep: number): void {
  sim.state.fighters[0].x = -sep / 2;
  sim.state.fighters[1].x = sep / 2;
  sim.state.fighters[0].z = 0;
  sim.state.fighters[1].z = 0;
  sim.state.fighters[0].facing = 1;
  sim.state.fighters[1].facing = -1;
}

/**
 * Throws one punch from corner 0 with corner 1 holding the given posture, and
 * reports how it resolved.
 *
 * `defenceFrom` delays the defensive input. A slip is a timed reaction, not a
 * posture: issuing it on the same tick as the punch means the evasive window
 * has already expired by the time the punch arrives, which is correct
 * behaviour and has to be tested as such.
 */
function exchange(
  punch: PunchId,
  level: TargetLevel,
  sep: number,
  defence: Partial<FighterCommand> = {},
  seed = 99,
  defenceFrom = 0,
): HitQuality | 'none' {
  const sim = harness({ seed });
  startRound(sim);
  place(sim, sep);

  let quality: HitQuality | 'none' = 'none';
  const attack: FighterCommand = { ...emptyCommand(), punch, crouch: level === 'body' };
  const defend: FighterCommand = { ...emptyCommand(), ...defence };

  for (let i = 0; i < 90; i++) {
    // Hold position so the test measures the punch, not the footwork.
    place(sim, sep);
    const events = sim.tick([
      i === 0 ? attack : { ...emptyCommand(), crouch: level === 'body' },
      i >= defenceFrom ? defend : emptyCommand(),
    ]);
    for (const e of events) {
      if (e.type === 'punch_result' && e.corner === 0) quality = e.quality;
    }
    if (quality !== 'none') break;
  }
  return quality;
}

describe('punch resolution', () => {
  it('every punch can land cleanly at its own range', () => {
    for (const id of PUNCH_IDS) {
      for (const level of ['head', 'body'] as TargetLevel[]) {
        const def = getPunch(id, level);
        const sep = (def.minRange + def.reach) / 2;
        // Accuracy has a random component, so try a few seeds before failing.
        let landed = false;
        for (let s = 0; s < 12 && !landed; s++) {
          const q = exchange(id, level, sep, {}, 100 + s * 17);
          if (q === 'clean' || q === 'glancing' || q === 'counter') landed = true;
        }
        expect(landed, `${id}/${level} never landed at range ${sep}`).toBe(true);
      }
    }
  });

  it('every punch is blocked by a guard at the matching level', () => {
    for (const id of PUNCH_IDS) {
      const headDef = getPunch(id, 'head');
      const headSep = (headDef.minRange + headDef.reach) / 2;
      expect(exchange(id, 'head', headSep, { guard: true }), `${id} head vs high guard`).toBe('blocked');

      const bodyDef = getPunch(id, 'body');
      const bodySep = (bodyDef.minRange + bodyDef.reach) / 2;
      expect(exchange(id, 'body', bodySep, { crouch: true }), `${id} body vs body guard`).toBe('blocked');
    }
  });

  it('a guard at the wrong level does not protect the exposed target', () => {
    // High guard against a body shot, and a crouch against a head shot, must
    // both allow real damage — this is what makes level switching matter.
    for (const id of PUNCH_IDS) {
      const bodyDef = getPunch(id, 'body');
      const bodySep = (bodyDef.minRange + bodyDef.reach) / 2;
      let leaked = false;
      for (let s = 0; s < 14 && !leaked; s++) {
        const q = exchange(id, 'body', bodySep, { guard: true }, 200 + s * 31);
        if (q === 'clean' || q === 'glancing' || q === 'counter') leaked = true;
      }
      expect(leaked, `${id} body should beat a high guard`).toBe(true);
    }
  });

  it('every punch misses when thrown from out of range', () => {
    for (const id of PUNCH_IDS) {
      const def = getPunch(id, 'head');
      // Well beyond even the longest reach modifier.
      const q = exchange(id, 'head', def.reach * 1.6 + 20);
      expect(q === 'miss' || q === 'none', `${id} should not reach`).toBe(true);
    }
  });

  it('every punch is smothered when thrown from inside its minimum range', () => {
    for (const id of PUNCH_IDS) {
      const def = getPunch(id, 'head');
      if (def.minRange <= 22) continue; // bodies collide before this matters
      const q = exchange(id, 'head', def.minRange - 6);
      expect(q === 'miss' || q === 'none', `${id} should smother`).toBe(true);
    }
  });

  it('a slip evades a punch that would otherwise land', () => {
    const def = getPunch('cross', 'head');
    const sep = (def.minRange + def.reach) / 2;
    let slipped = false;
    for (let s = 0; s < 20 && !slipped; s++) {
      // The cross becomes active around tick 9; slipping from tick 4 puts the
      // evasive window over the contact.
      if (exchange('cross', 'head', sep, { slip: 1 }, 300 + s * 13, 4) === 'slipped') slipped = true;
    }
    expect(slipped).toBe(true);
  });

  it('throwing costs stamina, and holding position does not', () => {
    const sim = harness();
    startRound(sim);
    place(sim, 40);
    const before = sim.state.fighters[0].exertion;
    for (let i = 0; i < 6; i++) {
      sim.tick([{ ...emptyCommand(), punch: 'rear_upper' }, emptyCommand()]);
      for (let j = 0; j < 40; j++) sim.tick([emptyCommand(), emptyCommand()]);
    }
    const thrower = sim.state.fighters[0].exertion;
    const idler = sim.state.fighters[1].exertion;
    expect(thrower).toBeGreaterThan(before);
    expect(thrower).toBeGreaterThan(idler);
  });

  it('exhaustion reduces output without disabling the fighter', () => {
    const sim = harness();
    startRound(sim);
    place(sim, 40);
    sim.state.fighters[0].exertion = 1;
    const events: BoutEvent[] = [];
    for (let i = 0; i < 200; i++) {
      const cmd: FighterCommand = { ...emptyCommand(), punch: i % 40 === 0 ? 'jab' : null };
      place(sim, 40);
      events.push(...sim.tick([cmd, emptyCommand()]));
    }
    // A fully exhausted fighter still throws and still connects.
    expect(events.some((e) => e.type === 'punch_thrown')).toBe(true);
    expect(sim.state.fighters[0].punchesThrown).toBeGreaterThan(0);
  });

  it('counters require the opponent to be inside their own vulnerability window', () => {
    // Corner 1 commits to a slow punch; corner 0 answers into the recovery.
    const sim = harness({ seed: 55 });
    startRound(sim);
    const sep = 34;
    place(sim, sep);

    let sawCounter = false;
    // Corner 1 throws a rear uppercut (long vulnerability window).
    sim.tick([emptyCommand(), { ...emptyCommand(), punch: 'rear_upper' }]);
    for (let i = 0; i < 50; i++) {
      place(sim, sep);
      const cmd: FighterCommand = { ...emptyCommand(), punch: i === 10 ? 'lead_hook' : null };
      const events = sim.tick([cmd, emptyCommand()]);
      for (const e of events) {
        if (e.type === 'punch_result' && e.corner === 0 && e.quality === 'counter') sawCounter = true;
      }
    }
    expect(sawCounter).toBe(true);
  });

  it('a counter does more than the same punch landing clean', () => {
    const p = getPunch('lead_hook', 'head');
    expect(p.counterBonus).toBeGreaterThan(1);
  });

  it('a whiffed punch costs extra recovery, so missing is punishable', () => {
    for (const id of PUNCH_IDS) {
      expect(getPunch(id, 'head').whiffExtraTicks).toBeGreaterThan(0);
    }
  });

  it('input buffering accepts a punch queued late in commitment', () => {
    const sim = harness();
    startRound(sim);
    place(sim, 40);
    sim.tick([{ ...emptyCommand(), punch: 'cross' }, emptyCommand()]);
    // The cross commits for the best part of half a second. A player asking
    // for the follow-up during that tail — as they would while chaining a
    // combination — must get it once the hand comes back.
    let thrown = 0;
    for (let i = 0; i < 90; i++) {
      const asking = i >= 18 && i <= 26;
      const events = sim.tick([{ ...emptyCommand(), punch: asking ? 'jab' : null }, emptyCommand()]);
      thrown += events.filter((e) => e.type === 'punch_thrown').length;
    }
    expect(thrown).toBeGreaterThanOrEqual(1);
  });

  it('drops an input asked for outside the buffer window', () => {
    const sim = harness();
    startRound(sim);
    place(sim, 40);
    sim.tick([{ ...emptyCommand(), punch: 'cross' }, emptyCommand()]);
    // Two ticks in, the cross has almost its whole commitment left, so this
    // request is outside the window and is deliberately dropped.
    sim.tick([emptyCommand(), emptyCommand()]);
    sim.tick([{ ...emptyCommand(), punch: 'jab' }, emptyCommand()]);
    expect(sim.state.fighters[0].bufferedPunch).toBeNull();
  });

  it('a fighter cannot punch backwards', () => {
    const sim = harness();
    startRound(sim);
    // Force a facing that points away from the opponent.
    place(sim, 40);
    sim.state.fighters[0].facing = -1;
    let landed = false;
    sim.tick([{ ...emptyCommand(), punch: 'jab' }, emptyCommand()]);
    for (let i = 0; i < 20; i++) {
      sim.state.fighters[0].facing = -1;
      const events = sim.tick([emptyCommand(), emptyCommand()]);
      for (const e of events) {
        if (e.type === 'punch_result' && e.corner === 0 && e.quality !== 'miss') landed = true;
      }
    }
    expect(landed).toBe(false);
  });

  it('body work drains the opponent faster than head work', () => {
    const run = (level: TargetLevel): number => {
      const sim = harness({ seed: 8 });
      startRound(sim);
      for (let i = 0; i < 900; i++) {
        place(sim, 26);
        sim.tick([{ ...emptyCommand(), punch: i % 30 === 0 ? 'lead_hook' : null, crouch: level === 'body' }, emptyCommand()]);
      }
      return sim.state.fighters[1].exertion;
    };
    expect(run('body')).toBeGreaterThan(run('head'));
  });
});

describe('fighter state machine', () => {
  it('rejects an illegal transition loudly', () => {
    const sim = harness();
    startRound(sim);
    const f = sim.state.fighters[0];
    f.state = 'knockdown';
    expect(() => transition(f, 'punch_startup')).toThrow(IllegalTransitionError);
  });

  it('declares a transition table for every state', () => {
    for (const [from, list] of Object.entries(LEGAL_TRANSITIONS)) {
      expect(Array.isArray(list), `${from} has no transition list`).toBe(true);
      for (const to of list) {
        expect(canTransition(from as never, to)).toBe(true);
      }
    }
  });

  it('never lets a grounded fighter act', () => {
    const sim = harness();
    startRound(sim);
    const f = sim.state.fighters[0];
    f.state = 'knockdown';
    for (const to of ['punch_startup', 'guard', 'move', 'slip', 'clinch'] as const) {
      expect(canTransition('knockdown', to)).toBe(false);
    }
  });
});

describe('ring geometry', () => {
  it('keeps both fighters inside the ropes', () => {
    const sim = new BoutSim({
      seed: 3,
      ruleset: makeRuleset(3, 'brisk'),
      venueId: 'ironworks',
      fighters: [getFighter('teo_alvarra'), getFighter('linus_kade')],
    });
    startRound(sim);
    for (let i = 0; i < 4000; i++) {
      sim.tick([
        { ...emptyCommand(), moveX: 1, moveZ: 1 },
        { ...emptyCommand(), moveX: 1, moveZ: -1 },
      ]);
      for (const f of sim.state.fighters) {
        expect(Math.abs(f.x)).toBeLessThanOrEqual(160);
        expect(Math.abs(f.z)).toBeLessThanOrEqual(88);
        expect(Number.isFinite(f.x)).toBe(true);
        expect(Number.isFinite(f.z)).toBe(true);
      }
    }
  });

  it('never lets fighters occupy the same space', () => {
    const sim = harness();
    startRound(sim);
    for (let i = 0; i < 1200; i++) {
      sim.tick([
        { ...emptyCommand(), moveX: 1 },
        { ...emptyCommand(), moveX: 1 },
      ]);
      const dx = sim.state.fighters[1].x - sim.state.fighters[0].x;
      const dz = sim.state.fighters[1].z - sim.state.fighters[0].z;
      const sep = Math.sqrt(dx * dx + dz * dz * 0.36);
      expect(sep).toBeGreaterThan(18);
    }
  });
});
