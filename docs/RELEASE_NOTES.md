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
| Binary media files | 0 |
| Network requests after load | 0 |
| Simulation | fixed 60 Hz, seeded, reproducible |
| Archetype win rates (ratings held equal) | 40–60% |
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
   control soak, though every archetype's overall win rate is inside 40–60%.
5. **English only**, though every string is externalised behind a key.
6. **The bundle is multi-file** — Phaser is code-split from game code so it can
   be cached separately. A single-file build is possible but would inline
   1.5 MB of engine on every load.

## Not included, by design

Online multiplayer, 3D, monetisation, accounts, telemetry, level editor, touch
controls.
