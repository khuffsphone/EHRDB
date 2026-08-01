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
