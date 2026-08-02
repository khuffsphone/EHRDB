# CLAUDE.md — operating contract

**Project:** TEN COUNT — Championship Boxing. An original browser boxing game
with a deterministic simulation core.

## Immutable product boundary

**BUILD_PROFILE: SAFE_RELEASE.** No `RIGHTS_CLEARANCE.md` exists, so nothing
from any third party is cleared for use. This game ships as an original
spiritual successor.

Never add to this repository or to a build:

- Any real person's name, likeness, signature, voice or biography.
- Any third-party trademark, logo, brand, box art, manual or packaging.
- Any ROM, ROM-derived data, extracted sprite or audio, memory dump, emulator
  save or save state.
- Any copied visual composition, sprite, palette dump or audio sample.

`references/private-rom/`, `artifacts/private-repro/` and `references/drive/`
are git-ignored and must never be imported from `src/`.

Every binary media file needs a row in `docs/LEGAL_AND_ASSET_LEDGER.md`.
**The production bundle contains none** — all art is drawn by code and all audio
is synthesised at runtime. Keep it that way unless there is a very good reason
not to. The repository does track 85 PNGs — 84 QA screen captures under
`artifacts/qa/screens/` plus one ring-geometry diagnostic — each covered by a
ledger row and enforced by `release:audit`. An earlier version of this
paragraph said there were none anywhere, which was false.

`npm run release:audit` enforces all of the above. It must stay green.

## Architecture rules that may not be casually changed

- **`src/sim/` is the authority.** It receives normalised commands and produces
  state and events. It must not read the DOM, wall-clock time, Phaser objects,
  raw device input, or unseeded randomness. ESLint enforces this.
- **Determinism is the product.** Only `+ - * /` and `Math.sqrt` are
  bit-reproducible; `Math.sin`, `Math.cos`, `Math.pow` and `Math.hypot` are
  banned in `src/sim`, `src/ai` and `src/career`. Use `@sim/fixed`.
- **All randomness comes from `@sim/rng`**, seeded and serialisable.
- **All timing is in ticks** at 60 Hz. Milliseconds never appear in simulation
  rules.
- **The AI only ever sees `PublicBoutView`.** Widening that type is a fairness
  regression, not a feature.
- **Presentation is cosmetic.** Hit confirmation, damage, scoring, stamina,
  knockdowns and AI decisions belong to simulation state. Hitstop freezes
  rendering only.
- **Fighter state transitions are explicit.** Illegal transitions throw in
  development. Add to the table in `src/sim/fsm.ts`; do not bypass it.
- **Content is data**, in `src/data/` and `src/career/`, validated by
  `npm run assets:validate`.
- **Saves are versioned with ordered migrations.** Never drop a field; add a
  migration. Nested structures are validated at load (`src/save/validate.ts`),
  not cast — a type assertion checks nothing at runtime.
- **Every quantitative claim in a document is enforced by a test.** If a number
  appears in a specification and no gate asserts it, it will drift. See D-019.
- No monolithic scene, no god object. Small typed systems with tests.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Validate content, typecheck, production build to `dist/` |
| `npm run preview` | Serve `dist/` on :4173 |
| `npm run verify` | **Every required gate**, output to `artifacts/qa/verify/` |
| `npm test` | Full test suite |
| `npm run soak` | Seeded AI-vs-AI batch (`--mirror` for the control field) |
| `npm run career:sim` | Play complete careers headlessly |
| `npm run qa:smoke` | Browser end-to-end: menu → bout → result → save → reload |
| `npm run qa:screens` | Screenshot every screen at three viewports |
| `npm run release:audit` | Legal and provenance audit |
| `npm run balance:certify` | Assert the documented balance targets over 1200 control bouts |
| `npm run balance:tune` | Search the archetype profile space; prints a patch, never writes one |
| `npm run fixture:replay` | Regenerate the committed golden replay fixture |
| `RELEASE=1 npm run release:audit` | Release-grade audit: a dirty tree or a local build blocks |

## Acceptance gates

See `docs/ACCEPTANCE_TESTS.md`. `npm run verify` runs them all and fails on any.

## Balance work

Measure with `npm run soak -- --mirror`, never with the ranked roster: the
ranked field confounds strategy with ratings.

Targets: every archetype **40%–60%**, accuracy **30%–40%**, mean rounds 4.4–5.6
of 6.3 scheduled, stoppages **30%–45%**.

Those numbers are not prose. They are defined once in `tools/balance-targets.ts`,
asserted by `tests/ai/soak.test.ts`, gated by `npm run balance:certify`, and
`npm run assets:validate` fails if this paragraph stops matching the constants.
A claim no test enforces does not belong in a specification — the previous
version of this file claimed 40–60% while the gate asserted 20–80%, and nothing
failed for the whole project.

Certification runs **1200 mirror bouts**, not the 200 used for iteration. A win
rate over 80 bouts carries a standard error near 5.6%, so a ±10-point band
asserted at that sample measures the seed rather than the balance. Iterate at
200 against the widened band; certify at 1200 against the documented one.

`npm run balance:tune` searches the profile space by paired coordinate descent
and prints a patch. It never writes one — balance is a design decision.

## Handoff

A handoff is not a status sentence. Every one carries: the source ref, the
changed files, the artifact hash from `dist/build-manifest.json`, the full
`npm run verify` output, the known limitations, and the current
`docs/PLAYTEST_BRIEF.md` — the questions automation cannot answer. "All tests
pass" is not a handoff, and neither is "feels better".

## Documents

`docs/PRODUCT_CANON.md` (settled decisions) · `COMBAT_SPEC` · `AI_SPEC` ·
`CAREER_SPEC` · `CONTENT_SCHEMAS` · `UI_FLOWS` · `ACCESSIBILITY` ·
`DECISIONS` (every judgement call) · `SOURCE_MAP` (how each rule is grounded) ·
`ORIGINAL_GAME_FINDINGS` · `ACCEPTANCE_TESTS` · `TEST_REPORT` ·
`RELEASE_NOTES` · `LEGAL_AND_ASSET_LEDGER` · `PLAYTEST_BRIEF` ·
`PLAYBOOK_COMPLIANCE` · `RUN_STATE`.

Precedence when they disagree: legal restrictions → acceptance gates →
product canon → subsystem specs → research findings → inference.
