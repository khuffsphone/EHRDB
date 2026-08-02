# EHRDB ROM-01 — Cartridge Atlas v01

> Static inspection only. No emulator execution, frame measurement, or complete disassembly is claimed.

## Identity

- File: `Evander Holyfield's 'Real Deal' Boxing (World).md`
- Size: 524,288 bytes (`0x80000`)
- MD5: `91f8f3ef27055687a12015b0123cc067`
- SHA-1: `eb4aca22f8b5837a0a0b10491c46714948b09844`
- SHA-256: `b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880`

## Sega header

- Console: `SEGA GENESIS`
- Copyright/date field: `(C)SEGA 1992.JUL`
- Domestic title: `EVANDER HOLYFIELD'S REAL DEAL BOXING`
- International title: `EVANDER HOLYFIELD'S REAL DEAL BOXING`
- Serial/version: `GM MK-1215 -00`
- I/O support: `J`
- Region: `U`
- Header checksum: `0x760F`
- Recomputed checksum: `0x760F`
- Checksum match: **True**
- ROM range: `0x00000000`–`0x0007FFFF`
- RAM range: `0x00FF0000`–`0x00FFFFFF`
- Save signature/flags: `RA` / `0xE840`
- Declared save address: `0x00200001`–`0x00200001`

The one-address save declaration is consistent with the manifest's emulator-source finding that product `MK-1215` uses a serial X24C01/24C01 EEPROM. Static header bytes alone do not establish the logical save-field layout.

## Reset and interrupt vectors

- Initial SSP: `0xFFFFFFE6` (24-bit bus address `0xFFFFE6`, work RAM)
- Reset PC: `0x00000200`
- Shared default exception handler: `0x00000736`
- Level-6 interrupt handler: `0x00000940`

The reset path at `0x00000200` performs standard Genesis hardware checks, writes the `SEGA` TMSS signature when required, initializes VDP/Z80 state, tests the VDP control port, and transfers control to `0x00001710`. This is a bounded bootstrap interpretation, not a full program disassembly.

## Static content boundaries

- Longest `0xFF` fill: `0x0770A2`–`0x07C7FF` (22,366 bytes).
- Candidate raw 4bpp tail bank: `0x07C800`–`0x07FFFF` (14,336 bytes / 448 tiles).
- A private diagnostic atlas produces coherent portrait/figure fragments, strongly supporting an uncompressed 8×8 4bpp graphics interpretation for this tail bank. Exact metasprite composition and palettes remain unresolved.
- Printable ASCII runs ≥4 bytes: 7,400.
- Confirmed text anchors occur in the low-ROM code/data area, including round statistics, career/exhibition menus, rankings, retirement copy, Holyfield, and the hidden Beast reference.

## What this closes

- Exact binary identity, byte size, and checksums.
- Header product code, title, region, checksum, declared ROM/RAM ranges, and save address.
- Vector-table destinations and first bootstrap handoff.
- One confirmed raw-graphics candidate bank at the cartridge tail.

## What remains unresolved

- Full 68000 code/data map and function names.
- Compression formats and the remaining graphics/audio bank boundaries.
- Palettes, tilemaps, metasprites, animation sequencing, and frame timing.
- Fighter tables, combat formulas, scoring logic, AI rules, RNG, and career tables.
- EEPROM logical layout, checksum, and slot format.

## Reproduction command

```bash
python tools/rom/inspect_rom.py /private/path/to/rom.bin \
  --out artifacts/private-repro/rom-atlas --render-tail
```

The ROM and generated extracted-art images remain private and ignored. Only the inspection tool and non-expressive findings belong in the public repository.
