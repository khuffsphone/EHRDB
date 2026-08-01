# Content Schemas

All content is data, validated by `npm run assets:validate` before every build
and by `tests/content/content.test.ts`.

## FighterDefinition — `src/sim/types.ts`

```ts
{
  id: string                    // unique
  displayName: string           // unique
  nickname: string
  hometown: string
  stance: 'orthodox' | 'southpaw'
  body:      { heightCm, reachCm, massKg }
  ratings:   { power, stamina, speed, defense }              // 1..100, player-visible
  secondary: { chin, bodyToughness, recovery,
               footwork, accuracy, composure }                // 1..100, derived
  style:     { archetype, aggression, preferredRange, bodyAttackBias }
  appearance:{ paletteKey, trunksKey, buildKey, skinKey, hairKey }
}
```

`RosterEntry` extends it with `baseRank`, `startRecord`, `age` and `scoutKey`.

**Validated:** unique ids and names; dense starting ranks; every rating in
range; every appearance key defined; a scouting string for every fighter; every
required archetype present; no two fighters sharing a whole look.

## PunchDefinition — `src/data/punches.ts`

```ts
{
  id, nameKey, hand, family
  startupTicks, activeTicks, recoveryTicks, whiffExtraTicks
  reach, minRange, depthTolerance, movementAllowance
  composureDamage, resilienceDamage, traumaDamage, guardDamage
  exertionCost, scoreValue, counterBonus, staggerPower
  vulnerableFrom, vulnerableTo
}
```

Body variants are **derived** from head variants by a single function, so the
two levels can never drift apart structurally.

**Validated:** reach exceeds minimum range; the vulnerability window is
non-empty; the name key resolves; no punch strictly dominates another; body
variants trade knockdown pressure for lasting damage; the jab is the fastest
and the rear uppercut the hardest.

## VenueDefinition — `src/data/venues.ts`

```ts
{ id, nameKey, descriptionKey, palette{...}, crowdBase, crowdVolatility,
  musicKey, crowdRows, haze }
```

**Validated:** three venues, unique ids, distinct backdrops, resolving strings.

## Ruleset — `src/sim/types.ts`

```ts
{ id, rounds, roundTicks, breakTicks, introTicks, countTicks, countLimit,
  threeKnockdownRule, knockdownsForTko, refereeStoppage, scoring, judgeCount }
```

**Validated:** every duration is a whole number of ticks; round length matches
the declared pace; the supported lengths are exactly 3, 6 and 10.

## AiProfile — `src/ai/profiles.ts`

```ts
{ archetype, targetRange, rangeTolerance, aggression, riskTolerance, bodyBias,
  counterAppetite, guardDiscipline, slipPreference, clinchAppetite,
  punchWeights, movementHold }
```

**Validated:** every 0..1 field is in range; every archetype has a distinct
preferred range and a distinct punch-weight vector.

## TrainingOption — `src/career/types.ts`

```ts
{ id, nameKey, descriptionKey, gains, secondaryGains, wearCost, synergy }
```

Gains are **resolved** against the fighter and career stage before display, so
the number shown is the number applied.

## SaveFile — `src/save/schema.ts`

```ts
{ magic: 'TENCOUNT', version: number, savedAt: string,
  settings: {...}, career: CareerState | null,
  slots: Record<string, CareerState>, legacy: LegacyRecord[],
  quarantine?: { reason, raw } }
```

Migrations are ordered functions keyed by source version. Data is transformed,
never dropped. See `docs/CAREER_SPEC.md` and `tests/save/save.test.ts`.

## Commands and events

`FighterCommand` (the only way anything drives a fighter) and `BoutEvent` (the
only thing the presentation consumes) are defined in `src/sim/types.ts` and are
frozen interfaces: both the player's input layer and the AI produce identical
`FighterCommand` shapes.
