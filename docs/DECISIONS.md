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
there is no binary media to trace. Trade-off: the art is geometric rather than
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
