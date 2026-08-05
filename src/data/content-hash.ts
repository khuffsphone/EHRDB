/**
 * Content digests.
 *
 * A replay fixture pins an outcome produced by a specific simulation *and* a
 * specific set of data: punch frame data, fighter ratings, AI profiles,
 * rulesets. If a punch's reach changes, the fixture's hashes will diverge — but
 * the failure would say only "hash mismatch", pointing at the combat model when
 * the cause was a data edit.
 *
 * These digests make the fixture able to say which. They are also the
 * `contentHashes` field the unified replay format requires.
 */
import { digest } from '@sim/codec';
import { ROSTER } from './fighters';
import { MIRROR_ROSTER } from './mirror';
import { VENUES } from './venues';
import { getPunch } from './punches';
import { makeRuleset } from './rulesets';
import { AI_PROFILES } from '@ai/profiles';
import { PUNCH_IDS, type ArchetypeId, type FighterDefinition, type TargetLevel } from '@sim/types';

export interface ContentHashes {
  punches: string;
  fighters: string;
  mirror: string;
  aiProfiles: string;
  rulesets: string;
  venues: string;
}

/*
 * Every digest is taken over a deterministically ordered, explicitly listed
 * projection rather than over `JSON.stringify` of the whole object. Key order
 * in a literal is stable in practice but not something a fixture should depend
 * on, and an explicit list makes it obvious which fields a fixture is
 * sensitive to.
 */
export function contentHashes(): ContentHashes {
  const punches = PUNCH_IDS.flatMap((id) =>
    (['head', 'body'] as TargetLevel[]).map((level) => {
      const p = getPunch(id, level);
      return [
        id,
        level,
        p.startupTicks,
        p.activeTicks,
        p.recoveryTicks,
        p.whiffExtraTicks,
        p.reach,
        p.minRange,
        p.depthTolerance,
        p.composureDamage,
        p.resilienceDamage,
        p.traumaDamage,
        p.guardDamage,
        p.exertionCost,
        p.scoreValue,
        p.counterBonus,
        p.staggerPower,
        p.vulnerableFrom,
        p.vulnerableTo,
      ].join(',');
    }),
  ).join('|');

  const fighter = (f: FighterDefinition): string =>
    [
      f.id,
      f.stance,
      f.body.heightCm,
      f.body.reachCm,
      f.body.massKg,
      f.ratings.power,
      f.ratings.stamina,
      f.ratings.speed,
      f.ratings.defense,
      f.secondary.chin,
      f.secondary.bodyToughness,
      f.secondary.recovery,
      f.secondary.footwork,
      f.secondary.accuracy,
      f.secondary.composure,
      f.style.archetype,
      f.style.aggression,
      f.style.preferredRange,
      f.style.bodyAttackBias,
    ].join(',');

  const profile = (a: ArchetypeId): string => {
    const p = AI_PROFILES[a];
    return [
      a,
      p.targetRange,
      p.rangeTolerance,
      p.aggression,
      p.riskTolerance,
      p.bodyBias,
      p.counterAppetite,
      p.guardDiscipline,
      p.slipPreference,
      p.clinchAppetite,
      p.movementHold,
      ...PUNCH_IDS.map((id) => p.punchWeights[id]),
    ].join(',');
  };

  const ruleset = ([3, 6, 10] as const)
    .map((rounds) => {
      const r = makeRuleset(rounds, 'broadcast');
      return [rounds, r.roundTicks, r.breakTicks, r.introTicks, r.countTicks, r.countLimit, r.knockdownsForTko].join(',');
    })
    .join('|');

  return {
    punches: digest(punches),
    fighters: digest(ROSTER.map(fighter).join('|')),
    mirror: digest(MIRROR_ROSTER.map(fighter).join('|')),
    aiProfiles: digest((Object.keys(AI_PROFILES) as ArchetypeId[]).sort().map(profile).join('|')),
    rulesets: digest(ruleset),
    venues: digest(VENUES.map((v) => v.id).join('|')),
  };
}
