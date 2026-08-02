# Decisions

Every point where evidence was incomplete, sources disagreed, or a product rule
had to be chosen. Recorded as required by the brief's contradiction order.

---

**D-001 — Build profile: SAFE_RELEASE.**
No `RIGHTS_CLEARANCE.md` and no `.local/BUILD_PROFILE` exist, so the safe
default applies and the game ships as an original spiritual successor. Not
inferred upward at any point.

**D-002 — The ROM was deliberately not retrieved.**
A 524,288-byte file matching the ROM is present in the connected Drive account.
Retrieving it would have been permitted only under `PRIVATE_RESEARCH_REPRO`,
which is not selected. The research report already supplied every mechanic
needed. Consequence: this project contains **no measured original frame data,
hitbox geometry, damage formula or scoring weight**. Every combat number is an
original design decision. Labelled throughout `docs/SOURCE_MAP.md`.

**D-003 — The dispatch's claim about the research report is wrong, and the
report was used.**
The dispatch states the completed analysis is "NOT PRESENT IN GOOGLE DRIVE AT
THIS REVISION" and forbids inventing it. It *is* present (Drive ID
`1dAeeq4Gr6DkE7E_hRnbNUXcGItDNqtEQdwdXUThY_0k`, 164,976 bytes), was found by
search and read in full. Under the contradiction order it sits at level 5 and
was used as the primary implementation source. Its real identity is recorded in
`references/SOURCE_REGISTRY.md` so the claim is checkable.

**D-004 — Career length 20 bouts, not 40.**
The research documents a 40-bout career with ageing from bout 25. The brief's
hard scope requires 12–20. The brief outranks the research (level 2 versus
level 5), so the career caps at 20 with decline from bout 12 — the same
three-fifths proportion.

**D-005 — Round length defaults to 90 seconds.**
Three-minute rounds are authentic but make a ten-rounder a 40-minute sitting.
Default "broadcast" pace is 90 s; "championship" pace at the full 180 s is
available in the ruleset. The shape of a fight is preserved; the sitting is not.

**D-006 — Simultaneous knockdowns resolve to one fighter down.**
When both fighters would be floored on the same tick, the one in worse
condition goes down and the other is left badly hurt but standing. Keeps the
bout state machine single-grounded without inventing a double-count sequence
the presentation does not support.

**D-007 — Hitstop freezes rendering only.**
The brief requires hitstop and forbids effects altering results or delaying
input. Pausing the simulation would satisfy the first and risk the second, so
hitstop holds the picture for a few frames while the simulation and the input
sampler keep running.

**D-008 — Six punches on four buttons.**
The full vocabulary is six punches at two levels. Rather than six face buttons,
the two hook buttons convert to uppercuts under a modifier, and crouch selects
the level. Everything is remappable.

**D-009 — Recovery from a knockdown always progresses on its own.**
The original's rapid-tap get-up substitutes finger speed for boxer condition.
Here rise progress accrues passively at all times and taps accelerate it, with
a cadence cap so mashing beyond a human rate gains nothing. All three
accessibility modes resolve against the same difficulty value.

**D-010 — Clean punching dominates the scorecards.**
An early build accrued aggression and ring control per tick at a rate that
outweighed every punch landed in a round; a boxer out-landing his opponent
two-to-one still lost. Positional components are now tie-breakers at roughly a
fifth of the weight.

**D-011 — The career world is simulated statistically, not by full bouts.**
Non-player bouts resolve from a seeded strength model rather than running the
combat simulation. A full career fast-forward has to complete in seconds. The
model is calibrated against the real simulation's outcome distribution and is
fully reproducible.

**D-012 — A one-time career rebuild.**
Four consecutive losses forces retirement, but before bout 12 the first
occurrence drops the fighter to the foot of the ladder instead. The brief
requires failure to be recoverable within reason; without this the fast-forward
showed a third of careers deleted before bout 6.

**D-013 — Balance is measured with identical fighters.**
Archetype win rates on the ranked roster confound strategy with ratings — the
out-boxer is one rank-6 fighter, the boxer-punchers are the two strongest.
`npm run soak -- --mirror` runs a control field where ratings are held constant
and only the archetype varies. All balance claims come from that mode.

**D-014 — Combo damage scaling.**
Each punch landed on a fighter still reeling from the last does progressively
less. Without it a slugger chains hit-reactions into an unanswerable knockdown
and twenty landed heavy punches beat a hundred clean jabs.

**D-015 — Balance loss scales with accumulated damage.**
A fresh fighter absorbs a big shot; a worn one loses their legs to the same
punch. Without this, three clean rear hooks floored anyone regardless of what
came before, and the layered damage model did nothing.

**D-016 — All assets are generated by code.**
Rather than authoring or sourcing sprites and audio, fighters are drawn from a
skeletal rig and every sound is synthesised with Web Audio. This makes
provenance trivially complete, keeps the bundle at 395 kB gzipped, and means
there is no binary media in the shipped build to trace. (The repository does
track QA screenshots as evidence; see the ledger.) Trade-off: the art is geometric rather than
painterly. Documented as a known limitation.

