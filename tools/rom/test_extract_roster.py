#!/usr/bin/env python3
"""Synthetic tests for extract_roster.py; no historical names or bytes."""
from __future__ import annotations

import hashlib
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("extract_roster.py")
SPEC = importlib.util.spec_from_file_location("ehrdb_extract_roster", MODULE_PATH)
assert SPEC and SPEC.loader
R = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = R
SPEC.loader.exec_module(R)


def synthetic_rom() -> tuple[bytes, tuple[R.Proof, ...]]:
    data = bytearray(0xA000)
    proof_rows = []
    for index, (name, offset, length, _digest) in enumerate(R.PROOFS, start=1):
        signature = bytes([index]) * length
        data[offset : offset + length] = signature
        proof_rows.append((name, offset, length, hashlib.sha256(signature).hexdigest()))

    for index in range(R.RECORD_COUNT):
        offset = R.ROSTER_START + index * R.RECORD_SIZE
        name = f"FTR{index:02d}".encode("ascii").ljust(13, b"@")
        data[offset : offset + 13] = name
        data[offset + 13 : offset + 23] = bytes(
            [index & 1, 1, 2, 3, 4, 0x40, 0x50, 0x60, 0x70, (index % 3) + 1]
        )

    data[R.LADDER_START : R.LADDER_START + 30] = bytes(range(4, 34))
    data[R.LADDER_START + 30 : R.LADDER_START + 60] = bytes(range(30))
    data[R.LADDER_START + 60 : R.LADDER_START + 90] = bytes(reversed(range(30)))
    return bytes(data), tuple(proof_rows)


class ExtractRosterTests(unittest.TestCase):
    def test_structure_and_sets(self) -> None:
        data, proofs = synthetic_rom()
        result = R.extract(data, require_canonical_hash=False, proofs=proofs)
        self.assertEqual(len(result["records"]), 60)
        self.assertEqual(len(result["initial_ladder"]), 30)
        self.assertEqual(len(result["reserve"]), 30)
        self.assertEqual(result["initial_ladder"][0]["factory_record_index"], 0)
        self.assertEqual(result["initial_ladder"][-1]["factory_record_index"], 29)

    def test_created_slot_dispatch_metadata(self) -> None:
        data, proofs = synthetic_rom()
        result = R.extract(data, require_canonical_hash=False, proofs=proofs)
        slots = result["structure"]["created_fighter_slots"]
        self.assertEqual(slots["internal_ids"], [0, 1, 2, 3])
        self.assertEqual(slots["record_size"], 0x22)

    def test_private_outputs(self) -> None:
        data, proofs = synthetic_rom()
        result = R.extract(data, require_canonical_hash=False, proofs=proofs)
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            R.write_outputs(result, out)
            self.assertTrue((out / "PRIVATE_ROSTER_LADDER.json").exists())
            self.assertEqual(
                len((out / "PRIVATE_INITIAL_LADDER.tsv").read_text().splitlines()),
                31,
            )


if __name__ == "__main__":
    unittest.main()
