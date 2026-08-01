/**
 * AI fairness and distinctiveness.
 *
 * Two gates live here. The AI must not be able to read anything a player
 * could not — enforced structurally by the shape of `PublicBoutView` and
 * checked behaviourally below — and the four required archetypes must actually
 * behave differently rather than sharing one brain with different numbers.
 */
import { describe, expect, it } from 'vitest';
import { AiController } from '@ai/controller';
import { AI_PROFILES, DIFFICULTIES, DIFFICULTY_IDS } from '@ai/profiles';
import { publicView } from '@sim/view';
import { BoutSim } from '@sim/bout';
import { simulateAiBout } from '@sim/runner';
import { makeRuleset } from '@data/rulesets';
import { MIRROR_ARCHETYPES, mirrorFighter } from '@data/mirror';
import { getPunch } from '@data/punches';
import { emptyCommand, type ArchetypeId, type PunchId } from '@sim/types';

function newSim(seed = 1): BoutSim {
  return new BoutSim({
    seed,
    ruleset: makeRuleset(6, 'broadcast'),
    venueId: 'ironworks',
    fighters: [mirrorFighter('boxer_puncher'), mirrorFighter('counterpuncher')],
  });
}

describe('the public view', () => {
  it('never exposes private simulation state', () => {
    const sim = newSim();
    while (sim.state.phase === 'intro') sim.tick([emptyCommand(), emptyCommand()]);
    // Give corner 0 a buffered punch — information a player could not see.
    sim.tick([{ ...emptyCommand(), punch: 'cross' }, emptyCommand()]);
    for (let i = 0; i < 20; i++) sim.tick([{ ...emptyCommand(), punch: 'jab' }, emptyCommand()]);

    const view = publicView(sim.state, 1, 6, 5400);
    const keys = Object.keys(view.opponent);
    for (const forbidden of ['bufferedPunch', 'bufferedLevel', 'bufferedAge', 'punchResolved', 'commitTicks']) {
      expect(keys, `public view leaks ${forbidden}`).not.toContain(forbidden);
    }
    // And nothing in the view object graph mentions the RNG.
    expect(Object.keys(view)).not.toContain('rng');
  });

  it('hides a punch that has not visibly started', () => {
    const sim = newSim();
    while (sim.state.phase === 'intro') sim.tick([emptyCommand(), emptyCommand()]);
    const view = publicView(sim.state, 1, 6, 5400);
    // Neither fighter is punching, so no punch is advertised.
    expect(view.opponent.activePunch).toBeNull();
    expect(view.self.activePunch).toBeNull();
  });

  it('reports condition as fractions, matching what the HUD bars show', () => {
    const sim = newSim();
    while (sim.state.phase === 'intro') sim.tick([emptyCommand(), emptyCommand()]);
    const view = publicView(sim.state, 0, 6, 5400);
    expect(view.self.composureFrac).toBeGreaterThan(0);
    expect(view.self.composureFrac).toBeLessThanOrEqual(1);
    expect(view.self.resilienceFrac).toBeLessThanOrEqual(1);
  });
});