**D-017 — Draw rate is ~8%.**
Higher than real boxing (2–4%). With three judges scoring mostly 10-9 rounds, a
3-3 split over six rounds ties. Lowering the 10-8 threshold reduced it; driving
it lower would require distorting the scoring model. Accepted and documented.

**D-018 — The QA harness asserts navigation rather than assuming it.**
The first screenshot pass silently captured the wrong screens for twenty
minutes because menus wrap and keypress arithmetic drifted. The harness now
verifies the active scene after every transition and navigates by row label via
a read-only introspection hook. It caught four real defects immediately
afterwards.

**D-019 — Every quantitative claim in the documents is enforced by a test.**
The project claimed a 40–60% archetype band in three documents while the soak
gate asserted 20–80%, and the committed evidence showed 35–60%. Nothing failed,
because the gate cited as proof of the claim was never checking the claim. The
targets now live once, in `tools/balance-targets.ts`; the test and the
certification tool read them, and `npm run assets:validate` fails the build if
the prose stops matching. The general rule: if a number in a specification is
not asserted somewhere, it will drift, and the drift will not be noticed by the
person who wrote it.

**D-020 — The balance band is certified at 1200 mirror bouts, not 200.**
A win rate measured over 80 bouts — what an archetype contests in the 200-bout
iteration soak — has a standard error near 5.6%, so its 95% interval is about
±11%: wider than the entire 40–60% band. Asserting the band at that sample
measures the seed. Certification therefore runs 1200 bouts (480 per archetype,
±4.5%), and the iteration soak checks a widened band that its sample can
actually support. The sample size is part of the claim, not an implementation
detail.

**D-021 — The golden fixture is committed bytes, not a same-process rerun.**
The test named "golden hash" built the same bout twice and compared it to
itself. That detects non-determinism within one process and nothing else; it
would have passed unchanged through every balance change in this repository.
`tests/fixtures/replay.json` now pins checkpoint hashes, final hashes and whole
AI bout outcomes from a reviewed commit. Regenerating is deliberate
(`npm run fixture:replay`) and shows up as a diff.

**D-022 — The state hash covers the future, not the present.**
`hashState` omitted the RNG stream position, so two states that looked
identical and would diverge on the very next draw hashed the same. It also
omitted the input buffer's level and age, the idle/clinch/rope timers, and the
in-progress scorecard. All are included now, and
`tests/sim/replay.test.ts` perturbs every field of `FighterState` in turn to
prove the hash moves — so a field added later without a matching line fails
immediately rather than surfacing as an unreproducible replay months on.

**D-023 — Input edges are consumed once, level state applies to every tick.**
The bout scene sampled the device once per frame and fed that snapshot to every
tick of a fixed-step catch-up burst. A held direction genuinely applies to all
of them; a press does not — the repeats landed inside the input buffer window
and queued punches the player never asked for, specifically on frames that were
already stuttering. Edges are cleared after the first tick of a burst
(`levelOnly`). Filed by the external review under determinism; it was a
gameplay defect.

**D-024 — Saves are validated recursively, and a reset actually erases.**
`parseSave` checked the envelope and then cast the career, slots and legacy
board to their TypeScript types — an assertion that compiles to nothing. A
malformed save loaded cleanly and crashed several screens later. Nested
structures are now walked and checked (`src/save/validate.ts`), with the rule
that a missing value with an obvious default is filled and a value of the wrong
kind is rejected. Separately, `reset` cleared the backup slot and then called
`write`, which rolls the outgoing save into the backup — so it deleted the
backup and immediately refilled it with the career the player had asked to
destroy.

**D-025 — Release artifacts carry their own provenance.**
Every build embeds its commit, lockfile hash, build time, version and CI run id,
and writes them to `dist/build-manifest.json`; the title screen shows the short
form so a bug report and a reproduction are provably about the same bytes. The
release audit blocks on a missing manifest, an unknown commit or lockfile, and
on a manifest whose commit does not appear in the bundle. It warns on a build
made locally or from a dirty tree, because a release artifact should come from
CI.

**D-026 — A fixture stores its inputs, not a recipe for them.**
The first golden fixture recorded checkpoint hashes but regenerated the command
stream from `scriptedCommands()` at verification time. That couples the fixture
to the generator: editing the generator silently changes what is being tested
while the fixture still appears to pass, and the guard against it was a version
constant somebody has to remember to bump. The commands are now committed —
hex-packed, three characters per command, about 43 kB for 7200 ticks — and
verification replays those bytes. The generator is kept only for recording, and
a test reports when the two have parted company without treating that as a
failure of the contract.

**D-027 — Content digests separate a data edit from a model edit.**
A fixture pins an outcome produced by a simulation *and* by a set of data. When
a hash diverges, "the combat model changed" and "somebody adjusted a punch's
reach" produce the identical failure, and the first place anyone looks is the
wrong one. `contentHashes()` digests punches, fighters, mirror roster, AI
profiles, rulesets and venues, and the fixture carries them.

