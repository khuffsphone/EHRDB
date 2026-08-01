# Combat Specification

Authoritative behaviour of `src/sim/`. All timing is in **ticks** at 60 Hz.
Distances are in **ring units**: the ring interior is 320 × 176 and a fighter's
body radius is 11.

## The layered damage model

Four independent variables, not one health bar. This is the design's spine.

| Variable | Meaning | Recovers |
|---|---|---|
| **Composure** | Immediate energy. Reaching 0 puts the fighter down. | Continuously when not being hit, faster at distance, capped by resilience |
| **Resilience** | The ceiling composure can return to — long-term punch absorption. | Only partially between rounds; floors at 32% of maximum |
| **Head / body trauma** | Localised, accumulating wear, 0–1. | Slightly between rounds. At 0.85+ the referee starts watching |
| **Exertion** | Breath. Slows the hands, sags the guard, weakens punches. | Slowly in-round, substantially in the corner |

Two more support them: **guard integrity** (degrades when absorbing punches,
breaks into a stagger) and **balance** (drives staggers and knockdowns).

**Why four.** Volume punching grinds resilience down so that later rounds start
from a lower ceiling — that is the boxer's win condition. Power punching
attacks composure and balance directly — that is the slugger's. Body work
attacks exertion and body trauma, setting up the head shot that finishes.
Collapsing these into one bar would delete the entire strategic layer.

## Punches

Six punches, each with a head and a body variant — twelve resolvable moves.
Body variants trade knockdown pressure for lasting damage: less composure
damage and stagger, more trauma and exertion, lower score value.

Head-level frame data (`src/data/punches.ts`):

| Punch | Startup | Active | Recovery | Whiff | Reach | Min | Composure | Stagger | Role |
|---|---|---|---|---|---|---|---|---|---|
| Jab | 5 | 3 | 9 | 4 | 54 | 26 | 4.05 | 0.07 | Owns the outside; scores; cannot finish |
| Cross | 9 | 3 | 16 | 9 | 51 | 24 | 9.07 | 0.19 | Long and dangerous; a real commitment |
| Lead hook | 8 | 3 | 14 | 8 | 40 | 16 | 8.99 | 0.22 | Fast for its damage, only inside the jab |
| Rear hook | 12 | 3 | 21 | 14 | 38 | 15 | 13.03 | 0.30 | Ends rounds; loses exchanges |
| Lead uppercut | 10 | 3 | 17 | 10 | 33 | 12 | 10.03 | 0.25 | Beats a high guard's underside |
| Rear uppercut | 14 | 3 | 24 | 16 | 31 | 11 | 15.05 | 0.34 | Shortest, slowest, hardest |

No punch strictly dominates another — asserted by
`tests/content/content.test.ts`. Every punch is faster, longer, or cheaper than
whatever hits harder than it.

## Resolution order

A punch is tested every tick of its active window against a **snapshot** of the
defender taken before any damage resolves, so both fighters' punches are judged
at the same instant and corner 0 gains no ordering advantage.

1. **Range gate.** Beyond reach, inside minimum range, misaligned in depth, or
   behind the attacker → no contact this tick.
2. **Evasion.** A slip inside its window → `slipped`.
3. **Guard.** A guard at the matching level with integrity remaining → `blocked`.
   A guard at the *wrong* level does not protect the exposed target.
4. **Counter.** The defender is inside the explicit vulnerability window of
   their own punch → `counter`, damage multiplied by that punch's counter bonus.
   Counters are a state check, never a coin flip.
5. **Accuracy.** A roll from attacker accuracy against defender footwork,
   defence, movement, exertion and balance → `miss` on failure. This is the
   largest bucket in real boxing and it is where the defensive ratings earn
   their keep.
6. **Leverage.** At the fringe of reach → `glancing` at half damage.
7. Otherwise → `clean`.

## Damage application

```
composure   -= composureDamage  × power × gas × chain × quality × variance ÷ chin
resilience  -= resilienceDamage × power × gas × chain × quality × variance ÷ resist
trauma[level] += traumaDamage   × power × chain × quality × variance ÷ resist
balance     -= staggerPower × chain × quality × (2 − chin) × (0.32 + 0.95 × worn)
```

- `gas` = 0.8 + 0.2 × (1 − exertion). An exhausted fighter still throws, but
  there is nothing on it.
- `chain` = 1 ÷ (1 + hitsWhileReeling × 0.55). **Combo scaling.** Without it a
  slugger chains hit-reactions into an unanswerable knockdown, and ten landed
  heavy punches outweigh a hundred clean jabs.
- `worn` = how depleted composure already is. **A fresh fighter absorbs a big
  shot; a worn one loses their legs to the same punch.** This is what makes
  volume set up power rather than compete with it.

## Knockdowns, the count, and rising

Composure ≤ 0 or balance ≤ 0.12 puts a fighter down. Rise progress accrues
**passively** at all times — so a player who cannot mash still gets up — and
faster on recovery inputs, which are rate-capped so mashing beyond a human
cadence gains nothing.

Rise difficulty is fixed at the moment of the knockdown from knockdowns
already suffered, worst trauma, exertion and lost resilience. A first
knockdown for a fresh fighter is near 1.0; a third for a badly hurt one exceeds
3.0, which is what turns a knockdown into a knockout.

Three knockdowns in a round ends it. The referee also stops a bout when
concern reaches 1.0, built from clean punishment to a region already at 0.85+
trauma and decaying while a fighter holds their own.

## Scoring

Ten-point-must, three judges. Round components: clean punching (weighted by
punch score value and quality), knockdowns, effective aggression, ring control
and defence. Judges weight the components differently and carry a small bounded
seeded preference.

**Clean punching dominates.** The positional components are tie-breakers and
accrue at roughly a fifth of the weight of landed punches. An earlier build had
them accruing per tick at a rate that outweighed every punch landed in the
round, which made an out-boxer who out-landed his man two-to-one lose anyway.

A knocked-down fighter cannot win a round. Each knockdown costs a further
point. A shutout round without a knockdown can still be a 10-8.

## Feel

- Input is sampled every simulation tick and legal intent is acknowledged
  immediately.
- Punches are edge-triggered. A punch requested during the last 14 ticks of
  commitment is buffered and fires on release; the buffer expires after 18
  ticks, which must exceed the window or an edge-of-window request would die
  before it could be honoured.
- Punches carry the fighter forward. Without it the whole game is decided by
  whoever walks backwards fastest.
- Hitstop, shake, flash and crowd response are **rendering only**. The
  simulation and the input sampler never pause, so no effect can change an
  outcome or swallow a button press.

## Balance evidence

From `npm run soak -- --mirror --bouts 200` (identical ratings, archetype the
only variable — the only honest way to measure strategy):

- Win rates: 40–60% across all five archetypes.
- Accuracy: ~35% of punches thrown land cleanly.
- Outcomes: ~32% KO, ~3% TKO, ~57% decision, ~8% draw.
- Mean bout length: 5.2 of a scheduled 6.3 rounds.
- Punch mixes, head/body splits, guard usage and preferred ranges all differ
  measurably by archetype (asserted in `tests/ai/fairness.test.ts`).
