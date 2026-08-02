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

## Balance targets

Settled numbers. They are enforced, not asserted about: the single definition
is `tools/balance-targets.ts`, and `npm run assets:validate` fails the build if
this table stops agreeing with it.

| Measure | Target | Enforced by |
|---|---|---|
| Win rate, every archetype, ratings held equal | 40%–60% | `npm run balance:certify` |
| Punches landed as a share of thrown | 30%–40% | `tests/ai/soak.test.ts` |
| Mean rounds completed, of 6.3 scheduled | 4.4–5.6 | `tests/ai/soak.test.ts` |
| Bouts ending inside the distance | 30%–45% | `tests/ai/soak.test.ts` |

Certification runs 1200 mirror bouts. That sample size is part of the claim,
not an implementation detail: each archetype contests 480 bouts, giving a
standard error near 2.3% and a 95% interval of about ±4.5%, which is narrow
enough for a ±10-point band to mean something. The 200-bout batch used during
iteration carries a standard error of 5.6% per archetype — wider than half the
band — so it is checked against a deliberately widened range instead, and is
not evidence that the target is met.

Measurement uses the mirror roster, where every fighter has identical ratings
and the archetype is the only variable (decision D-013). The ranked roster
confounds strategy with stats and cannot answer whether an archetype is
balanced.
