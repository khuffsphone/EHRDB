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
Currently there are none: all art is drawn by code and all audio is synthesised
at runtime. Keep it that way unless there is a very good reason not to.

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
  migration.
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

## Acceptance gates

See `docs/ACCEPTANCE_TESTS.md`. `npm run verify` runs them all and fails on any.

## Balance work

Measure with `npm run soak -- --mirror`, never with the ranked roster: the
ranked field confounds strategy with ratings. Targets: every archetype 40–60%,
accuracy 30–40%, mean rounds ~5 of 6.3 scheduled, stoppages 30–45%.

## Documents

`docs/PRODUCT_CANON.md` (settled decisions) · `COMBAT_SPEC` · `AI_SPEC` ·
`CAREER_SPEC` · `CONTENT_SCHEMAS` · `UI_FLOWS` · `ACCESSIBILITY` ·
`DECISIONS` (every judgement call) · `SOURCE_MAP` (how each rule is grounded) ·
`ORIGINAL_GAME_FINDINGS` · `ACCEPTANCE_TESTS` · `TEST_REPORT` ·
`RELEASE_NOTES` · `LEGAL_AND_ASSET_LEDGER` · `RUN_STATE`.

Precedence when they disagree: legal restrictions → acceptance gates →
product canon → subsystem specs → research findings → inference.
