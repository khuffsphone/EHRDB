#!/usr/bin/env python3
"""Synthetic tests for inspect_bootstrap.py; no historical bytes."""
from __future__ import annotations

import hashlib
import importlib.util
import sys
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("inspect_bootstrap.py")
SPEC = importlib.util.spec_from_file_location("ehrdb_bootstrap", MODULE_PATH)
assert SPEC and SPEC.loader
R = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = R
SPEC.loader.exec_module(R)


def synthetic_rom() -> tuple[bytes, tuple[R.Proof, ...]]:
    data = bytearray(0xA800)

    data[0:4] = (0xFFFFFFE6).to_bytes(4, "big")
    data[4:8] = (0x200).to_bytes(4, "big")
    data[0x70:0x74] = (0x754).to_bytes(4, "big")
    data[0x78:0x7C] = (0x940).to_bytes(4, "big")
    data[0x300:0x306] = bytes.fromhex("4E F9 00 00 17 10")
    data[0x940:0x944] = bytes.fromhex("61 1A 4E 73")

    # Startup calls: relative branches use extension-word-address base.
    for offset, target in [(0x1718, 0xC1C), (0x1732, 0xD92), (0x1736, 0x306), (0x173A, 0xBFA)]:
        data[offset:offset+2] = (0x6100).to_bytes(2, "big")
        data[offset+2:offset+4] = ((target - (offset + 2)) & 0xFFFF).to_bytes(2, "big")
    for offset, opcode, target in [(0x1726,0x4EB9,0x2C40A),(0x172C,0x4EB9,0x7DC4),(0x1742,0x4EF9,0xA4E4)]:
        data[offset:offset+2] = opcode.to_bytes(2, "big")
        data[offset+2:offset+6] = target.to_bytes(4, "big")
    data[0x173E:0x1742] = bytes.fromhex("4E B8 0C 34")

    data[0xA5C6:0xA5D4] = bytes.fromhex("30 38 F8 84 C0 FC 00 06 20 7B 00 38 4E 90")
    data[0xA5E4:0xA5E8] = bytes.fromhex("0C 40 00 21")
    for state in range(R.STATE_COUNT):
        offset = R.STATE_TABLE_BASE + state * R.STATE_RECORD_SIZE
        handler = 0 if state == 0 else 0x1000 + state * 2
        data[offset:offset+4] = handler.to_bytes(4, "big")
        data[offset+4:offset+6] = state.to_bytes(2, "big")

    # Proof hashes must be calculated after all synthetic instructions and
    # table records are written; otherwise later writes invalidate them.
    proof_rows = []
    for name, offset, length, _digest in R.PROOFS:
        block = bytes(data[offset:offset+length])
        proof_rows.append((name, offset, length, hashlib.sha256(block).hexdigest()))
    return bytes(data), tuple(proof_rows)


class BootstrapTests(unittest.TestCase):
    def test_branch_targets(self) -> None:
        data, _proofs = synthetic_rom()
        self.assertEqual(R.branch_word_target(data, 0x1718), 0xC1C)
        self.assertEqual(R.branch_short_target(data, 0x940), 0x95C)
        self.assertEqual(R.absolute_long_target(data, 0x300, 0x4EF9), 0x1710)

    def test_state_table(self) -> None:
        data, _proofs = synthetic_rom()
        rows = R.parse_state_table(data)
        self.assertEqual(len(rows), 34)
        self.assertTrue(rows[0]["null"])
        self.assertFalse(rows[33]["null"])

    def test_full_inspection(self) -> None:
        data, proofs = synthetic_rom()
        result = R.inspect(data, require_canonical_hash=False, proofs=proofs)
        self.assertEqual(result["state_dispatch"]["record_stride"], 6)
        self.assertEqual(result["state_dispatch"]["state_limit_inclusive"], 33)
        self.assertEqual(result["main_entry"]["top_level_loop_hex"], "0x00A4E4")


if __name__ == "__main__":
    unittest.main()
