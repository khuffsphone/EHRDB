# EHRDB ROM Orchestration State

Updated: 2026-08-02

## Control-plane links

- Drive receipt: https://docs.google.com/document/d/1j1Gw4eEISHcs9e6f65cgeErbS75BmEWnhx_9lMm4s4I
- Clean ROM-01 draft PR: https://github.com/khuffsphone/EHRDB/pull/3
- Persistent ROM-program issue: https://github.com/khuffsphone/EHRDB/issues/4
- Source Materials folder: https://drive.google.com/drive/folders/1mc4FBa0Sq4EdgR_n-jJtXL62D5NQGkgd

## Operating rule

Proceed lane by lane without pausing for permission. Stop only on a hard technical, legal, or source-integrity gate; record the blocker and advance any independent lane. The public repository receives tools, non-expressive measurements, traceability, and tests. ROMs and extracted expression stay in ignored private storage.

## Model routing

Use the highest-reasoning model available for binary analysis, 68000 interpretation, table inference, emulator experiment design, and contradiction review. Use the fastest model available for deterministic transforms, manifests, formatting, schema conversion, and repetitive test generation. Every fast-lane output receives a reasoning-lane review before becoming canon.

| Lane | Scope | Primary model tier | Status | Exit gate |
|---|---|---|---|---|
| ROM-01 | Identity, header, checksum, vectors, coarse boundaries | Pro | **COMPLETE v01 — PR #3** | Reproducible tool + verified atlas + public metadata |
| ROM-01B | Bootstrap and interrupt/function map | Pro | **ACTIVE — isolated branch** | Bounded disassembly with labeled confidence |
| ROM-02 | Tiles, palettes, tilemaps, compression candidates | Pro | **ACTIVE — isolated branch; candidate tail found** | Confirmed asset regions and private atlases |
| ROM-03 | Metasprites and animation sequences/timing | Pro | QUEUED | Animation graph tied to ROM offsets/runtime traces |
| ROM-04 | Z80/YM2612/PSG audio mapping | Pro | QUEUED | Driver/bank map and cue inventory |
| ROM-05 | Fighters, punches, scoring, AI, career tables | Pro | QUEUED | Reproducible table extraction or explicit unresolved verdict |
| ROM-06 | X24C01 EEPROM layout | Pro | QUEUED | Controlled staged-save diffs and field map |
| PARITY-01 | ROM/manual/research ↔ repository matrix | Pro | **COMPLETE v00; iterative** | Each claim labeled preserved/redesigned/partial/unverified |
| DOC-01 | Canonical docs/JSON packaging | Instant | **ROM-01 COMPLETE; iterative** | Drive and GitHub readback match |
| QA-01 | Inspector tests, release-audit isolation, regression fixtures | Instant + Pro review | ACTIVE | Product verify plus tool self-tests green |

## Current verified facts

- ROM size: 524,288 bytes (`0x80000`).
- SHA-256: `b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880`.
- Header checksum `0x760F` recomputes exactly.
- Reset vector: `0x00000200`; main bootstrap handoff: `0x00001710`.
- Region: `U`; serial/version: `GM MK-1215 -00`.
- Serial save declaration: `RA`, flags `E840`, address `0x00200001`.
- Candidate uncompressed 4bpp tail bank: `0x07C800`–`0x07FFFF`, 448 tiles.

## Active next actions

1. Trace references into the `0x07C800` graphics bank and score aligned candidate CRAM palettes.
2. Map the reset bootstrap, level-6 interrupt path, and first main-state dispatcher.
3. Extend standard-library inspector tests with synthetic control-flow and palette fixtures; never commit the copyrighted ROM as a fixture.
4. Establish an emulator/core pin and staged EEPROM generation plan.
5. Keep the release build, Claude correctness lane, bootstrap lane, and graphics lane independently reviewable until explicit integration.
