#!/usr/bin/env python3
"""Synthetic tests for scan_palettes.py; no historical palette values."""
from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("scan_palettes.py")
SPEC = importlib.util.spec_from_file_location("ehrdb_scan_palettes", MODULE_PATH)
assert SPEC and SPEC.loader
R = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = R
SPEC.loader.exec_module(R)


def synthetic_rom() -> bytes:
    data = bytearray(0x1000)
    target16 = 0x400
    target64 = 0x600
    colors16 = [0] + [
        ((i & 7) << 1) | (((i * 2) & 7) << 5) | (((i * 3) & 7) << 9)
        for i in range(1, 16)
    ]
    colors64 = colors16 * 4
    for index, word in enumerate(colors16):
        data[target16 + index * 2 : target16 + index * 2 + 2] = word.to_bytes(2, "big")
    for index, word in enumerate(colors64):
        data[target64 + index * 2 : target64 + index * 2 + 2] = word.to_bytes(2, "big")
    data[0x100:0x106] = bytes.fromhex("41 F9") + target16.to_bytes(4, "big")
    data[0x120:0x126] = bytes.fromhex("41 F9") + target64.to_bytes(4, "big")
    return bytes(data)


class PaletteScanTests(unittest.TestCase):
    def test_cram_rule(self) -> None:
        self.assertTrue(R.is_cram_word(0x0EEE))
        self.assertFalse(R.is_cram_word(0x1111))

    def test_referenced_candidates(self) -> None:
        result = R.scan(synthetic_rom(), require_canonical_hash=False)
        offsets = {row["offset"] for row in result["referenced_palette_candidates"]}
        self.assertIn(0x400, offsets)
        self.assertIn(0x600, offsets)
        row64 = next(
            row for row in result["referenced_palette_candidates"]
            if row["offset"] == 0x600
        )
        self.assertIsNotNone(row64["cram64"])

    def test_public_output_strips_colors(self) -> None:
        result = R.public_result(R.scan(synthetic_rom(), require_canonical_hash=False))
        for row in result["referenced_palette_candidates"]:
            self.assertNotIn("words", row["palette16"])
            self.assertNotIn("rgb3", row["palette16"])

    def test_rgb_png(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "swatch.png"
            R.render_swatch(path, [0x0000, 0x0EEE])
            self.assertEqual(path.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")


if __name__ == "__main__":
    unittest.main()
