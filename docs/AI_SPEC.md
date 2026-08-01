# AI Specification

## Three layers

1. **Strategic plan** — re-chosen at round start and every 150 ticks:
   `establish_range`, `pressure_body`, `counter_lead`, `hunt_finish`,
   `protect_lead`, `recover`. Driven by archetype, condition, the round, and
   the state of the cards.
2. **Tactical utility** — every `decisionInterval` ticks, scores advance,
   retreat, circle, align, guard, crouch, slip, clinch and every legal punch at
   both levels, then takes the best with seeded noise.
3. **Motor execution** — converts the choice into the **same `FighterCommand`**
   a player's keyboard produces. Edge-triggered punches, held guard, real
   movement.

## Fairness

`AiController.decide` accepts only a `PublicBoutView` — positions, velocities,
visible action states, and condition **as fractions matching the HUD bars**. It
structurally cannot see:

- the opponent's buffered input,
- whether a punch has already resolved internally,
- commitment timers,
- the simulation's random stream,
- anything about future ticks.

Asserted by `tests/ai/fairness.test.ts`, which checks the view's own key set
and confirms the AI emits only commands a player could produce.

**Perception latency models reaction time, not blindness.** A fighter always
knows where they and their opponent are standing — that is continuous tracking.
What arrives late is the *news that something has started*. So geometry comes
from the live view while the reactive channel comes from a delayed one.

An earlier build delayed everything, including positions. The result was
fighters punching at where their opponent stood a fifth of a second ago and
missing 90%+ of the time.

The jab's 5-tick startup is shorter than every difficulty's perception latency,
so **the fastest punch in the game is unreactable at every difficulty** —
including Legend. Asserted directly.

## Archetypes

Differentiated by goals, not stat multipliers.

| Archetype | Range | Aggression | Guard | Punch mix | Counterplay |
|---|---|---|---|---|---|
| Out-boxer | 46 | 0.52 | 0.42 | Jab-dominant, long punches | Cut the ring, go to the body |
| Pressure | 27 | 0.90 | 0.28 | Hooks and uppercuts, ~45% body | Pivot, clinch, intercepting uppercut |
| Counterpuncher | 42 | 0.34 | 0.78 | Cross-heavy, punishes commitment | Feint, vary rhythm, body jab |
| Brawler | 33 | 0.66 | 0.30 | Rear hand, power-leaning | Make him miss; he fades |
| Boxer-puncher | 38 | 0.52 | 0.58 | Balanced | Force an uncomfortable pace |

Every archetype has a distinct preferred range and a distinct punch-weight
vector — enforced by `tests/content/content.test.ts`.

## Pacing

Fighters work in bursts and reset. The cooldown after a punch scales with that
punch's commitment — a jab is back almost immediately, a rear uppercut leaves
the fighter needing a beat — and with aggression. Without pacing the AI throws
roughly three times a real fighter's output, never guards, and turns every bout
into a shootout.

A repetition penalty stops any archetype collapsing onto a single punch.

## Difficulty

| | Latency | Decision interval | Noise | Read accuracy | Plan depth | Adaptation | Discipline |
|---|---|---|---|---|---|---|---|
| Club | 16 | 16 | 1.00 | 0.40 | 1 | 0.15 | 0.25 |
| Contender | 12 | 12 | 0.68 | 0.58 | 2 | 0.40 | 0.50 |
| Title | 9 | 9 | 0.44 | 0.72 | 3 | 0.65 | 0.75 |
| Legend | 7 | 7 | 0.30 | 0.84 | 3 | 0.85 | 0.92 |

Difficulty **never touches fighter ratings**. Asserted by comparing the fighter
definitions handed to the simulation across all four settings.

## Deadlock escape

A fighter pinned on the ropes breaks off regardless of plan. A fighter who has
thrown nothing for four seconds is forced to open up. Depth alignment is a
first-class action: without it fighters stack up laterally, drift apart
upstage/downstage, and every punch fails the depth check — which is exactly
what happened before it was added.

## Debug overlay

Settings → Developer → AI Intent Overlay shows the current plan, chosen action,
actual versus target range, confidence, the top five scored alternatives, and
ticks to the next decision. Off in normal play.
