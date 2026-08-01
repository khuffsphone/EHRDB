# Product Canon

Settled decisions. Everything else defers to this document, and this document
defers only to `RIGHTS_CLEARANCE.md` (absent) and `docs/ACCEPTANCE_TESTS.md`.

## Identity

**TEN COUNT — Championship Boxing.** An original spiritual successor to the
16-bit career-boxing subgenre. Fictional fighters, original venues, original
branding, original art and audio. Nothing of another work's expression ships.

## Pillars

1. **Readable tactical boxing.** Spacing, target level, stamina, guard and
   counters decide fights. Mashing one button loses.
2. **Career ownership.** You build a boxer, pick your fights, take the risks,
   decline, and finish with a graded legacy.
3. **Fast to grasp, deep to master.** A new player finishes a three-rounder on
   Club difficulty. A good one exploits vulnerability windows and matchups.
4. **16-bit spirit, not imitation.** Compact pacing, bold silhouettes,
   immediate feedback — rendered entirely with original modern assets.
5. **Deterministic and testable.** Any bout or career replays exactly from its
   seed and inputs.

## Scope

| Area | Decision |
|---|---|
| Platform | Desktop browser, static build, offline after first load |
| Resolution | 640×360 internal, integer-friendly scaling with letterboxing |
| Simulation | Fixed 60 Hz, seeded, deterministic, renderer-independent |
| Modes | Career, Exhibition, Training Lab, Hall of Careers, Settings, Controls, Credits |
| Fighters | 8 fictional ranked fighters plus the player's created boxer |
| Archetypes | Out-boxer, pressure, counterpuncher, brawler, boxer-puncher (5; four required) |
| Venues | 3, distinct palettes and crowds, shared ring geometry |
| Career | 20 bouts maximum, decline from bout 12, title path, defences, retirement |
| Bout lengths | 3, 6 and 10 rounds |
| Outcomes | KO, TKO, and judges' decision (unanimous / majority / split / draw) |
| Input | Keyboard and gamepad, both fully remappable |
| Save | Versioned, migrated, autosaved, exportable, corruption-safe |
| Network | None. No backend, accounts, telemetry, ads or live services |
| Language | English, with every string externalised |

## Explicitly out of scope

Online multiplayer, 3D, cinematic story, monetisation, user accounts, level
editor, touch controls.

## The core loop

Create a boxer → pick an opponent from the ranked ladder → fight → rank
exchange, purse and record → training camp → the division fights on around you
→ challenge or choose again → decline → retirement and a legacy grade.
