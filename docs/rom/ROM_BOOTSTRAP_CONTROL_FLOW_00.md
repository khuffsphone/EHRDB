# ROM-01B — Bootstrap, Interrupts, and Top-Level State Dispatch v01

> Static inspection of the verified World cartridge. This is a bounded control-flow atlas, not a complete 68000 disassembly. Human-readable scene names are deliberately withheld until runtime traces or stronger cross-references prove them.

## Evidence labels

- **VERIFIED_ROM** — exact vector, constant, offset, target, table shape, or hash match.
- **VERIFIED_CONTROL_FLOW** — a bounded instruction sequence establishes the branch/call/dispatch relationship.
- **SUPPORTED_SEMANTIC** — hardware convention and observed VDP/RAM use support a label, but the entire handler is not yet traced.
- **UNRESOLVED** — no canonical gameplay or screen meaning is assigned.

## Reset and startup chain

The cartridge's reset vector points to `0x000200`.

1. `0x000200–0x000305` performs the Genesis hardware bootstrap.
2. The bounded block includes the TMSS `SEGA` literal at `0x000228`, VDP/Z80 initialization, and a VDP status test near `0x0002FA`.
3. A direct long jump at `0x000300` transfers to `0x001710`.
4. The startup routine at `0x001710` executes seven calls and one terminal jump:

| Call site | Form | Target |
|---|---|---:|
| `0x001718` | `BSR.W` | `0x000C1C` |
| `0x001726` | `JSR.L` | `0x02C40A` |
| `0x00172C` | `JSR.L` | `0x007DC4` |
| `0x001732` | `BSR.W` | `0x000D92` |
| `0x001736` | `BSR.W` | `0x000306` |
| `0x00173A` | `BSR.W` | `0x000BFA` |
| `0x00173E` | `JSR.W` | `0x000C34` |
| `0x001742` | `JMP.L` | `0x00A4E4` |

This closes the first stable startup chain: reset → hardware bootstrap → game startup → top-level loop. The individual startup routines remain unnamed until their side effects are mapped.

## Interrupt architecture

### Level 4 — supported HBlank label

- Vector entry: `0x000754`.
- Verified bounded handler end: `0x0007C8`.
- Indirect callback pointer: RAM `0xFFF880`.

The HBlank label is supported by the Genesis level-4 autovector convention and the handler's display-controller work. The callback slot establishes that the engine can replace or augment horizontal-interrupt behavior without rewriting the vector.

### Level 6 — supported VBlank label

- Vector entry: `0x000940`.
- The wrapper performs a short subroutine branch to `0x00095C` and returns with `RTE`.
- Indirect callback pointer: RAM `0xFFF878`.

The VBlank label is supported by the Genesis level-6 autovector convention and the core handler's VDP-facing behavior. The two callback pointers are distinct, establishing separate frame-phase extension hooks.

## Top-level loop and state dispatcher

The startup routine terminates at loop entry `0x00A4E4`. The bounded dispatcher at `0x00A5C6`:

1. reads a word state from RAM `0xFFF884`;
2. multiplies the state by six;
3. indexes a PC-relative descriptor table at `0x00A608`;
4. invokes the selected long handler address;
5. uses a verified inclusive state limit of `33`.

### Descriptor table

- Table: `0x00A608–0x00A6D3`.
- Record size: **6 bytes**.
- Records: **34** — state `0` plus states `1–33`.
- State `0`: null handler and zero parameter.
- Live states: **33**.
- Unique handlers: **13**.
- Per-record physical shape: 4-byte handler pointer + 2-byte parameter.

The table heavily reuses handlers, so it is not a simple “one scene equals one function” list. The parameter is part of the descriptor contract and likely selects a variant, resource, timer, or transition mode. No player-facing names are assigned yet.

### Handler reuse

| Handler | State count |
|---|---:|
| `0x00BD9A` | 2 |
| `0x00BDE6` | 1 |
| `0x00BDEE` | 1 |
| `0x00BDF6` | 1 |
| `0x00C048` | 1 |
| `0x00C066` | 1 |
| `0x00C06E` | 1 |
| `0x00C076` | 1 |
| `0x00C07E` | 4 |
| `0x00C086` | 5 |
| `0x00C08E` | 4 |
| `0x00C0CE` | 6 |
| `0x00C13A` | 5 |

### Parameter distribution

| Parameter | Records |
|---|---:|
| `0x0000` | 5 |
| `0x0006` | 4 |
| `0x0008` | 5 |
| `0x0010` | 2 |
| `0x0020` | 4 |
| `0x003C` | 2 |
| `0x003F` | 5 |
| `0x0080` | 1 |
| `0x00C0` | 4 |
| `0x0100` | 1 |
| `0x0500` | 1 |

The repeated `0x003C`/`0x003F`/`0x00C0` values could be timing, palette, tile, or mode selectors. That interpretation remains unresolved.

## Why this matters to TEN COUNT

TEN COUNT already uses explicit Phaser scenes and a deterministic fixed-step bout simulation. The original cartridge instead exposes a compact central state number with a descriptor table and reused handlers. This does not require rewriting the modern scene architecture, but it does support three implementation practices:

1. maintain one explicit, inspectable top-level state registry rather than scattered transition strings;
2. separate shared state handlers from state-specific parameters;
3. keep interrupt/frame-phase hooks explicit so rendering, input sampling, simulation, and audio remain ordered and testable.

These are architectural lessons, not ROM-expression reuse.

## Reproduction

```bash
python tools/rom/inspect_bootstrap.py /private/path/to/rom.bin \
  --out artifacts/private-repro/bootstrap
python tools/rom/test_inspect_bootstrap.py -v
```

The tool verifies the canonical ROM hash and eight hash-only proof blocks. It emits offsets, destinations, descriptor records, and confidence limits; it does not emit original instruction bytes.

## Remaining gates

1. Trace the side effects of each startup target.
2. Trace writes to `0xFFF884` to build the state-transition graph.
3. Trace all reads of the six-byte descriptor's parameter word.
4. Use emulator breakpoints to correlate state numbers with title, menu, career, training, fight, results, and ending screens.
5. Map the `0xFFF878` and `0xFFF880` callback writers to the states that install them.
