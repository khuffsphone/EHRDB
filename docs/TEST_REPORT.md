# Test Report

Produced by `npm run verify` on Node v22.22.2. Exact stage output is
preserved verbatim in `artifacts/qa/verify/`.

## Result

**Every required gate passed.**

| Stage | Result | Time |
|---|---|---|
| typecheck — TypeScript strict, zero errors | PASS | 5.4s |
| lint — ESLint, zero warnings | PASS | 5.3s |
| content — content, generated assets, and documented-claim drift | PASS | 1.1s |
| tests — 11 files, 189 tests | PASS | 100.0s |
| build — production bundle + build manifest | PASS | 13.2s |
| release-audit — legal, provenance and build identity | PASS | 1.1s |
| soak — 200 seeded AI-vs-AI bouts | PASS | 18.6s |
| soak-mirror — 200 control bouts | PASS | 16.5s |
| balance-certify — documented targets over 1200 control bouts | PASS | 92.8s |
| career-sim — 12 complete careers | PASS | 23.2s |
| smoke — browser end-to-end | PASS | 151.0s |

## Unit and integration tests

**189 passed, 0 failed, across 11 files.**

| Suite | Covers |
|---|---|
| `tests/sim/determinism.test.ts` | Seeded RNG sequence, state round-trip, per-tick hash equality, replay reproduction, corner-order neutrality |
| `tests/sim/combat.test.ts` | All 12 moves land, block at level, leak through a wrong-level guard, miss by range, smother inside minimum range, slip evasion, stamina cost, exhaustion, counters, buffering, no backwards punches, ring bounds, body collision, FSM legality |
| `tests/sim/outcomes.test.ts` | KO / TKO / decision all reachable, no early decisions, scorecard reconciliation, knocked-down fighters cannot win a round, count-outs, two idle fighters still resolve |
| `tests/ai/fairness.test.ts` | Public view leaks nothing private, the jab is unreactable at every difficulty, decisions are reproducible, only player-legal commands are emitted, five archetypes measurably differ, difficulty never touches ratings |
| `tests/ai/soak.test.ts` | 120 ranked + 120 control + 200 balance + 150 memory bouts |
| `tests/career/career.test.ts` | Creation validation, training curves, rank exchange both directions, purses, challenges, a complete career to a conclusion, ageing, grading, seed reproducibility |
| `tests/save/save.test.ts` | v1→v4 migration without data loss, corrupt-save quarantine, backup recovery, export/import round-trip, hostile storage |
| `tests/content/content.test.ts` | Roster, venue, ruleset, punch-table, AI-profile, binding and string integrity; no punch strictly dominates another; no reference to the historical work in any string |
| `tests/sim/replay.test.ts` | Committed golden fixture: twelve checkpoint hashes over 7200 ticks replayed from the committed command stream, two whole AI bouts, and content digests that separate a data edit from a model edit; hash completeness — the RNG stream position, the simulation-owned timers, the in-progress scorecard, and every field of `FighterState` perturbed in turn; exhaustive command-codec round-trip |
| `tests/input/edges.test.ts` | An input edge reaches the simulation exactly once at 1, 2, 3, 6, 12 and 60 ticks of catch-up; level state still applies to all of them; and the converse — reuse is observably wrong from three repeats on |
| `tests/save/validate.test.ts` | Recursive save validation: malformed careers, ladders, ratings, RNG state, scorecards and legacy rows are rejected with the failing path; roster references checked; stale offers repaired; absent optional collections defaulted; a valid career survives untouched; exports carry build identity |

## Simulation balance — ranked roster (200 bouts)

```

AI SOAK — 200 bouts at difficulty "contender" (14.8s)

  outcomes      KO 57  TKO 12  decision 128  draw 3
  mean rounds   4.94
  mean length   8.0 min of simulated time
```

## Simulation balance — control field (200 bouts, ratings held equal)

Identical fighters, archetype the only variable. Retained as the historical
record of the state this release corrects — the numbers below are the *old*
balance. Current balance is in the certification section at the end.