**D-028 — The release audit recomputes the artifact hash rather than reading it.**
A manifest that merely *claims* a digest proves nothing; the whole point of the
field is that a third party can check it, so the audit checks it — including
that the file list matches the bundle on disk. `RELEASE=1` additionally promotes
"built from a dirty tree" and "built locally" from warnings to blocking errors,
so a developer is never obstructed and a release can never quietly ship from
someone's laptop. CI runs the release-grade audit.

**D-029 — The saved career is validated against the roster it references.**
A save can outlive the content it points at. A ladder entry naming a fighter
this build no longer has would throw from `getFighter` on the opponent screen,
with nothing to indicate the cause was a stale save. Ladder references are now
rejected at load with the failing path; stale *offered opponents* and a stale
pending challenge are repaired instead, because those are regenerated every bout
and dropping one costs nothing, while a ladder entry carries a record and
substituting a fighter would fabricate career history.

**D-030 — The limits of automated evidence are written down, not implied.**
`docs/PLAYTEST_BRIEF.md` lists the questions this project cannot answer from
inside itself, including the one the automation is least able to speak to:
whether the career's decline phase lands as poignant or merely punishing. It
also states the known limitations before a tester finds them — chiefly that no
physical gamepad has ever been connected to this build.

**D-031 — "Dirty" means the source differs, not the evidence.**
The release-grade audit (`RELEASE=1`) failed on its own first CI run, and the
failure was correct behaviour from a wrong definition. `npm run verify` rewrites
`artifacts/qa/**`, which is tracked, so by the time the `build` stage runs the
working tree is dirty and every build — including the clean-checkout CI build
the flag exists to identify — recorded `dirty: true`. The flag was not merely
noisy; it was inverted for the only pipeline ordering that makes sense, which is
to run the full gate before shipping what it certified.

`dirty` now answers the question it was meant to: does the source that produced
this artifact differ from the recorded commit? `artifacts/` is excluded because
nothing under it is imported by `src/`, read by the build, or copied into
`dist/`, so it cannot change the output. Everything else stays in scope. The
manifest records `dirtyScope` alongside the flag, and the audit blocks on a
manifest that omits it — a dirty flag whose scope is unrecorded cannot be
interpreted, because nobody can tell whether "clean" means the source or merely
some of it.

**D-032 — A release artifact is stamped with a commit someone can check out.**
On a `pull_request` event `GITHUB_SHA` is the synthetic merge commit: it lives
only on `refs/pull/N/merge`, is unreachable from an ordinary clone, and is
eventually collected. The first green CI run stamped a release candidate with
one — `beed111a`, which `git cat-file` cannot resolve in this repository. The
manifest looked complete and the provenance was unusable, which is the same
failure shape as a gate that asserts a wider band than the claim it is cited to
support. The build now prefers `BUILD_COMMIT`, and the workflow sets it to the
pull request's head commit, falling back to `github.sha` for push events. The
uploaded artifact names use the same SHA, so the evidence bundle and the commit
agree.

**D-033 — The audit enumerates tracked media against declared paths.**
The audit header had always listed "binary media with no row in the asset
ledger" as one of its checks. That check did not exist: the only media scan ran
over `dist/`, and only as a warning, so the repository could accumulate tracked
images with no provenance entry while the audit reported success. A stated
guarantee stronger than the thing enforcing it — the same defect this project
has now corrected in four separate places.

It matters concretely because the research lane's palette scanner can render
historical colour values as PNG swatches. It writes them to the git-ignored
`artifacts/private-repro/`, which is the right design, but a git-ignore is a
convention and this is a gate; a palette dump is forbidden outright under
SAFE_RELEASE.

The first implementation was wrong in the direction that makes a gate useless.
It walked each file's ancestors and asked whether the ledger mentioned any of
them, so a row naming `artifacts/qa/screens/` — which contains the substring
`artifacts/qa/` — granted coverage to that whole directory and, by the same
argument, to every ancestor up to the repository root. It passed a planted file.
Coverage is now by declared prefix: the paths the ledger actually names in
backticks, and the file must sit under one. Caught by testing the gate against a
planted file rather than trusting that it worked.

On its first correct run it found a real violation: `artifacts/qa/ring-check.png`
was tracked with no covering row, and the ledger's claim that all 85 PNGs sat
under `artifacts/qa/screens/` was wrong — 84 do. Third time a claim about those
85 files has been inaccurate, and the first time anything checked.

**D-034 — Heavyweight Circuit was inspected first-hand, within the limits of a
compiled artifact.**
The independent review and this project's response both reasoned about
Heavyweight Circuit without anyone here having opened it; the response said so
explicitly. `docs/HWC_INSPECTION.md` records what the supplied v1.1.0 artifact
verifies about itself. Cowork's claimed build stamping is real — commit,
build time, lockfile digest and version are embedded, with a sane fallback and a
display formatter. One concrete defect: the embedded manifest declares version
`1.0.0` while the file is named `v1.1.0`, and the string `1.1.0` appears nowhere
in it, so the artifact cannot say which release it is. Same class as this
project's `f11d4d6`. Nothing about presentation quality, test count or source
depth is settled by inspecting a minified bundle, and the document says so.