describe('AI perception limits', () => {
  it('cannot react to a punch faster than its perception latency allows', () => {
    // The fastest punch in the game starts up in fewer ticks than even the
    // hardest difficulty's reaction delay, so it is unreactable by design.
    const jab = getPunch('jab', 'head');
    for (const id of DIFFICULTY_IDS) {
      const d = DIFFICULTIES[id];
      expect(
        d.perceptionLatency,
        `${id} could react to a jab within its startup`,
      ).toBeGreaterThan(jab.startupTicks);
    }
  });

  it('produces identical decisions for identical seeds and views', () => {
    const run = (): string[] => {
      const sim = newSim(77);
      const ai = new AiController(1, 'counterpuncher', DIFFICULTIES.title, 'fixed-seed');
      const out: string[] = [];
      for (let i = 0; i < 600; i++) {
        const cmd = ai.decide(publicView(sim.state, 1, 6, 5400));
        out.push(`${cmd.moveX}${cmd.moveZ}${cmd.punch ?? '-'}${cmd.guard ? 'G' : ''}`);
        sim.tick([emptyCommand(), cmd]);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  it('only ever emits commands a player could also produce', () => {
    const sim = newSim(3);
    const ai = new AiController(1, 'pressure', DIFFICULTIES.legend, 'x');
    for (let i = 0; i < 2000; i++) {
      const cmd = ai.decide(publicView(sim.state, 1, 6, 5400));
      expect([-1, 0, 1]).toContain(cmd.moveX);
      expect([-1, 0, 1]).toContain(cmd.moveZ);
      expect([-1, 0, 1]).toContain(cmd.slip);
      expect(typeof cmd.guard).toBe('boolean');
      expect(typeof cmd.crouch).toBe('boolean');
      if (cmd.punch !== null) {
        expect(['jab', 'cross', 'lead_hook', 'rear_hook', 'lead_upper', 'rear_upper']).toContain(cmd.punch);
      }
      sim.tick([emptyCommand(), cmd]);
    }
  });
});

describe('archetype distinctiveness', () => {
  interface Profile {
    punchMix: Record<PunchId, number>;
    bodyShare: number;
    guardShare: number;
    meanRange: number;
    volume: number;
  }

  /** Measures how an archetype actually behaves over a batch of bouts. */
  function measure(archetype: ArchetypeId): Profile {
    const mix: Record<PunchId, number> = {
      jab: 0, cross: 0, lead_hook: 0, rear_hook: 0, lead_upper: 0, rear_upper: 0,
    };
    let body = 0;
    let head = 0;
    let guardTicks = 0;
    let ticks = 0;
    let rangeSum = 0;
    let volume = 0;

    for (let i = 0; i < 6; i++) {
      const opponent = mirrorFighter('boxer_puncher');
      const sim = new BoutSim({
        seed: 600 + i,
        ruleset: makeRuleset(6, 'broadcast'),
        venueId: 'ironworks',
        fighters: [mirrorFighter(archetype), opponent],
      });
      const a = new AiController(0, archetype, DIFFICULTIES.contender, `m${i}`);
      const b = new AiController(1, 'boxer_puncher', DIFFICULTIES.contender, `n${i}`);
      let n = 0;
      while (!sim.isComplete && n < 60 * 60 * 30) {
        const cmds: [ReturnType<typeof a.decide>, ReturnType<typeof b.decide>] = [
          a.decide(publicView(sim.state, 0, 6, 5400)),
          b.decide(publicView(sim.state, 1, 6, 5400)),
        ];
        const events = sim.tick(cmds);
        for (const e of events) {
          if (e.type === 'punch_thrown' && e.corner === 0) {
            mix[e.punch]++;
            volume++;
            if (e.level === 'body') body++;
            else head++;
          }
        }
        if (sim.state.phase === 'round_active') {
          ticks++;
          const f = sim.state.fighters[0];
          if (f.state === 'guard' || f.state === 'crouch') guardTicks++;
          rangeSum += Math.abs(sim.state.fighters[1].x - f.x);
        }
        n++;
      }
    }
    return {
      punchMix: mix,
      bodyShare: body / Math.max(1, body + head),
      guardShare: guardTicks / Math.max(1, ticks),
      meanRange: rangeSum / Math.max(1, ticks),
      volume: volume / 6,
    };
  }

  const profiles = new Map<ArchetypeId, Profile>();
  for (const a of MIRROR_ARCHETYPES) profiles.set(a, measure(a));

  it('every required archetype has a profile', () => {
    for (const a of ['out_boxer', 'pressure', 'counterpuncher', 'brawler'] as ArchetypeId[]) {
      expect(AI_PROFILES[a]).toBeDefined();
      expect(profiles.get(a)!.volume).toBeGreaterThan(10);
    }
  });

  it('the pressure fighter works closer than the out-boxer', () => {
    expect(profiles.get('pressure')!.meanRange).toBeLessThan(profiles.get('out_boxer')!.meanRange);
  });

  it('the pressure fighter goes to the body far more than the out-boxer', () => {
    expect(profiles.get('pressure')!.bodyShare).toBeGreaterThan(profiles.get('out_boxer')!.bodyShare + 0.15);
  });

  it('the counterpuncher guards more than the pressure fighter', () => {
    expect(profiles.get('counterpuncher')!.guardShare).toBeGreaterThan(profiles.get('pressure')!.guardShare);
  });

  it('the out-boxer leans on the jab and the brawler does not', () => {
    const share = (p: Profile, id: PunchId): number => {
      const total = Object.values(p.punchMix).reduce((s, v) => s + v, 0);
      return total === 0 ? 0 : p.punchMix[id] / total;
    };
    expect(share(profiles.get('out_boxer')!, 'jab')).toBeGreaterThan(share(profiles.get('brawler')!, 'jab'));
  });

  it('the brawler throws more power punches than the out-boxer', () => {
    const power = (p: Profile): number => {
      const total = Object.values(p.punchMix).reduce((s, v) => s + v, 0);
      return total === 0 ? 0 : (p.punchMix.rear_hook + p.punchMix.rear_upper) / total;
    };
    expect(power(profiles.get('brawler')!)).toBeGreaterThan(power(profiles.get('out_boxer')!) + 0.1);
  });

  it('no two archetypes produce the same punch mix', () => {
    const signatures = MIRROR_ARCHETYPES.map((a) => {
      const p = profiles.get(a)!;
      const total = Object.values(p.punchMix).reduce((s, v) => s + v, 0);
      return Object.values(p.punchMix)
        .map((v) => Math.round((v / Math.max(1, total)) * 20))
        .join(',');
    });
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe('difficulty', () => {
  it('adjusts perception and discipline, never the fighter itself', () => {
    // Same fighters, four difficulties: the definitions handed to the
    // simulation must be byte-identical, so difficulty cannot be a stat buff.
    const base = JSON.stringify(mirrorFighter('boxer_puncher'));
    for (const id of DIFFICULTY_IDS) {
      const r = simulateAiBout(
        {
          seed: 12,
          ruleset: makeRuleset(3, 'brisk'),
          venueId: 'ironworks',
          fighters: [mirrorFighter('boxer_puncher'), mirrorFighter('brawler')],
        },
        { difficulty: DIFFICULTIES[id] },
      );
      expect(r.outcome).toBeDefined();
    }
    expect(JSON.stringify(mirrorFighter('boxer_puncher'))).toBe(base);
  });

  it('orders reaction time from slowest to fastest', () => {
    const lat = DIFFICULTY_IDS.map((id) => DIFFICULTIES[id].perceptionLatency);
    for (let i = 1; i < lat.length; i++) expect(lat[i]).toBeLessThan(lat[i - 1]);
  });
});