```

AI SOAK — 200 bouts at difficulty "contender" [MIRROR: identical ratings, archetype only] (15.4s)

  outcomes      KO 64  TKO 6  decision 115  draw 15
  mean rounds   5.16
  mean length   8.4 min of simulated time
  mean accuracy 35.4%

  archetype           win%   KO%   thrown  land%  head/body   KD+  KD-
  boxer_puncher      42.5%   8.8%     357  31.8%     89/11    1   20
  brawler            60.0%  93.8%     288  32.8%      99/1   49    9
  counterpuncher     48.8%  10.3%     274  39.5%      94/6    1   10
  out_boxer          45.0%   2.8%     349  33.5%      97/3    0   13
  pressure           35.0%  60.7%     227  34.0%     56/44   20   19

  archetype matchup matrix (row wins vs column, as row corner)
                   boxer_pu   brawler  counterp  out_boxe  pressure
  boxer_puncher           -   30%(10)   50%(10)   40%(10)   50%(10)
```

> **Correction.** An earlier version of this section printed the table above
> and then asserted "every archetype sits between 40% and 60%." The table it
> was printed under shows pressure at 35.0% and brawler at 60.0%. The claim was
> false against the evidence directly above it, and it was repeated in the
> delivery summary.
>
> Two things were wrong and both are fixed. The balance genuinely missed the
> band, and has been retuned (see D-019 through D-021 and the certification
> section below). And a 200-bout run was never capable of supporting the claim
> in the first place: each archetype contests 80 bouts, a standard error near
> 5.6%, so the 95% interval is about ±11% — wider than the band being asserted.
> This section is now descriptive only. The band is certified at 1200 bouts by
> `npm run balance:certify`, which is a required stage of `npm run verify`.

Accuracy, bout length and outcome mix are in a plausible range for the sport.

## Career health (12 complete careers, real bouts)

```

CAREER SIMULATION — 12 careers at "contender" (21.0s)

  mean bouts fought   18.8 of 20
  mean record         12.3W
  mean peak rank      1.3
  mean earnings       $6071k   (best $9.93M, legacy target $8.0M)
  reached a title shot 11/12
  won the title        11/12

  endings: boutLimit=8  lossStreak=4
  grades:  allTime=2  contender=2  champion=2  great=5  clubFighter=1
```

No dead ends, no invalid records, no broken ladders. Grades spread across five
bands. Note that an AI plays the player's corner optimally here — a human will
win the title far less often.

## Determinism evidence

`tests/sim/determinism.test.ts` records an AI command stream, replays it twice
from the same seed, and compares the state hash **on every tick** — not just the
final outcome. Representative final hashes for fixed seeds are written to
`artifacts/qa/soak.json` (field `hashes`), formatted `seed:fighterA:fighterB:hash`.

A different seed with the same input stream produces a different history,
confirming the hash is actually sensitive to the simulation's random stream.

## Browser end-to-end

`npm run qa:smoke`, production build, real keyboard events, headless Chromium:

```
  ok    boots to the title screen
  ok    reaches the main menu
  ok    opens boxer creation
  ok    creates a career
  ok    reaches opponent selection
  ok    reaches the tale of the tape
  ok    enters the ring
  ok    the bout resolves to a result — scene Result
  ok    advances to training camp
  ok    persists the career to storage — 4235 bytes
  ok    offers to continue the saved career after reload — focus "Continue Career"
  ok    reloads straight back into the career — scene Training

smoke test passed: 12 steps, zero console errors
```

**Zero console errors and zero uncaught exceptions** through the full
menu → creation → bout → result → save → reload → continue path.

## Visual QA

`npm run qa:screens` — 84 screenshots across three viewports
(1280×720, 1920×1080, 1024×768), with the active scene **asserted** after every
transition. 16 scenes verified by name:

Bout, CareerHub, Controls, Creation, Credits, Exhibition, Lab, Legacy,
MainMenu, OpponentSelect, PreFight, Rankings, Result, Settings, Title, Training.

Evidence: `artifacts/qa/screens/`, index in `artifacts/qa/screens-report.json`.

## Build

| Metric | Value |
|---|---|
| Total bundle | 1.66 MB raw |
| Gzipped | **395 kB** (budget: 15 MB) |
| Game code | 173.7 kB raw / 55.1 kB gzipped |
| Phaser | 1,481.8 kB raw / 339.8 kB gzipped |
| Binary media files in the bundle | **0** |
| Network requests after load | **0** |
| Build manifest | `dist/build-manifest.json` — commit, lockfile hash, build time, CI run |

