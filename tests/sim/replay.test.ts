/**
 * Golden replay.
 *
 * The determinism suite proves the simulation agrees with itself inside one
 * process. That is necessary and nowhere near sufficient: it would pass
 * unchanged through any balance edit, because both sides of the comparison move
 * together. These tests compare against `tests/fixtures/replay.json` — bytes
 * committed in an earlier commit and reviewed as a diff.
 *
 * When a test here fails, the simulation changed. That is often correct and
 * intended. The fix is `npm run fixture:replay`, and the resulting diff is the
 * record of what the change did to the model.
 */
import { describe, expect, it } from 'vitest';
import { BoutSim } from '@sim/bout';
import { simulateAiBout } from '@sim/runner';
import { makeRuleset } from '@data/rulesets';
import { getFighter } from '@data/fighters';
import { DIFFICULTIES, type DifficultyId } from '@ai/profiles';
import { Rng } from '@sim/rng';
import { emptyCommand, PUNCH_IDS, type BoutConfig, type FighterCommand, type PunchId } from '@sim/types';
import { decodeCommands, encodeCommands, digest, packCommand, unpackCommand } from '@sim/codec';
import { contentHashes } from '@data/content-hash';
import { readFixture, runScripted, scriptedCommands, REPLAY_FORMAT_VERSION } from '../../tools/replay-fixture';

const fixture = readFixture();

function makeConfig(seed: number, rounds: number, fighters: [string, string]): BoutConfig {
  return {
    seed,
    ruleset: makeRuleset(rounds as 3 | 6 | 10, 'broadcast'),
    venueId: 'ironworks',
    fighters: [getFighter(fighters[0]), getFighter(fighters[1])],
  };
}

describe('golden replay fixture', () => {
  it('is in a format this build understands', () => {
    expect(fixture.formatVersion).toBe(REPLAY_FORMAT_VERSION);
    expect(fixture.tickRate).toBe(60);
  });

  it('carries an intact, self-contained command stream', () => {
    // The fixture stores the commands rather than a recipe for producing them,
    // so verification does not depend on the generator still being the same.
    const { scripted } = fixture;
    expect(digest(scripted.commands), 'stored command stream is corrupt').toBe(scripted.commandsHash);
    const decoded = decodeCommands(scripted.commands);
    expect(decoded.length).toBe(scripted.tickCount);
  });

  it('was recorded against the current content data', () => {
    /*
     * Distinguishes a data edit from a combat-model edit. Without this, a
     * change to a punch's reach and a change to the damage formula produce the
     * same failure message, and the first place anyone looks is the wrong one.
     */
    expect(contentHashes()).toEqual(fixture.contentHashes);
  });

  it('reproduces every pinned checkpoint hash from the committed command stream', () => {
    const { scripted } = fixture;
    expect(scripted.checkpoints.length).toBeGreaterThan(5);

    const result = runScripted(decodeCommands(scripted.commands));
    expect(result.checkpoints, 'checkpoint hashes diverged from the fixture').toEqual(scripted.checkpoints);
    expect(result.finalHash, 'final scripted hash diverged from the fixture').toBe(scripted.finalHash);
    expect(result.outcome).toEqual(scripted.outcome);
  });

  it('still matches the generator that recorded it', () => {
    /*
     * Advisory, not the contract — the committed commands are the contract, and
     * the tests above verify against those. This reports that the recipe and
     * the recording have not silently parted company, which would mean the next
     * `npm run fixture:replay` quietly changes the inputs as well as the
     * outputs, and the resulting diff would be much harder to read.
     */
    const regenerated = encodeCommands(scriptedCommands(fixture.scripted.tickCount));
    expect(
      digest(regenerated),
      'scriptedCommands() no longer produces the stream this fixture recorded — ' +
        'regenerate the fixture in its own commit so the input change is reviewable',
    ).toBe(fixture.scripted.commandsHash);
  });

  it('reproduces every pinned AI bout exactly', () => {
    expect(fixture.aiBouts.length).toBeGreaterThan(0);
    for (const pinned of fixture.aiBouts) {
      const result = simulateAiBout(
        makeConfig(pinned.seedSet.simulation, pinned.config.rounds, pinned.config.fighters),
        { difficulty: DIFFICULTIES[pinned.difficulty as DifficultyId] },
      );
      const where = `ai bout seed ${pinned.seedSet.simulation}`;
      expect(result.finalHash, `${where}: final hash`).toBe(pinned.finalHash);
      expect(result.ticks, `${where}: tick count`).toBe(pinned.ticks);
      expect(result.outcome.kind, `${where}: outcome kind`).toBe(pinned.outcome.kind);
      expect(result.outcome.winner ?? null, `${where}: winner`).toBe(pinned.outcome.winner);
      expect(result.outcome.round, `${where}: round`).toBe(pinned.outcome.round);
      expect(result.knockdowns, `${where}: knockdowns`).toEqual(pinned.knockdowns);
      for (const corner of [0, 1] as const) {
        expect(result.stats[corner].thrown, `${where}: corner ${corner} thrown`).toBe(pinned.stats[corner].thrown);
        expect(result.stats[corner].landed, `${where}: corner ${corner} landed`).toBe(pinned.stats[corner].landed);
      }
    }
  });
});

