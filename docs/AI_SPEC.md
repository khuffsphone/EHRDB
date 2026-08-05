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
| Out-boxer | 46 | 0.55 | 0.42 | Jab-dominant, long punches | Cut the ring, go to the body |
| Pressure | 29 | 0.90 | 0.30 | Hooks and uppercuts, ~35% body | Pivot, clinch, intercepting uppercut |
| Counterpuncher | 42 | 0.38 | 0.78 | Cross-heavy, punishes commitment | Feint, vary rhythm, body jab |
| Brawler | 35 | 0.56 | 0.22 | Rear hand, power-leaning, lowest volume | Make him miss; he fades |
| Boxer-puncher | 39 | 0.58 | 0.72 | Balanced, leads with what reaches | Force an uncomfortable pace |

Every archetype has a distinct preferred range and a distinct punch-weight
vector — enforced by `tests/content/content.test.ts` and
`tests/ai/fairness.test.ts`.

### What the balance pass changed, and what it must not

Bringing every archetype inside the documented band moved four of these five
numbers. Three of the moves fixed a design error rather than merely trading win
rate:

- **Pressure** targeted 27, one unit outside `RANGE.clinch`. The archetype
  meant to throw the most punches threw the fewest, because it spent the round
  tied up and its straight punches were gated out by range.
- **Boxer-puncher** stood at 38, inside `RANGE.pocket`, with neither the
  out-boxer's escape nor the brawler's power to justify being there. It took
  the most punishment in the game and carried the worst accuracy, because most
  of its weighted punches were short-reach ones thrown from too far out.
- **Brawler** was dominant and won 94% of its bouts by stoppage.

The brawler is the cautionary one. The first fix traded its rear-hand weight
for the jab. That balanced it and was wrong: its power-punch share fell from
31% to 10% and `tests/ai/fairness.test.ts` failed, correctly. Balance had been
bought by deleting the archetype's identity, which is the same mistake as
making every fighter identical and calling the result fair. The power mix is
restored; the cost is paid in volume and distance instead. **An archetype's
punch-weight vector is identity, not a balance knob** — `npm run balance:tune`
is explicitly forbidden from redesigning one for the same reason.

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