## Defects found and fixed during this run

Recorded because they are the substance of the QA work:

1. An AI input latch locked every high-volume archetype out of punching after
   its first punch.
2. Fighters stacked laterally and drifted apart in depth, so every punch failed
   the depth check — the AI had no notion of alignment.
3. Movement was fast enough relative to reach that walking backwards beat all
   offence.
4. Exertion recovered a full bar in twelve seconds, making stamina a
   non-mechanic and the slugger unfadeable.
5. Resilience collapsed to its floor inside round one, capping composure so low
   that every bout was a one-punch lottery.
6. Positional scoring components outweighed clean punching on the cards.
7. Perception latency was applied to positions as well as reactions, so the AI
   punched at where its opponent had stood a fifth of a second earlier.
8. A body/head feedback loop drove every bout to 98% body work.
9. `BUFFER_MAX_AGE` was shorter than `BUFFER_WINDOW`, so a punch buffered at
   the edge of the window expired before it could fire.
10. The confirm that closed the name field was immediately re-consumed by the
    menu, reopening it.
11. The creation list overflowed its panel and the hint text landed on a row.
12. Right-hand HUD labels sat on top of their own bars.
13. The ring was drawn small enough that fighters were ~40 px tall.
14. The far ropes floated above the corner posts they were tied to.
15. The reactive guard had a flat base that swamped `guardDiscipline`, so a
    swarmer guarded as much as a counterpuncher.

---

## Balance certification (1200 control bouts)

The evidence for the documented 40%–60% archetype band. Run by
`npm run balance:certify`, a required stage of `npm run verify`.

```
  outcomes      KO 499  TKO 16  decision 632  draw 53
  mean rounds   4.8
  mean length   7.8 min of simulated time
  mean accuracy 36.1%

  archetype           win%   KO%   thrown  land%  head/body   KD+  KD-
  boxer_puncher      41.9%  14.9%     385  29.7%     90/10   27  166
  brawler            56.7%  97.1%     185  33.7%      98/2  278   53
  counterpuncher     43.5%  19.1%     266  39.9%      95/5   40  104
  out_boxer          46.9%   4.4%     366  32.9%      98/2    1   67
  pressure           50.0%  71.3%     235  34.8%     68/32  190  146

  CERTIFICATION against docs/PRODUCT_CANON.md, 1200 control bouts
  every documented balance target met.
```

Every archetype is inside the band, and each keeps its identity: the brawler
throws the fewest punches (185 a bout) and wins almost entirely by stoppage;
the out-boxer throws the most from the longest range and has scored one
knockdown in 480 bouts; the counterpuncher is the most accurate; the pressure
fighter carries by far the highest body share.

At this sample each archetype contests 480 bouts — a standard error near 2.3%,
so a 95% interval of about ±4.5%. That is narrow enough for a ±10-point band to
mean something. The 200-bout iteration soak gives ±11% per archetype and cannot
support the claim, which is why it is no longer cited as though it could.

The result was confirmed on three seeds, two of which the tuning never saw:

| Seed | Result |
|---|---|
| 63000 (the verify gate's seed) | every documented target met |
| 88000 (held out) | every documented target met |
| 11111 (held out) | every documented target met |

Held-out confirmation matters here specifically because the gate runs a fixed
seed. Tuning until that one seed passes is fitting the gate, not fixing the
balance.

### What the gate caught

It is worth recording that the certification stage failed three times during
this work before it passed:

- boxer_puncher 39.4% — after restoring the brawler's power mix
- boxer_puncher 39.8% — after moving the boxer-puncher out of the pocket
- boxer_puncher 38.3% — after re-weighting its punches toward its own range

Each of those configurations passed the 200-bout iteration soak. A gate that
only ran at 200 bouts would have reported success three times over.

## Regression fixtures

`tests/fixtures/replay.json` pins hashes from a reviewed commit: twelve
checkpoint hashes across 7200 scripted ticks spanning a round boundary, plus
whole-bout outcomes for two AI bouts. The balance retune in this release
changed those AI hashes, which is exactly what a golden fixture is for — the
change appears as a reviewable diff rather than passing silently.

The scripted stream's hash did not change, correctly: it drives both corners
from a fixed input script and never consults the AI.