describe('state hash completeness', () => {
  function stepped(seed: number, ticks: number): BoutSim {
    const sim = new BoutSim(makeConfig(seed, 3, ['nikolai_vasque', 'bram_holt']));
    const script = scriptedCommands(ticks);
    for (let i = 0; i < ticks && !sim.isComplete; i++) sim.tick(script[i]);
    return sim;
  }

  it('covers the random stream position', () => {
    // Two bouts in visibly identical states that will diverge on the next
    // draw must not hash the same. This is the failure the old hash allowed:
    // it described the present without describing what came next.
    const a = stepped(9_001, 120);
    const b = stepped(9_001, 120);
    expect(b.hashState()).toBe(a.hashState());

    (b as unknown as { rng: Rng }).rng.next();
    expect(b.hashState(), 'advancing the RNG left the hash unchanged').not.toBe(a.hashState());
  });

  /*
   * A completeness check that maintains itself. Every field on FighterState is
   * perturbed in turn; each one must move the hash. A field added later without
   * a matching line in hashState() fails here rather than surfacing as an
   * unreproducible replay months afterwards.
   */
  it('covers every field on FighterState', () => {
    const sim = stepped(9_002, 150);
    const baseline = sim.hashState();
    const fighter = sim.state.fighters[0] as unknown as Record<string, unknown>;
    const keys = Object.keys(fighter);
    expect(keys.length).toBeGreaterThan(25);

    for (const key of keys) {
      const original = fighter[key];
      if (typeof original === 'number') fighter[key] = original + 7;
      else if (typeof original === 'string') fighter[key] = `${original}~`;
      else if (typeof original === 'boolean') fighter[key] = !original;
      else fighter[key] = original === null ? 'jab' : null;

      expect(sim.hashState(), `FighterState.${key} is missing from hashState()`).not.toBe(baseline);
      fighter[key] = original;
    }

    // And the restore is exact, so the perturbations left nothing behind.
    expect(sim.hashState()).toBe(baseline);
  });

  it('covers the simulation-owned timers that no fighter field carries', () => {
    const sim = stepped(9_003, 200);
    const baseline = sim.hashState();
    const internals = sim as unknown as Record<string, number>;

    for (const key of ['clinchCooldown', 'clinchTimer']) {
      const original = internals[key];
      internals[key] = original + 5;
      expect(sim.hashState(), `BoutSim.${key} is missing from hashState()`).not.toBe(baseline);
      internals[key] = original;
    }

    const state = sim.state as unknown as Record<string, number>;
    const totalTicks = state.totalTicks;
    state.totalTicks = totalTicks + 3;
    expect(sim.hashState(), 'BoutState.totalTicks is missing from hashState()').not.toBe(baseline);
    state.totalTicks = totalTicks;

    expect(sim.hashState()).toBe(baseline);
  });

  it('covers the round in progress, which decides a bout that goes the distance', () => {
    const sim = stepped(9_004, 300);
    const baseline = sim.hashState();
    const score = (sim as unknown as { currentScore: { clean: [number, number] } }).currentScore;
    const original = score.clean[0];
    score.clean[0] = original + 4;
    expect(sim.hashState(), 'the in-progress scorecard is missing from hashState()').not.toBe(baseline);
    score.clean[0] = original;
    expect(sim.hashState()).toBe(baseline);
  });
});

describe('scripted stream sanity', () => {
  it('produces a contested bout rather than two fighters missing each other', () => {
    // A fixture that pins an empty bout pins nothing. This asserts the stream
    // actually exercises the combat model.
    const sim = new BoutSim(
      makeConfig(fixture.scripted.seedSet.simulation, fixture.scripted.config.rounds, fixture.scripted.config.fighters),
    );
    const script: [FighterCommand, FighterCommand][] = decodeCommands(fixture.scripted.commands);
    for (let i = 0; i < script.length && !sim.isComplete; i++) sim.tick(script[i]);

    for (const corner of [0, 1] as const) {
      const s = sim.stats(corner);
      expect(s.thrown, `corner ${corner} threw nothing`).toBeGreaterThan(10);
      expect(s.landed, `corner ${corner} landed nothing`).toBeGreaterThan(0);
    }
    expect(emptyCommand().punch).toBeNull();
  });
});

describe('command codec', () => {
  it('round-trips every reachable command exactly', () => {
    // Exhaustive, because the domain is small and a lossy codec would corrupt
    // every fixture recorded with it while still appearing to work.
    const MOVES = [-1, 0, 1];
    const PUNCHES = [null, ...PUNCH_IDS] as (PunchId | null)[];
    let checked = 0;
    for (const moveX of MOVES) {
      for (const moveZ of MOVES) {
        for (const slip of MOVES) {
          for (const punch of PUNCHES) {
            for (const flags of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
              const c: FighterCommand = {
                moveX,
                moveZ,
                slip,
                punch,
                guard: (flags & 1) !== 0,
                crouch: (flags & 2) !== 0,
                clinch: (flags & 4) !== 0,
                recover: (flags & 8) !== 0,
              };
              expect(unpackCommand(packCommand(c))).toEqual(c);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBe(3 * 3 * 3 * 7 * 16);
  });

  it('packs into the three hex characters the format assumes', () => {
    const c = emptyCommand();
    c.moveX = 1;
    c.moveZ = -1;
    c.slip = 1;
    c.punch = 'rear_upper';
    c.guard = true;
    c.crouch = true;
    c.clinch = true;
    c.recover = true;
    expect(packCommand(c)).toBeLessThan(0x1000);
  });

  it('round-trips a whole stream through the text encoding', () => {
    const stream = scriptedCommands(400);
    expect(decodeCommands(encodeCommands(stream))).toEqual(stream);
  });

  it('refuses a truncated stream rather than decoding it wrongly', () => {
    expect(() => decodeCommands('abc')).toThrow(/whole number of ticks/);
  });
});
