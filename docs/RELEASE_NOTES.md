# Release Notes — TEN COUNT 1.0.0

An original browser boxing game with a deterministic simulation core.

## What is in it

**Combat.** Six punches at two levels, each with authored frame data, reach,
commitment and an explicit vulnerability window. A four-variable damage model —
composure, durability, localised head and body trauma, and stamina — so that
volume, power and body work are genuinely different routes to a win. Guards
protect the level they are held at and nothing else. Counters are a state
check, not a dice roll. Fights end by knockout, technical knockout, or the
judges' cards.

**Opponents.** Five archetypes — out-boxer, pressure fighter, counterpuncher,
brawler, boxer-puncher — that differ in goals rather than stat multipliers, and
measurably differ in punch mix, working range, guard usage and head/body split.
Four difficulties that adjust reaction time, planning and discipline and never
touch a fighter's ratings.

**Career.** Twenty bouts on an eight-fighter ranked ladder. Rank exchange on
every result. Post-fight training drafted from a slate with real numbers and
diminishing returns. A division that fights, ages and retires around you.
Challenges you can refuse at a cost. Decline from bout twelve. A graded
retirement and a Hall of Careers.

**Presentation.** Three venues with distinct palettes and crowds. A 2.5D ring
with genuine depth positioning. A HUD that shows condition, durability, stamina
and localised damage without covering the action. Everything drawn from code.

**Audio.** Every sound synthesised at runtime with Web Audio — bell, count,
glove impacts by target and weight, guard impacts, crowd beds and reactions,
knockdown, victory, defeat, menu feedback, and three venue music treatments.
Four independent volume buses.

**Accessibility.** Colour-safe HUD, reduced motion, text scaling, hold-or-toggle
guard, three knockdown-recovery methods resolving against the same difficulty,
and complete keyboard-only or gamepad-only operation.

**Training Lab.** The real simulation with frame data, hitboxes, an input
display and five partner behaviours.

## Verified

`npm run verify` — all ten stages green.

- 132 tests across 8 suites.
- 400 seeded AI-versus-AI bouts (200 ranked, 200 control) with no deadlock,
  NaN, invalid transition, leak or impossible result.
- 12 complete careers played through the real simulation with no dead ends.
- Browser end-to-end through menu → bout → result → save → reload with zero
  console errors.
- 84 screenshots across three viewports with the active scene asserted.
- Release audit clean: no ROM data, no third-party marks, no binary media.

## Numbers

| | |
|---|---|
| Bundle | 395 kB gzipped (1.66 MB raw) |
| Binary media files in the bundle | 0 |
| Network requests after load | 0 |
| Simulation | fixed 60 Hz, seeded, reproducible |
| Archetype win rates (ratings held equal) | 40–60% — see the 1.0.1 correction below; this was not true at 1.0.0 |
| Clean-landing accuracy | ~35% |

## Known limitations

1. **No physical gamepad was exercised.** No controller exists in the build
   environment. The binding layer, hot-plug detection, deadzone handling and
   disconnect-pause path are implemented and the remap screen renders both
   device pages, but no automated test presses a real button.
2. **Draw rate is ~8%**, above real boxing's 2–4%. Three judges scoring mostly
   10-9 rounds tie on a 3-3 split. Lowering it further would distort the
   scoring model.
3. **Art is geometric rather than painterly** — the direct trade for generating
   every pixel from code and keeping provenance complete.
4. **Counterpuncher versus out-boxer** is the one lopsided matchup cell in the
   control soak. The claim that every archetype's overall win rate was inside
   40–60% was false at 1.0.0 — the committed evidence showed 35% and 60% — and
   is corrected in 1.0.1.
5. **English only**, though every string is externalised behind a key.
6. **The bundle is multi-file** — Phaser is code-split from game code so it can
   be cached separately. A single-file build is possible but would inline
   1.5 MB of engine on every load.

## Not included, by design

