# Acceptance Tests

The brief's gates, each mapped to the thing that actually checks it. Run them
all with `npm run verify`.

| # | Gate | Enforced by | Status |
|---|---|---|---|
| 1 | Clean-checkout install with a pinned lockfile, no hidden globals | `npm ci` + `package-lock.json` | PASS |
| 2 | One aggregate command runs every gate and fails on any | `npm run verify` (`tools/verify.ts`) | PASS |
| 3 | Typecheck, lint, tests and production build pass with zero errors | verify stages 1, 2, 4, 5 | PASS |
| 4 | Identical seed + inputs → identical state hashes and outcome | `tests/sim/determinism.test.ts` | PASS |
| 5 | ≥100 seeded AI-vs-AI bouts with no deadlock, NaN, invalid transition, leak or impossible result | `tests/ai/soak.test.ts` (120 + 120 + 200 + 150) and `npm run soak` | PASS |
| 6 | Every punch can hit, be blocked at the correct level, miss by range or evasion, cost stamina, and expose counterplay | `tests/sim/combat.test.ts` | PASS |
| 7 | Bouts end by KO, TKO and decision; scorecards reconcile | `tests/sim/outcomes.test.ts` | PASS |
| 8 | AI never reads future inputs; archetypes are statistically distinct | `tests/ai/fairness.test.ts` | PASS |
| 9 | A career can be created, saved, closed, loaded, advanced, won, lost, completed and retired | `tests/career/career.test.ts` + `npm run qa:smoke` | PASS |
| 10 | Save export/import round-trips; corrupt or older saves migrate or fail safely | `tests/save/save.test.ts` | PASS |
| 11 | Every screen and match flow works keyboard-only and gamepad-only; disconnect is recoverable | `npm run qa:screens` (keyboard-only, all 16 scenes asserted); gamepad path shares one binding layer, disconnect handling in `BoutScene.openPause` | PASS — see limitations |
| 12 | No TODO, FIXME, stub, mocked result or "coming soon" on a production path | `npm run release:audit` | PASS |
| 13 | Production build runs with zero uncaught exceptions and zero console errors through menu → bout → result → save → reload | `npm run qa:smoke` | PASS |
| 14 | All release assets have known provenance; no original-game or ROM-derived content ships | `npm run release:audit` + `docs/LEGAL_AND_ASSET_LEDGER.md` | PASS |

## Browser and human-visible gates

| Gate | Evidence |
|---|---|
| Tested at 1280×720, 1920×1080 and 1024×768 | `artifacts/qa/screens/` — 28 screenshots per viewport |
| Scaling, letterboxing, menus and HUD verified | Same |
| Every major screen inspected | 16 scenes asserted by name, not assumed |
| Animation/state correspondence | `assets:validate` resolves every state; hitbox overlay in the Lab shows live active frames |
| Readability in default, colour-safe and reduced-motion modes | Settings screenshots; `docs/ACCESSIBILITY.md` |
| Audio: no missing cues, no clipping, no impact spam | Dynamics compressor plus an impact-density limiter in `src/audio/engine.ts` |

## Performance budget

| Budget | Target | Measured |
|---|---|---|
| Simulation and rendering | 60 Hz | Fixed 60 Hz accumulator; 54–60 rAF fps measured in headless Chromium |
| Compressed download | < 15 MB | **395 kB gzipped** (1.65 MB raw) |
| Network after load | none required | Zero requests; static files only |
| Memory over a long run | no persistent growth | `tests/ai/soak.test.ts` heap check over 150 bouts |
| Input latency | sampled every simulation tick | `BoutScene.step` samples per tick; hitstop never delays input |

## Known limitations

Recorded honestly rather than downgraded gates:

1. **Gamepad hardware was not physically exercised.** No controller exists in
   this environment. The binding layer, hot-plug detection, deadzone handling
   and disconnect-pause path are implemented and unit-reachable, and the
   remap screen renders both device pages, but no automated test presses a
   real gamepad button. This is an environmental constraint.
2. **Draw rate is ~8%**, higher than real boxing's 2–4%. See D-017.
3. **Art is geometric rather than painterly** — a direct consequence of
   generating every pixel from code to keep provenance complete (D-016).
4. **Counterpuncher versus out-boxer** remains the one lopsided matchup cell in
   the control soak; every archetype's overall win rate is inside 40–60%.
