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

**There are zero binary media files in this repository and zero in the
production bundle.** Every pixel is drawn by code at runtime and every sound is
synthesised at runtime. This is the reason the provenance table above is short
and complete: there is nothing to trace.

Verified by `npm run release:audit`, which reports the binary-media count in
`dist/` (currently 0).

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