Online multiplayer, 3D, monetisation, accounts, telemetry, level editor, touch
controls.

---

# 1.0.1 — external review remediation

An independent comparative review of this build found six defects. All six were
verified against the committed code and evidence before anything was changed;
all six were correct. This release fixes them and, more importantly, fixes the
pattern underneath four of them.

## The pattern

A verification framework was built, and then prose was written that was more
confident than the framework. The project claimed a 40–60% archetype balance
band in three documents while the soak gate asserted 20–80% — four times the
slack of the claim — so the documentation and the measurement drifted apart for
the entire project without a single test failing. The asset ledger, whose only
purpose is provenance accuracy, stated there were zero binary media files in a
repository tracking 85 of them. A test named "golden hash" compared a rebuild to
itself while its own comment noted that no literal was pinned.

None of these were hard to find. All of them were findable from inside the
repository, and none of them were found from inside the repository.

## Fixed

**Input edges are consumed once.** The bout scene sampled the device once per
frame and fed that snapshot to every tick of a fixed-step catch-up burst, so a
single press queued extra punches on frames that were already stuttering. The
review filed this under determinism; it was a gameplay defect. Level state
still applies to every tick, because holding a direction genuinely does mean
all of them.

**The state hash describes the future.** It omitted the RNG stream position, so
two states that looked identical and would diverge on the very next draw hashed
the same. Also missing: the input buffer's level and age, the idle, clinch and
rope timers, and the in-progress scorecard. A test now perturbs every field of
`FighterState` in turn and requires the hash to move.

**A real golden fixture.** `tests/fixtures/replay.json` pins checkpoint hashes,
final hashes and whole AI-bout outcomes from committed, reviewed bytes.
Regeneration is deliberate and shows up as a diff.

**Saves are validated recursively.** Nested career, slot and legacy data was
cast rather than checked, so a malformed save loaded cleanly and crashed
several screens later. It now fails at load with the path that broke, and the
original bytes are still quarantined for export.

**Reset actually erases.** `reset` cleared the backup slot and then called
`write`, which rolls the outgoing save into the backup — so it deleted the
backup and immediately refilled it with the career the player had asked to
destroy.

**Balance meets the documented band, and the band is enforced.** The targets
live once, in `tools/balance-targets.ts`. The test, the certification tool and
the documentation all read them, and the build fails if the prose stops
matching. Certification runs 1200 control bouts rather than 200, because a win
rate over 80 bouts carries a standard error near 5.6% — an interval wider than
the band being claimed.

**Continuous integration.** Every gate runs on push from a clean checkout with
the pinned lockfile.

**Build provenance.** Every build embeds and publishes its commit, lockfile
hash, build time and CI run. The release audit blocks on a missing manifest or
an unknown commit, and warns on anything not built by the pipeline.

## Balance changes

Retuning to meet the band changed how three archetypes fight:

- **Pressure** was targeting 27 units — one unit outside the clinch — so the
  archetype meant to throw the most punches threw the fewest. Now 29.
- **Brawler** was dominant at 59% and won 94% of its bouts by stoppage. The
  first fix traded rear-hand weight for the jab, which balanced it and was
  wrong: its power share fell from 31% to 10% and the archetype-distinctness
  test failed. The power mix is restored; the cost is paid in volume instead.
- **Boxer-puncher** was the weakest by a distance, standing in the pocket with
  neither the out-boxer's escape nor the brawler's power, and carrying the
  worst accuracy in the game because most of its weighted punches were
  short-reach ones thrown from too far out.

## Not fixed

The review's recommendation to replace procedural art with authored or licensed
assets is not adopted. What is on screen is not the ceiling of procedural
generation; it is an under-invested renderer — single-pose keyframes with
linear blending, no secondary motion, no anticipation or follow-through, flat
lighting, no impact deformation. Every one of those is a code change with zero
provenance cost. Raising the generator's ceiling comes before buying art.
