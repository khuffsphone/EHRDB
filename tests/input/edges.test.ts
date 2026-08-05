/**
 * Input edges and the fixed-step catch-up loop.
 *
 * The bout scene samples the device once per rendered frame, then steps the
 * simulation as many times as the elapsed time requires. Level state — a held
 * direction, a held guard — genuinely applies to every one of those ticks.
 * An edge does not: a press happened once, and feeding it to two or three
 * consecutive ticks queues punches the player never asked for, precisely on
 * the frames where the game is already stuttering.
 *
 * The scene itself needs a WebGL context to instantiate, so these tests pin
 * the two halves separately: that `levelOnly` consumes edges correctly, and
 * that reusing an unconsumed edge across catch-up ticks really does produce
 * extra punches in the simulation — which is what makes this a gameplay bug
 * rather than a determinism footnote.
 */
import { describe, expect, it } from 'vitest';
import { levelOnly, type InputSnapshot } from '@input/manager';
import { ACTIONS, type Action } from '@input/actions';
import { BoutSim } from '@sim/bout';
import { makeRuleset } from '@data/rulesets';
import { getFighter } from '@data/fighters';
import { emptyCommand, type BoutConfig, type FighterCommand } from '@sim/types';

function record(value = false): Record<Action, boolean> {
  const r = {} as Record<Action, boolean>;
  for (const a of ACTIONS) r[a] = value;
  return r;
}

function snapshot(): InputSnapshot {
  const held = record();
  const pressed = record();
  const released = record();
  held.right = true;
  held.guard = true;
  pressed.jab = true;
  released.cross = true;
  return { held, pressed, released, axisX: 0.5, axisY: -0.25, lastDevice: 'keyboard' };
}

describe('levelOnly', () => {
  it('clears every edge', () => {
    const consumed = levelOnly(snapshot());
    for (const a of ACTIONS) {
      expect(consumed.pressed[a], `pressed.${a}`).toBe(false);
      expect(consumed.released[a], `released.${a}`).toBe(false);
    }
  });

  it('preserves level state and analogue values', () => {
    const original = snapshot();
    const consumed = levelOnly(original);
    expect(consumed.held).toEqual(original.held);
    expect(consumed.axisX).toBe(original.axisX);
    expect(consumed.axisY).toBe(original.axisY);
    expect(consumed.lastDevice).toBe(original.lastDevice);
  });

  it('does not mutate the snapshot it was given', () => {
    const original = snapshot();
    levelOnly(original);
    expect(original.pressed.jab).toBe(true);
    expect(original.released.cross).toBe(true);
  });
});

describe('edge reuse across catch-up ticks', () => {
  function config(): BoutConfig {
    return {
      seed: 5150,
      ruleset: makeRuleset(3, 'broadcast'),
      venueId: 'ironworks',
      fighters: [getFighter('nikolai_vasque'), getFighter('bram_holt')],
    };
  }

  /*
   * Held constant across every configuration below, so the only variable is
   * how the ticks are grouped into frames:
   *
   *   - the same number of simulation ticks, so the bout reaches the same
   *     point and the same amount of fatigue and damage has accumulated;
   *   - presses at the same simulated *times*, not the same frame indices;
   *   - a cadence divisible by every frame size tested, so a press always
   *     lands on a frame boundary in all of them.
   *
   * The cadence is sparse on purpose. Pressing every frame saturates the
   * fighter — it is mid-punch or buffering continuously either way, and the
   * reuse is invisible because output is capped by the animation rather than
   * the input. The bug shows when a single punch is thrown into a still
   * fighter, which is also when a player would notice it.
   */
  const TOTAL_TICKS = 2400;
  const PRESS_EVERY_TICKS = 240;
  const EXPECTED_PRESSES = TOTAL_TICKS / PRESS_EVERY_TICKS;

  function run(steps: number, reuseEdges: boolean): number {
    const sim = new BoutSim(config());
    // Step out of the intro first: punches thrown during it are ignored, and
    // that would silently swallow the first press.
    while (sim.state.phase !== 'round_active' && !sim.isComplete) {
      sim.tick([emptyCommand(), emptyCommand()]);
    }
    const thrownBefore = sim.stats(0).thrown;

    for (let tick = 0; tick < TOTAL_TICKS && !sim.isComplete; tick += steps) {
      const pressedThisFrame = tick % PRESS_EVERY_TICKS === 0;
      for (let s = 0; s < steps && !sim.isComplete; s++) {
        const cmd: FighterCommand = emptyCommand();
        cmd.moveX = 1;
        if (pressedThisFrame && (s === 0 || reuseEdges)) cmd.punch = 'jab';
        sim.tick([cmd, emptyCommand()]);
      }
    }
    return sim.stats(0).thrown - thrownBefore;
  }

  it('throws more punches than the player asked for when edges are reused', () => {
    const consumed = run(3, false);
    const reused = run(3, true);

    // One press, one punch. That is the contract the player is working to.
    expect(consumed).toBe(EXPECTED_PRESSES);
    // The defect, demonstrated: the identical sequence of player presses
    // produces extra punches purely because the frame stalled. The repeats
    // land inside the input buffer window and queue a follow-up.
    expect(reused).toBeGreaterThan(consumed);
  });

  /*
   * The rates the unified playbook names, plus the acceptance-checklist
   * requirement of "no phantom edge inputs at catch-up rates from 1 to 60
   * ticks". `PRESS_EVERY_TICKS` is divisible by every one of them, so a press
   * always lands on a frame boundary and the configurations stay comparable.
   *
   * Rates above `MAX_CATCHUP` (8) are beyond what BoutScene will actually run
   * in one frame — it clamps and drops the accumulator instead. They are
   * tested anyway: the property belongs to the input contract, not to the
   * current value of a scene constant, and a later change to that constant
   * must not be able to reintroduce the defect.
   */
  const CATCH_UP_RATES = [1, 2, 3, 6, 12, 60];

  it.each(CATCH_UP_RATES)('issues exactly one punch per press at %i tick(s) of catch-up', (steps) => {
    expect(run(steps, false)).toBe(EXPECTED_PRESSES);
  });

  /*
   * The converse, so the tests above cannot pass vacuously.
   *
   * The threshold is three, not two, and the reason is worth recording: a
   * two-tick burst issues the press twice, but the second request arrives
   * while the fighter is committed and is buffered — and for a jab the
   * commitment outlasts `BUFFER_MAX_AGE`, so the buffered punch expires
   * unused. From three repeats on, one of them lands inside the window and
   * fires. The defect's severity scales with how long the frame stalled, which
   * is exactly backwards from what a player would want.
   *
   * Two ticks producing no phantom is a property of the buffer window for one
   * punch, not a reason the fix is unnecessary at that rate.
   */
  it.each(CATCH_UP_RATES.filter((s) => s >= 3))(
    'reusing an edge produces phantom punches at %i ticks of catch-up',
    (steps) => {
      expect(run(steps, true)).toBeGreaterThan(EXPECTED_PRESSES);
    },
  );
});
