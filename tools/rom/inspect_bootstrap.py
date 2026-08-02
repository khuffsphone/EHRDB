#!/usr/bin/env python3
"""Inspect EHRDB reset, interrupt, startup, and top-level state dispatch.

This public tool stores offsets and hash-only proofs. It does not embed ROM bytes
or attempt a complete 68000 disassembly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

CANONICAL_SHA256 = "b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880"

Proof = tuple[str, int, int, str]
PROOFS: tuple[Proof, ...] = (
    ("reset_bootstrap", 0x000200, 262, "36441b0466ae870b07dcbd9d22ac8eda98ff79873aa374bb4a71cc5ab7864203"),
    ("reset_jump", 0x000300, 6, "32c789dd55dd21ce84cdf4f920a71a485c66737c3407eaa39415d241b6bc38fc"),
    ("main_entry", 0x001710, 58, "d05cd71baddab8cfa65f5f33045cad410adb36fb740fd59d0565bc5e7dc51f25"),
    ("level4_handler", 0x000754, 116, "31483cdede14005e2392741003404cb72b2080c6edddcdb3a88ec25c40e5cc67"),
    ("level6_wrapper", 0x000940, 4, "1f61cc05f7561c2c1b5e66fac04f32540232e137793db8054f528fed6b8763e7"),
    ("level6_core_prologue", 0x00095C, 42, "b89a68d4a8281d0a74370d9c3601ec803a91dedcdc1c97035fb8812a6e8bda3b"),
    ("state_dispatch", 0x00A5C6, 14, "48f25c376b501f186e8eb08ec48a477782b9d6909f4ac8bbccdb95e5e47c44d9"),
    ("state_table", 0x00A608, 204, "c6058c83ca1ff1c8ca5c3e9ce5fc9034a62a7c5bb0ad62d26b8add4d511b4aeb"),
)

STATE_TABLE_BASE = 0x00A608
STATE_COUNT = 34  # null state 0 plus states 1..33
STATE_RECORD_SIZE = 6


def u16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 2], "big")


def u32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 4], "big")


def s16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def verify_proofs(
    data: bytes, proofs: tuple[Proof, ...] | None = None
) -> list[dict[str, Any]]:
    rows = []
    for name, offset, length, expected in proofs or PROOFS:
        actual = hashlib.sha256(data[offset : offset + length]).hexdigest()
        if actual != expected:
            raise ValueError(
                f"proof {name} failed at 0x{offset:06X}: expected {expected}, got {actual}"
            )
        rows.append(
            {
                "name": name,
                "offset_hex": f"0x{offset:06X}",
                "length": length,
                "sha256": actual,
                "status": "MATCH",
            }
        )
    return rows


def branch_word_target(data: bytes, offset: int) -> int:
    if u16(data, offset) != 0x6100:
        raise ValueError(f"expected BSR.W at 0x{offset:06X}")
    # 68000 word-branch displacement is relative to the extension-word address.
    return (offset + 2 + s16(u16(data, offset + 2))) & 0xFFFFFF


def branch_short_target(data: bytes, offset: int) -> int:
    opcode = u16(data, offset)
    if opcode >> 8 != 0x61 or opcode & 0xFF in (0x00, 0xFF):
        raise ValueError(f"expected BSR.S at 0x{offset:06X}")
    disp = opcode & 0xFF
    if disp & 0x80:
        disp -= 0x100
    return (offset + 2 + disp) & 0xFFFFFF


def absolute_long_target(data: bytes, offset: int, opcode: int) -> int:
    if u16(data, offset) != opcode:
        raise ValueError(f"unexpected opcode at 0x{offset:06X}")
    return u32(data, offset + 2) & 0xFFFFFF


def absolute_word_target(data: bytes, offset: int, opcode: int) -> int:
    if u16(data, offset) != opcode:
        raise ValueError(f"unexpected opcode at 0x{offset:06X}")
    return u16(data, offset + 2)


def parse_state_table(data: bytes) -> list[dict[str, Any]]:
    rows = []
    for state in range(STATE_COUNT):
        offset = STATE_TABLE_BASE + state * STATE_RECORD_SIZE
        handler = u32(data, offset) & 0xFFFFFF
        parameter = u16(data, offset + 4)
        if handler and handler >= len(data):
            raise ValueError(
                f"state {state} points outside ROM: 0x{handler:06X}"
            )
        rows.append(
            {
                "state": state,
                "record_offset_hex": f"0x{offset:06X}",
                "handler": handler,
                "handler_hex": f"0x{handler:06X}",
                "parameter": parameter,
                "parameter_hex": f"0x{parameter:04X}",
                "null": handler == 0,
            }
        )
    return rows


def inspect(
    data: bytes,
    *,
    require_canonical_hash: bool = True,
    proofs: tuple[Proof, ...] | None = None,
) -> dict[str, Any]:
    sha256 = hashlib.sha256(data).hexdigest()
    if require_canonical_hash and sha256 != CANONICAL_SHA256:
        raise ValueError(f"unexpected ROM SHA-256: {sha256}")

    proof_rows = verify_proofs(data, proofs)
    vectors = {
        "initial_ssp": u32(data, 0x00),
        "reset": u32(data, 0x04),
        "level4": u32(data, 0x70),
        "level6": u32(data, 0x78),
    }

    startup_calls = [
        {"offset_hex": "0x001718", "kind": "BSR.W", "target": branch_word_target(data, 0x1718)},
        {"offset_hex": "0x001726", "kind": "JSR.L", "target": absolute_long_target(data, 0x1726, 0x4EB9)},
        {"offset_hex": "0x00172C", "kind": "JSR.L", "target": absolute_long_target(data, 0x172C, 0x4EB9)},
        {"offset_hex": "0x001732", "kind": "BSR.W", "target": branch_word_target(data, 0x1732)},
        {"offset_hex": "0x001736", "kind": "BSR.W", "target": branch_word_target(data, 0x1736)},
        {"offset_hex": "0x00173A", "kind": "BSR.W", "target": branch_word_target(data, 0x173A)},
        {"offset_hex": "0x00173E", "kind": "JSR.W", "target": absolute_word_target(data, 0x173E, 0x4EB8)},
        {"offset_hex": "0x001742", "kind": "JMP.L", "target": absolute_long_target(data, 0x1742, 0x4EF9)},
    ]
    for row in startup_calls:
        row["target_hex"] = f"0x{row['target']:06X}"

    states = parse_state_table(data)
    nonzero = [row for row in states if not row["null"]]
    handlers = Counter(row["handler_hex"] for row in nonzero)
    parameters = Counter(row["parameter_hex"] for row in states)

    # The dispatcher reads a word state, multiplies by six, and indexes a PC table.
    state_ram = u16(data, 0xA5C8)
    state_stride = u16(data, 0xA5CC)
    state_limit = u16(data, 0xA5E6)
    if state_ram != 0xF884 or state_stride != 6 or state_limit != 0x21:
        raise ValueError("unexpected state-dispatch constants")

    return {
        "schema": "ehrdb-rom-bootstrap-control-v1",
        "source_sha256": sha256,
        "proofs": proof_rows,
        "vectors": {
            key: {"value": value, "value_hex": f"0x{value:08X}"}
            for key, value in vectors.items()
        },
        "reset_flow": {
            "reset_entry_hex": f"0x{vectors['reset']:06X}",
            "direct_jump_offset_hex": "0x000300",
            "direct_jump_target_hex": f"0x{absolute_long_target(data, 0x300, 0x4EF9):06X}",
            "tmss_literal_offset_hex": "0x000228",
            "vdp_status_test_offset_hex": "0x0002FA",
        },
        "interrupts": {
            "level4_hblank": {
                "entry_hex": f"0x{vectors['level4']:06X}",
                "verified_end_exclusive_hex": "0x0007C8",
                "callback_pointer_ram_hex": "0xFFF880",
            },
            "level6_vblank": {
                "entry_hex": f"0x{vectors['level6']:06X}",
                "wrapper_target_hex": f"0x{branch_short_target(data, 0x940):06X}",
                "wrapper_returns_with": "RTE",
                "callback_pointer_ram_hex": "0xFFF878",
            },
        },
        "main_entry": {
            "entry_hex": "0x001710",
            "startup_calls": startup_calls,
            "stack_reset_hex": "0xFFFFE6",
            "top_level_loop_hex": "0x00A4E4",
        },
        "state_dispatch": {
            "dispatch_offset_hex": "0x00A5C6",
            "state_ram_hex": "0xFFF884",
            "record_stride": state_stride,
            "table_base_hex": f"0x{STATE_TABLE_BASE:06X}",
            "state_limit_inclusive": state_limit,
            "record_count": len(states),
            "null_state_count": sum(row["null"] for row in states),
            "nonzero_state_count": len(nonzero),
            "unique_handler_count": len(handlers),
            "handler_reuse": dict(sorted(handlers.items())),
            "parameter_distribution": dict(sorted(parameters.items())),
            "records": states,
        },
        "semantic_limits": [
            "Handler addresses and descriptor parameters are verified; human-readable scene names are not assigned.",
            "Level-4 and level-6 HBlank/VBlank labels follow Genesis autovector convention and observed VDP access.",
            "This is a bounded control-flow atlas, not a complete instruction disassembly.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("rom", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--allow-noncanonical", action="store_true")
    args = parser.parse_args()

    result = inspect(
        args.rom.read_bytes(), require_canonical_hash=not args.allow_noncanonical
    )
    args.out.mkdir(parents=True, exist_ok=True)
    path = args.out / "ROM_BOOTSTRAP_CONTROL.json"
    path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(path),
                "reset": result["vectors"]["reset"]["value_hex"],
                "top_level_loop": result["main_entry"]["top_level_loop_hex"],
                "states": result["state_dispatch"]["record_count"],
                "unique_handlers": result["state_dispatch"]["unique_handler_count"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
