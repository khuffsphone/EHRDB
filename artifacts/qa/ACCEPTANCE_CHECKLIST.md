# Acceptance Checklist

Completed against `npm run verify` output in `artifacts/qa/verify/`.

## Automated gates

- [x] Clean-checkout install with a pinned lockfile, no hidden globals
- [x] One aggregate `npm run verify` runs every gate and fails on any
- [x] Typecheck passes with zero errors
- [x] Lint passes with zero warnings
- [x] Unit tests pass — 132/132 across 8 files
- [x] Production build succeeds
- [x] Identical seed + inputs produce identical per-tick state hashes
- [x] Identical seed + inputs produce an identical outcome
- [x] ≥100 seeded AI-vs-AI bouts complete — 400 run, 0 failures
- [x] No deadlocks, NaN, invalid transitions, runaway memory or impossible results
- [x] Every punch can hit
- [x] Every punch is blocked at the correct level
- [x] A wrong-level guard allows meaningful damage
- [x] Every punch can miss by range
- [x] Evasion beats a punch that would otherwise land
- [x] Punches consume stamina
- [x] Punches expose recovery and counterplay
- [x] Bouts end by KO
- [x] Bouts end by TKO
- [x] Bouts end by judges' decision
- [x] Scorecards reconcile with round scoring
- [x] AI never reads future inputs — enforced by type and asserted
- [x] Four archetypes behave statistically differently
- [x] A career can be created
- [x] A career can be saved and closed
- [x] A career can be loaded and advanced
- [x] A career can be won and lost
- [x] A career can be completed and retired
- [x] Save export/import round-trips
- [x] Corrupted saves fail safely and are preserved for export
- [x] Older saves migrate without data loss — v1 → v4 verified
- [x] Every screen works keyboard-only
- [x] Gamepad disconnect is recoverable
- [x] No required button is decorative
- [x] No TODO, FIXME, stub, mocked result or "coming soon" on a production path
- [x] Production build runs with zero uncaught exceptions
- [x] Production build runs with zero console errors through menu → bout → result → save → reload
- [x] All release assets have known provenance
- [x] No original-game or ROM-derived content in the shipping bundle

## Browser and human-visible gates

- [x] Tested at 1280×720
- [x] Tested at 1920×1080
- [x] Tested at a 1024×768-class viewport
- [x] Scaling and letterboxing verified at all three
- [x] Title, main menu, boxer creation, career hub, rankings, opponent select,
      pre-fight, in-fight HUD, pause, scorecards, results, training, settings,
      controls, credits, hall of careers, exhibition and training lab inspected
- [x] Animation and state correspond — every state has an authored pose,
      validated mechanically
- [x] Readability verified in default, colour-safe and reduced-motion modes
- [x] Audio has no missing cues; impact density is limited and the master bus
      is compressed
- [x] Screenshots and browser evidence recorded under `artifacts/qa/`
- [x] Generated evidence excluded from the production bundle

## Performance

- [x] Fixed 60 Hz simulation independent of display refresh
- [x] Compressed download under 15 MB — **395 kB**
- [x] No network request required after load
- [x] No persistent memory growth across a long batch
- [x] Input sampled every simulation tick; effects never delay it

## Not verified

- [ ] Physical gamepad hardware — none available in this environment. The
      binding layer, hot-plug detection, deadzone handling and disconnect-pause
      path are implemented and reachable, but no automated test presses a real
      controller button.
