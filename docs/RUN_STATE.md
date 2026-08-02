# Run State

**Phase: complete.** Every required gate is green.

## Active configuration

| | |
|---|---|
| Build profile | `SAFE_RELEASE` |
| Latest known-good command | `npm run verify` — all 11 stages PASS |
| Production build | `dist/` (395 kB gzipped) |
| Branch | `claude/ehrdb-boxing-game-2i1zzq` |

## Completed

1. **Audit** — repository empty at start; toolchain verified; canonical Drive
   sources located and the research report read in full.
2. **Documents** — canon, ledger, source registry, source map, findings,
   combat/AI/career/schema/UI/accessibility specs, decisions, acceptance tests.
3. **Frozen interfaces** — `FighterCommand`, `BoutEvent`, `PublicBoutView`,
   `BoutState`, `CareerState`, `SaveFile`, the fighter state machine.
4. **Simulation** — deterministic 60 Hz core, layered damage, scoring,
   outcomes, with tests written alongside.
5. **First playable bout** — run in a browser, core feel defects repaired.
6. **AI** — five archetypes, four difficulties, soak harness, balance tuned
   against a control field with ratings held equal.
7. **Career** — ladder, training, economy, ageing, saves, endings, and a
   headless fast-forward tool.
8. **Screens** — all nineteen, controller flows, remapping, accessibility,
   settings, credits.
9. **Assets** — procedural fighter rig covering every required state; venues;
   synthesised audio. No placeholders and no binary media.
10. **Verification** — 132 tests, 400 soak bouts, 12 careers, browser smoke,
    release audit, clean build.
11. **Visual QA** — 84 screenshots at three viewports with navigation asserted;
    defects found and repaired.
12. **Career playthrough** — 12 careers completed headlessly; no progression
    blockers, dead ends or invalid saves.
13. **Packaging** — static build, release notes, controls guide, test report,
    evidence index.
14. **External review remediation (1.0.1)** — all six findings of the
    independent comparative review verified against the committed code and
    fixed: input edges consumed once per press, state hash completed including
    the RNG stream position, a real committed golden fixture, recursive save
    validation, a reset that actually erases, the documented balance band met
    and enforced at a sample size that can support it, CI, and build
    provenance. See `docs/RELEASE_NOTES.md` and D-019 through D-025.

## Failing gates

None.

## Unresolved blockers

None.

## Open items (non-blocking)

- No physical gamepad available in this environment to exercise by hand; the
  code path is implemented and reachable. Recorded as a known limitation.
- Draw rate ~8%, above real boxing. See D-017.
- Individual matchup cells in the control soak remain lopsided even with every
  archetype's overall rate in band. Partly real — styles do match up badly —
  and partly sampling: a single cell carries too few bouts to tell which. No
  gate asserts the matrix; it is descriptive only.
- The next phase is presentation and feel, not architecture: animation quality,
  impact feedback, camera behaviour, onboarding and career pacing, validated by
  humans playing it rather than by soak batches. Automated balance evidence
  establishes that the simulation is not broken. It establishes nothing about
  whether the game is enjoyable.

## If work resumes

Read `CLAUDE.md` first — it is the operating contract. Balance work must use
`npm run soak -- --mirror`, never the ranked roster, for the reason recorded in
D-013. Any change must leave `npm run verify` green.

Balance changes will break `tests/sim/replay.test.ts`, which is the point: the
fixture pins committed bytes. Regenerate with `npm run fixture:replay` when the
change was intended, and review the diff. Balance targets live in
`tools/balance-targets.ts` and cannot be widened without the documentation
changing to match — `npm run assets:validate` enforces that.
