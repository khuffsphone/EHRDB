# ROM-02A — Palette Banks and CRAM Staging v01

> Static inspection of the verified World cartridge. Private swatches were used to validate color coherence; the public repository receives only offsets, metrics, hashes, and control-flow evidence. No original color table is included.

## Evidence standard

- **VERIFIED_ROM** — exact offsets, lengths, pointer operands, CRAM validity, and hashes.
- **VERIFIED_CONTROL_FLOW** — bounded routines establish 32-byte or 128-byte copies into the shared RAM staging region.
- **SUPPORTED_SEMANTIC** — the data shape, 3-bit channel encoding, coherent private swatches, and 128-byte shadow buffers support a palette/CRAM interpretation.
- **UNRESOLVED** — no screen, fighter, venue, or animation is named until runtime traces close the relationship.

## CRAM rule and buffer architecture

A Genesis CRAM color uses bits 1–3, 5–7, and 9–11; unused bits are zero, so the static validity rule is `(word & 0xF111) == 0`. A 16-color palette occupies 32 bytes; the complete four-palette, 64-color CRAM image occupies 128 bytes.

The audited code contains two copy primitives:

- `0x000BE0`: 32 longwords = **128 bytes**; SHA-256 `ec4a1c408093eaf692aa6542dcf88ca156b91e1b51071cc76f5a15d4c26531f4`.
- `0x004B58`: 8 longwords = **32 bytes**; SHA-256 `82eb2e33ffe02a516aaf6044755e2dbba7734e109653ec8e5a44d255773b7c81`.

The common destination is RAM `0xFFF3A6`. Nearby routines copy or transform 32 longwords between `0xFFF3A6`, `0xFFF426`, and `0xFFF4A6`, which supports a 64-color current/target/interpolation staging system. The final transfer into VDP CRAM remains a follow-on trace, so “palette staging” is supported rather than overclaimed as a fully closed upload path.

## Code-referenced palette sources

| Source | Code refs | Copy width | CRAM-valid copied words | Interpretation | Block SHA-256 |
|---|---:|---:|---:|---|---|
| `0x009684` | 2 | 128 B | 64/64 | full 64-color set | `ae089c12c2844ee61a871578fb287034b105bcdf9c97d21971f6bfb8d5cc82e7` |
| `0x009764` | 1 | 128 B | 64/64 | full 64-color set | `892368530d05f63be8dc2d537c6d10aaad3f31b01f94c0a0cef84f6ef9a86aa1` |
| `0x00C414` | 1 | 128 B | 64/64 | full 64-color set | `a76de08dbf5646faf4ac4f421a660408e98fbe4c685c7343cf3d008d9d8e4bba` |
| `0x00C494` | 1 | 128 B | 64/64 | full 64-color set | `41763fa4a5b8d645b0f543b8dfa4713761bc6d3d726b6a21914ecb53c56d5f7d` |
| `0x00C514` | 1 | 128 B | 64/64 | full 64-color set | `cc0c2e4c7b2454323fb264b62d4b6edf32e330f776c96f0db6a8db1f08da77f0` |
| `0x00C594` | 1 | 128 B | 64/64 | full 64-color set | `f4e465cb656c255d52be6e52dbadf5bbfc3be84a04502a6eba9b8421aab2e92f` |
| `0x00C614` | 2 | 128 B | 64/64 | full 64-color set | `1fe82f267669f703bb0adb2bc40134c2c08269254664a1ef3e310e69591140e0` |
| `0x02C592` | 3 | 32 B | 16/16 | single 16-color palette | `4bbb30160cd4eb529399479ad94eac63fed47bc4985f9694070e2e63ed3359ef` |
| `0x02C5D2` | 1 | 128 B | 49/64 | mixed/anomalous 128-byte source | `5b6cbf80c2bb00ef5dfc97d7d53609171a1785ce0bd4165a7a001a9730eefe4e` |
| `0x02D6EE` | 1 | 32 B | 16/16 | single 16-color palette | `21d68dcf48c5814ec6a8bdb856e54af0c8182dc28cd0811420e45162dacb72d0` |
| `0x02D72E` | 1 | 128 B | 64/64 | full 64-color set | `c3abb1d5a70458db5f41b49b5eea8d939ce94c07a4d0cc9e295b2ccd77397db0` |

### Disposition

- **Eight** sources are copied as complete 128-byte blocks and all 64 words are CRAM-valid: `0x009684`, `0x009764`, `0x00C414`, `0x00C494`, `0x00C514`, `0x00C594`, `0x00C614`, and `0x02D72E`.
- **Two** sources are copied as exact 32-byte, 16-color palettes: `0x02C592` and `0x02D6EE`.
- `0x02C5D2` is copied as 128 bytes, but only 49 of 64 words pass strict CRAM validity. Its first 48 entries form three coherent 16-color groups; the last 16 words include non-CRAM bits. It may be a mixed structure, deliberately dirty source, or palette-adjacent payload. It is not labeled a complete CRAM set.

## Candidate banks

| Bank span | Referenced targets | Code refs | Finding |
|---|---|---:|---|
| `0x009684–0x0097E4` | `0x009684`, `0x009764` | 3 | Two separately referenced 128-byte full-CRAM sets inside a longer CRAM-valid run. |
| `0x00C414–0x00C694` | `0x00C414`, `0x00C494`, `0x00C514`, `0x00C594`, `0x00C614` | 6 | Five consecutive 128-byte full-CRAM variants, each selected by shared state/fade handlers. |
| `0x02C592–0x02C612` | `0x02C592`, `0x02C5D2` | 4 | One 16-color source and one mixed 128-byte source. |
| `0x02D6EE–0x02D7AE` | `0x02D6EE`, `0x02D72E` | 2 | One 16-color source plus one full 64-color set. |

## High-value control-flow anchors

- `0x0026B8` loads `0x02C592`, points A1 at `0xFFF3A6`, and begins an explicit 8-longword copy.
- `0x00C048–0x00C07F` selects the `0x00C494`, `0x00C514`, `0x00C594`, and `0x00C614` variants and funnels them through the full 128-byte staging path.
- `0x00A5B0` loads `0x00C414` into the same 128-byte path.
- `0x00866E` and `0x008A6A` independently load `0x009684`; `0x00823C` loads `0x009764`.
- `0x00A28E` loads `0x02D72E` and jumps into the 128-byte copy primitive.
- `0x004B9E/0x004BAA` select `0x02C592` and `0x02D6EE` through the 32-byte primitive.

## Comparison with TEN COUNT

TEN COUNT synthesizes its release palette and procedural art at runtime. The ROM evidence does not justify importing any original color table into `SAFE_RELEASE`; it instead provides measurable reference constraints: four 16-color lines, full-palette transitions, separate current/target/interpolation buffers, and state-selected palette variants. These can inform a rights-safe fictional palette system and automated contrast checks without copying the historical values.

## Reproduction

```bash
python tools/rom/scan_palettes.py /private/path/to/rom.bin \
  --out artifacts/private-repro/palettes --render-private-swatches
python tools/rom/test_scan_palettes.py -v
```

The scanner verifies the canonical ROM hash and five hash-only palette/copy proofs. Its public JSON strips all color words and RGB values; private output may retain them for local swatch comparison.

## Remaining gates

1. Close the VBlank transfer path from `0xFFF3A6` to VDP CRAM.
2. Trace which top-level states select each palette bank.
3. Correlate palette sets with title, menus, portraits, ring, HUD, and ending through emulator breakpoints.
4. Map palette indices to raw tile and metasprite banks.
5. Resolve the mixed `0x02C5D2` 128-byte source.
