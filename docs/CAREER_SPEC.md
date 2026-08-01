# Career Specification

Deterministic from `(seed, player decisions)`. Reproducibility is asserted in
`tests/career/career.test.ts`.

## Shape

| Rule | Value |
|---|---|
| Maximum bouts | 20 |
| Decline begins | bout 12 |
| Forced retirement | 4 consecutive losses |
| One-time rebuild | available before bout 12 |
| Challenge window | ranks 1–4 receive challenges from 1–4 below |
| Reach after a win | 3 ranks up |
| Reach after a loss | 1 rank up |
| Reach on debut | 2 ranks up |
| Training picks | 3 on a win, 2 on a draw or loss |
| Slate size | 5 |
| Soft cap / hard cap | 78 / 96 |
| Legacy target | $8,000,000 |

The player starts unranked at position 9 behind eight ranked fighters.

## Rank exchange

Beat someone above you and you take their place. Lose to someone below you and
they take yours. Lose to someone above you and nothing moves. That single rule
is the entire progression system — no experience points, no levels. The ladder
is always renumbered to a dense 1..n permutation including the player.

## Purses

A table, not a formula: `Math.pow` is not guaranteed bit-identical across
engines and every career number has to reproduce exactly.

| Opponent rank | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Purse | 420k | 260k | 170k | 110k | 70k | 44k | 26k | 14k | 8k |

Title bouts pay ×2.5. A loser takes 38%, a draw 62%.

Purses are a **legacy score, not a training currency** — training is awarded
for showing up, never bought. Career earnings and available funds are tracked
separately so spending can never invalidate the record.

## Distance

Rank 7–9 → 3 rounds. Rank 4–6 → 6 rounds. Rank 1–3 and every title bout → 10.

## Training

A post-fight draft from a slate of five, weighted and drawn without
replacement from a nineteen-item catalogue. Every item states its exact
resolved gains, its wear cost and the archetype it suits.

Diminishing returns above 78, and gains scale down by career stage (prospect
1.15× → declining 0.35×). Nothing reaches every ceiling; no single item is
mandatory across seeds.

## Ageing

From bout 12, every bout costs ratings at an accelerating rate scaled by
accumulated wear. Speed and stamina go first, footwork and recovery close
behind, power holds on longest — and composure *rises*, because a veteran reads
the fight better even as the legs go.

Wear accumulates from distance, defeats and stoppages, and from hard training.
The career hub shows a career clock with the decline threshold marked, so it is
never a surprise.

## Failure and recovery

Four consecutive losses forces retirement — but before bout 12, the **first**
time it happens the fighter instead rebuilds from the foot of the ladder and
the streak clears. After that the rule applies in full.

This exists because the brief requires failure to be recoverable within reason.
Without it, a bad start at bout 5 deleted the campaign outright — which the
career fast-forward showed happening in a third of runs.

## The world

Between the player's bouts, the rest of the ladder fights, exchanges ranks,
ages, accumulates wear and retires. Results are resolved statistically from
ratings rather than by running full combat simulations, so a career
fast-forward completes in seconds (decision D-011). The champion never vacates
while the player is still chasing them.

## Endings

Bout cap, loss streak, voluntary retirement, or stepping aside from a
challenge. Every ending produces a summary and a legacy grade weighted toward
what was actually achieved — the belt, the defences and the money — rather than
a clean record built on safe fights.

Grades: Club Fighter, Journeyman, Contender, Champion, Great, All-Time Great.

Retired careers are archived to the Hall of Careers with their difficulty
recorded, so an assisted career never silently overwrites a standard one.

## Measured health

From `npm run career:sim -- --careers 16`:

- Mean bouts fought: 18.3 of 20.
- Reached a title shot: 15/16. Won the title: 12/16 (an AI plays the player's
  corner optimally; a human will do worse).
- Endings: 12 at the bout cap, 4 by loss streak.
- Grades spread across six bands, not clustered.
- Zero dead ends, zero invalid records, zero broken ladders.
