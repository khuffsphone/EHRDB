# Unified Playbook — Code Lane Compliance

Reconciliation against *EHRDB Unified Boxing Build — Master Response & Playbook*
(evidence cutoff 2 August 2026), §2 "Master response to Claude Code" and the
final acceptance checklist.

This exists so the claim "the Code lane's deliverables are done" is checkable
rather than asserted. Every row names the thing that enforces it. Where a row is
not done, it says so.

## Immediate deliverables (§2)

| # | Deliverable | State | Enforced by |
|---|---|---|---|
| 1 | Fix frame-edge reuse; regression tests at 1, 2, 3, 6, 12 and 60 catch-up ticks | **Done** | `tests/input/edges.test.ts` — all six rates, plus the converse showing reuse is observably wrong |
| 2 | Replace the mislabeled golden test with a committed replay fixture containing seed, normalised inputs, data hashes, checkpoint hashes and expected final outcome | **Done** | `tests/fixtures/replay.json` + `tests/sim/replay.test.ts` |
| 3 | Extend state identity to RNG state, buffered input fields, round scoring, clinch timers, rope and idle timers | **Done** | `BoutSim.hashState`; completeness proven by perturbing every `FighterState` field |
| 4 | Correct every overclaim in docs; make quantitative release claims test-backed | **Done** | `tools/balance-targets.ts` + the drift check in `npm run assets:validate` |
| 5 | Add CI; generate the release artifact only from CI, embedding commit, dirty state, lockfile hash, build time and artifact SHA-256 | **Done** | `.github/workflows/verify.yml`; `dist/build-manifest.json`; audit recomputes the hash; `RELEASE=1` blocks a dirty or local build |
| 6 | Prepare a playable candidate and a "questions automation cannot answer" sheet | **Done** | `docs/PLAYTEST_BRIEF.md`; CI assembles the release folder |

## Replay format (§9)

The playbook specifies nine fields. Seven are present as specified; two are
adapted, and the adaptation is stated rather than glossed.

| Field | State |
|---|---|
| `formatVersion` | Present |
| `buildManifest` | **Adapted** — the fixture records `recordedAt.commit` only. The full manifest describes an *artifact*; a fixture is source, and embedding a build identity in a committed source file would make every rebuild a spurious diff. The artifact's manifest is separate and complete. |
| `contentHashes` | Present — punches, fighters, mirror roster, AI profiles, rulesets, venues |
| `seedSet` | Present — simulation stream, and the AI's two forked streams for AI bouts |
| `tickRate` | Present |
| `commands` | Present — normalised, hex-packed, three characters per command |
| `checkpoints` | Present — every 600 ticks across 7200, spanning a round boundary |
| `events` (optional) | **Not present.** Optional in the spec. The event log is large and adds nothing the checkpoint hashes do not already pin. |
| `outcome` | Present — kind, winner, round, plus final hash, knockdowns and per-corner stats for AI bouts |

## Acceptance checklist — items in the Code lane's control

| Item | State |
|---|---|
| All required fixes from both review responses committed and independently verified | Done — verified by CI on a clean checkout, not only locally |
| CI produces the only release artifact and manifest | Done — `RELEASE=1` audit blocks anything else. `dirty` is computed over source, excluding the committed QA evidence that `npm run verify` rewrites as a side effect; the manifest records the scope and the audit blocks if it is missing (D-031). |
| No phantom edge inputs at catch-up rates from 1 to 60 ticks | Done |
| Committed replay fixtures reproduce across a clean checkout | Done in CI. **Not yet verified across browsers** — the fixture is exercised in Node; the browser smoke test does not replay it. |
| Save reset, migration, backup and corrupt-data quarantine verified | Done |
| No console errors, uncaught exceptions, invalid state transitions or release-audit blocks | Done |
| Documentation claims match machine-enforced assertions and current artifact data | Done |
| Every screen usable by keyboard alone | Done — asserted by scene name at three viewports |
| Every screen usable by gamepad alone | **Not verified.** No physical controller exists in this environment. |
| First fight reachable in under three minutes by a novice | **Not verified.** Requires a human. |
| Four of five novice testers complete a fight without coaching | **Not verified.** Requires a human. |
| Players can explain head/body guard, stamina and counter vulnerability | **Not verified.** Requires a human. |
| Combat-feel criticals from genre testers fixed or accepted | **Not verified.** Requires a human. |

The last five are the top gate, and no amount of engineering closes them. They
are listed here so that "every gate is green" is never mistaken for "the game
works" — the exact failure this whole remediation exists to correct.

## Explicitly not in this lane

Canonical-repository selection, the symmetric two-repository audit, and the
subsystem scorecard all require Cowork's source archive, which is not present.
EHRDB remains the *provisional* integration host on the playbook's own terms:
it is the only inspectable source available, not the winner of a comparison.
Nothing in this repository should be read as having decided that question.
