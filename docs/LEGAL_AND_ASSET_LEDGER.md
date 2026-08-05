# Legal and Asset Ledger

**BUILD_PROFILE: SAFE_RELEASE**

This is the authoritative provenance record for everything that ships. A row
here with unknown provenance is a release-blocking defect. `npm run
release:audit` enforces the rules in this document mechanically.

## Why this profile

`SAFE_RELEASE` is the default and is what is active. It was selected because:

- No `RIGHTS_CLEARANCE.md` exists in this repository, so no name, likeness,
  trademark or artwork from any third party is cleared for use.
- No `.local/BUILD_PROFILE` exists, so `PRIVATE_RESEARCH_REPRO` is not
  selected and no ROM extraction was performed.

Under this profile the game is an **original spiritual successor**. It takes
mechanical and structural inspiration from the historical boxing game studied
during research, and takes no expression from it.

## What ships

| Category | Source | Author | License | Acquired | Permitted use | Replacement status |
|---|---|---|---|---|---|---|
| All fighter sprites and animation | Generated at runtime by `src/art/boxer.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| Ring, venues, crowd, referee | Generated at runtime by `src/game/RingRenderer.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| HUD, menus, panels, focus indicators | Generated at runtime by `src/ui/kit.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| Colour palettes | `src/art/palettes.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| All sound effects | Synthesised by `src/audio/engine.ts` (Web Audio) | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| All music | Synthesised by `src/audio/engine.ts` (Web Audio) | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| Fighter names, nicknames, hometowns | `src/data/fighters.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final — all fictional |
| Venue names and descriptions | `src/data/venues.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final — all fictional |
| Judge names | `src/sim/scoring.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final — all fictional |
| Training item names | `src/career/training.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final — generic boxing-gym terms |
| All player-facing text | `src/ui/strings.ts` | This project | Project licence | 2026-08-01 | Unrestricted | Final |
| Typography | System monospace stack (`ui-monospace`, DejaVu Sans Mono, Menlo, Consolas) | Operating system | Not redistributed | n/a | Referenced by name only | Final — no font file is bundled |
| Phaser 3 | npm `phaser@3.90.0` | Phaser Studio | MIT | 2026-08-01 | Redistribution permitted | Final |
| QA screen captures (84 PNG, `artifacts/qa/screens/`) | Captured by `npm run qa:screens` from this project's own renderer, 28 screens x 3 viewports | This project | Project licence | 2026-08-02 | Unrestricted | Final — evidence only, never copied into `dist/` |
| Ring geometry diagnostic (`artifacts/qa/ring-check.png`) | Single capture from this project's own renderer during the ring-projection fix | This project | Project licence | 2026-08-02 | Unrestricted | Final — evidence only, never copied into `dist/` |

**There are zero binary media files in the production bundle.** Every pixel is
drawn by code at runtime and every sound is synthesised at runtime. This is the
reason the provenance table above is short and complete: nothing ships that
needs tracing.

The repository is a different matter, and an earlier version of this paragraph
claimed otherwise. It tracks **85 PNG files**: 84 screen captures under `artifacts/qa/screens/`
(28 screens at three viewports, output of `npm run qa:screens`) plus
`artifacts/qa/ring-check.png`, a single diagnostic from the ring-projection
work. All are committed as visual evidence.

All of them are produced by this project from this project's own rendering code,
and Vite never copies them into `dist/`. But they are binary media in the
repository, and a ledger whose entire purpose is provenance accuracy does not
get to round that down to zero.

The 84/1 split matters more than it looks. Two earlier versions of this
paragraph said all 85 sat under `artifacts/qa/screens/`. They did not — one is a
loose ring-geometry diagnostic — and nothing checked, because the audit's media
check only ever looked at `dist/`, and only as a warning. It now enumerates
every tracked media file against the paths this ledger actually declares and
blocks on any file no row covers. The stray diagnostic was found by that gate on
its first run.

Verified by `npm run release:audit`, which reports the binary-media count in
`dist/` (currently 0) and fails the build if that number rises without a
matching row in the table above.

## Build-time dependencies

Development dependencies (TypeScript, Vite, Vitest, ESLint, Playwright, tsx,
rimraf) are not redistributed and do not appear in the shipped bundle. Their
licences are recorded in `package-lock.json`.

## What is explicitly excluded

None of the following is present in this repository, in the build, or in any
generated asset:

- Any real person's name, likeness, signature, voice or biography.
- Any third-party trademark, logo, brand, box art, manual, or packaging.
- Any ROM, ROM image, ROM-derived data, extracted sprite, extracted audio,
  extracted text, memory dump, emulator save, or save state.
- Any copied visual composition, sprite, portrait, tile, palette dump or
  audio sample from another work.

The verified research ROM described in the source manifest was **never
retrieved, never downloaded, never opened and never measured**. Its SHA-256 is
recorded in `tools/release-audit.ts` purely so the audit can refuse to track
any file matching it.

### ROM-derived data, which is a different problem

A ROM is a file. **Derived data is not.** A measured colour set pasted into a
source array is a list of numbers — no extension, no size signature, no hash to
match — so every check above would have passed it, and the build would have
looked clean while carrying extracted content. Given that a parallel research
lane holds exactly that class of artefact, this was the cheapest critical risk on
the board, and this ledger claimed a protection it did not have.

`tools/contamination-rules.ts` now keys on the *shape* of the data: colour packed
as 9-bit hardware words, exception-vector addresses as 24-bit literals, bare runs
of 64 or more byte-ranged values, and the hardware vocabulary that travels with a
paste. Every rule has a control proving it fires, the set has a control proving
it stays silent across every shipping file, and the gate was run against a
planted palette before it was believed. See D-035.

### How a fact about the historical work may reach this build

There is exactly one permitted route, and it has never been used: the question is
written down before it is asked, what comes back is prose rather than a table, it
is recorded as measured-elsewhere naming the lane that measured it, and the
implementation is written from the fact rather than from the artefact.

Reading the original's **published manual**, via the research report, is a
separate and permitted route — that is what the VERIFIED_SOURCE label in
`docs/SOURCE_MAP.md` records. It is not measurement and does not use the channel
above.

Every number in this game is therefore one of three things: a design decision, a
fact from a published source, or a measurement of this simulation's own
behaviour. `docs/SOURCE_MAP.md` labels which, per rule. See D-036.

## Reference material

Research material staged during development lives under `references/drive/`,
which is git-ignored and never built, imported or shipped. See
`references/SOURCE_REGISTRY.md` for what was consulted and
`docs/SOURCE_MAP.md` for how each implementation claim is grounded.

Studying a prior work to understand its mechanics is not reproduction of it.
Game mechanics and systems are not themselves copyrightable expression; the
expression — art, audio, text, names, marks, layouts — is, and none of it is
used here.

## Standing rules

1. No binary media may be added without a row in the table above.
2. `references/private-rom/`, `artifacts/private-repro/` and
   `references/drive/` must remain git-ignored and must never be imported from
   `src/`.
3. `npm run build` always produces `SAFE_RELEASE`.
4. Any change to this file must keep `npm run release:audit` green.
