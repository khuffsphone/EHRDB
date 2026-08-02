#!/usr/bin/env python3
"""Find Sega Genesis CRAM palette candidates in a private EHRDB ROM.

The public tool contains heuristics, offsets discovered by the scan, and
hash-only evidence. Private output may contain palette words and rendered
swatches; those outputs belong under an ignored research directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import zlib
from collections import defaultdict
from pathlib import Path
from typing import Any

CANONICAL_SHA256 = "b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880"
CRAM_UNUSED_MASK = 0xF111
PALETTE_COLORS = 16
PALETTE_BYTES = 32
CRAM_SET_COLORS = 64
CRAM_SET_BYTES = 128

Proof = tuple[str, int, int, str]
PROOFS: tuple[Proof, ...] = (
    ("copy_128_routine", 0x000BE0, 10, "ec4a1c408093eaf692aa6542dcf88ca156b91e1b51071cc76f5a15d4c26531f4"),
    ("palette_buffer_init", 0x000BC4, 28, "0d087ec5eaceeaab26f37bc7bb125726a577bfb4f2ac772be2a490f540fcf4d0"),
    ("single_palette_copy", 0x0026B8, 18, "7607defc879c45461d93a93bf60b2f07a2515b489f5c0e7ca563ab4e1faa2d2e"),
    ("copy_32_routine", 0x004B58, 10, "82eb2e33ffe02a516aaf6044755e2dbba7734e109653ec8e5a44d255773b7c81"),
    ("full_cram_dispatch", 0x00C048, 56, "6c9d94ac2f62035721a4932dd0fc39cd7058ab1374a1b925d0534d5b1b2bf58a"),
)

# Copy widths are established by bounded call-site/routine inspection.
TARGET_USAGE: dict[int, dict[str, Any]] = {
    0x009684: {"copy_bytes": 128, "method": "BSR.W to 0x000BE0"},
    0x009764: {"copy_bytes": 128, "method": "BSR.W to 0x000BE0"},
    0x00C414: {"copy_bytes": 128, "method": "JSR.W to 0x000BE0"},
    0x00C494: {"copy_bytes": 128, "method": "shared full-CRAM dispatch"},
    0x00C514: {"copy_bytes": 128, "method": "shared full-CRAM dispatch"},
    0x00C594: {"copy_bytes": 128, "method": "shared full-CRAM dispatch"},
    0x00C614: {"copy_bytes": 128, "method": "shared full-CRAM dispatch"},
    0x02C592: {"copy_bytes": 32, "method": "8-longword copy loop"},
    0x02C5D2: {"copy_bytes": 128, "method": "BSR.W to 0x000BE0"},
    0x02D6EE: {"copy_bytes": 32, "method": "BSR.S to 0x004B58"},
    0x02D72E: {"copy_bytes": 128, "method": "JMP.W to 0x000BE0"},
}


def u16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 2], "big")


def u32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset : offset + 4], "big")


def is_cram_word(word: int) -> bool:
    """Genesis CRAM uses bits 1-3, 5-7 and 9-11; the rest must be zero."""
    return (word & CRAM_UNUSED_MASK) == 0


def decode_rgb3(word: int) -> tuple[int, int, int]:
    return ((word >> 1) & 7, (word >> 5) & 7, (word >> 9) & 7)


def expand_3bit(value: int) -> int:
    return (value * 255 + 3) // 7


def classify_pointer_operand(data: bytes, operand_offset: int) -> str:
    if operand_offset < 2:
        return "RAW_LONGWORD"
    opcode = u16(data, operand_offset - 2)
    if (opcode & 0xF1FF) == 0x41F9:
        return f"LEA_ABS_LONG_A{(opcode >> 9) & 7}"
    if (opcode & 0xF1FF) == 0x207C:
        return f"MOVEA_IMM_LONG_A{(opcode >> 9) & 7}"
    if opcode == 0x4879:
        return "PEA_ABS_LONG"
    if opcode == 0x4EB9:
        return "JSR_ABS_LONG"
    if opcode == 0x4EF9:
        return "JMP_ABS_LONG"
    return "RAW_LONGWORD"


def palette_metrics(data: bytes, offset: int, colors: int = PALETTE_COLORS) -> dict[str, Any]:
    end = offset + colors * 2
    if offset < 0 or end > len(data) or offset % 2:
        raise ValueError("palette range is invalid")
    words = [u16(data, offset + i * 2) for i in range(colors)]
    rgbs = [decode_rgb3(word) for word in words]
    channel_ranges = [max(c[i] for c in rgbs) - min(c[i] for c in rgbs) for i in range(3)]
    luminances = [r + g + b for r, g, b in rgbs]
    valid_count = sum(is_cram_word(word) for word in words)
    unique_count = len(set(words))
    nonzero_count = sum(word != 0 for word in words)
    score = valid_count * 4
    score += min(unique_count, colors) * 2
    score += sum(channel_ranges)
    score += 8 if words[0] == 0 else 0
    score += 4 if nonzero_count >= min(8, colors // 2) else 0
    if unique_count <= 2:
        score -= 20
    if sum(channel_ranges) <= 2:
        score -= 16
    return {
        "offset": offset,
        "offset_hex": f"0x{offset:06X}",
        "colors": colors,
        "bytes": colors * 2,
        "valid_count": valid_count,
        "all_words_cram_valid": valid_count == colors,
        "unique_count": unique_count,
        "nonzero_count": nonzero_count,
        "first_color_zero": words[0] == 0,
        "channel_ranges_3bit": channel_ranges,
        "luminance_range": max(luminances) - min(luminances),
        "heuristic_score": score,
        "sha256": hashlib.sha256(data[offset:end]).hexdigest(),
        "words": words,
        "rgb3": rgbs,
    }


def find_valid_word_runs(data: bytes, start: int = 0x200) -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    run_start: int | None = None
    offset = start + (start & 1)
    for current in range(offset, len(data) - 1, 2):
        valid = is_cram_word(u16(data, current))
        if valid and run_start is None:
            run_start = current
        if not valid and run_start is not None:
            word_count = (current - run_start) // 2
            if word_count >= PALETTE_COLORS:
                runs.append({"start":run_start,"start_hex":f"0x{run_start:06X}","end_exclusive":current,"end_exclusive_hex":f"0x{current:06X}","word_count":word_count,"palette_16_capacity":word_count//16,"cram_set_64_capacity":word_count//64})
            run_start = None
    if run_start is not None:
        current = len(data) & ~1
        word_count = (current - run_start) // 2
        if word_count >= PALETTE_COLORS:
            runs.append({"start":run_start,"start_hex":f"0x{run_start:06X}","end_exclusive":current,"end_exclusive_hex":f"0x{current:06X}","word_count":word_count,"palette_16_capacity":word_count//16,"cram_set_64_capacity":word_count//64})
    return runs


def build_longword_references(data: bytes) -> dict[int, list[dict[str, Any]]]:
    refs: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for source in range(2, len(data) - 3, 2):
        target = u32(data, source) & 0xFFFFFF
        if target >= len(data) or target % 2:
            continue
        refs[target].append({"operand_offset":source,"operand_offset_hex":f"0x{source:06X}","kind":classify_pointer_operand(data, source)})
    return refs


def verify_proofs(data: bytes) -> list[dict[str, Any]]:
    rows = []
    for name, offset, length, expected in PROOFS:
        actual = hashlib.sha256(data[offset : offset + length]).hexdigest()
        if actual != expected:
            raise ValueError(f"proof {name} failed at 0x{offset:06X}: expected {expected}, got {actual}")
        rows.append({"name":name,"offset_hex":f"0x{offset:06X}","length":length,"sha256":actual,"status":"MATCH"})
    return rows


def usage_metrics(data: bytes, target: int) -> dict[str, Any] | None:
    usage = TARGET_USAGE.get(target)
    if usage is None:
        return None
    copy_bytes = usage["copy_bytes"]
    words = [u16(data, offset) for offset in range(target, target + copy_bytes, 2)]
    valid_words = sum(is_cram_word(word) for word in words)
    return {**usage,"copied_words":len(words),"cram_valid_words":valid_words,"all_copied_words_cram_valid":valid_words==len(words),"copied_block_sha256":hashlib.sha256(data[target:target+copy_bytes]).hexdigest(),"evidence":"VERIFIED_CONTROL_FLOW"}


def _bank_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    start = min(row["offset"] for row in rows)
    end = max(row["offset"] + (CRAM_SET_BYTES if row["cram64"] else PALETTE_BYTES) for row in rows)
    return {"start":start,"start_hex":f"0x{start:06X}","end_exclusive":end,"end_exclusive_hex":f"0x{end:06X}","referenced_target_count":len(rows),"targets":[row["offset_hex"] for row in rows],"code_reference_count":sum(row["code_reference_count"] for row in rows)}


def scan(data: bytes, *, require_canonical_hash: bool = True) -> dict[str, Any]:
    sha256 = hashlib.sha256(data).hexdigest()
    if require_canonical_hash and sha256 != CANONICAL_SHA256:
        raise ValueError(f"unexpected ROM SHA-256: {sha256}")
    proof_rows = verify_proofs(data) if require_canonical_hash else []
    refs = build_longword_references(data)
    runs = find_valid_word_runs(data)
    referenced: list[dict[str, Any]] = []
    for target, target_refs in refs.items():
        if target + PALETTE_BYTES > len(data):
            continue
        metrics16 = palette_metrics(data, target, PALETTE_COLORS)
        if not metrics16["all_words_cram_valid"]:
            continue
        code_refs = [row for row in target_refs if row["kind"] != "RAW_LONGWORD"]
        if not code_refs:
            continue
        metrics64 = None
        if target + CRAM_SET_BYTES <= len(data):
            candidate64 = palette_metrics(data, target, CRAM_SET_COLORS)
            if candidate64["all_words_cram_valid"]:
                metrics64 = candidate64
        confidence = "HIGH" if metrics16["unique_count"] >= 6 or metrics64 else "MEDIUM"
        referenced.append({"offset":target,"offset_hex":f"0x{target:06X}","confidence":confidence,"palette16":metrics16,"cram64":metrics64,"references":target_refs,"code_reference_count":len(code_refs),"raw_reference_count":len(target_refs)-len(code_refs),"copy_usage":usage_metrics(data,target)})
    referenced.sort(key=lambda row:(-row["code_reference_count"],-row["palette16"]["heuristic_score"],row["offset"]))
    banks=[]; current=[]
    for row in sorted(referenced,key=lambda item:item["offset"]):
        if current and row["offset"]-current[-1]["offset"]>0x100:
            banks.append(_bank_summary(current)); current=[]
        current.append(row)
    if current: banks.append(_bank_summary(current))
    return {"schema":"ehrdb-rom-palette-scan-v1","source_sha256":sha256,"cram_word_rule":"(word & 0xF111) == 0","proofs":proof_rows,"referenced_palette_candidates":referenced,"candidate_banks":banks,"valid_word_runs":runs,"semantic_limits":["A code-referenced CRAM-valid block is a high-value palette lead, not automatic proof of the screen or asset that uses it.","Private swatches may render color values; public reports retain only offsets, metrics, hashes, and reference structure.","PC-relative and computed references are not fully covered by the absolute-long scan."]}


def _png_chunk(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I",len(payload))+kind+payload+struct.pack(">I",zlib.crc32(kind+payload)&0xFFFFFFFF)


def write_rgb_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    rows=b"".join(b"\x00"+pixels[y*width*3:(y+1)*width*3] for y in range(height))
    path.write_bytes(b"\x89PNG\r\n\x1a\n"+_png_chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,2,0,0,0))+_png_chunk(b"IDAT",zlib.compress(rows,9))+_png_chunk(b"IEND",b""))


def render_swatch(path: Path, words: list[int], *, cell: int = 24, columns: int = 16) -> None:
    rows=math.ceil(len(words)/columns); width,height=columns*cell,rows*cell; pixels=bytearray(width*height*3)
    for index,word in enumerate(words):
        r3,g3,b3=decode_rgb3(word); color=(expand_3bit(r3),expand_3bit(g3),expand_3bit(b3)); x0=(index%columns)*cell; y0=(index//columns)*cell
        for y in range(y0,y0+cell):
            for x in range(x0,x0+cell):
                p=(y*width+x)*3; pixels[p:p+3]=bytes(color)
    write_rgb_png(path,width,height,bytes(pixels))


def public_result(result: dict[str, Any]) -> dict[str, Any]:
    def strip(metrics: dict[str, Any] | None) -> dict[str, Any] | None:
        return None if metrics is None else {k:v for k,v in metrics.items() if k not in {"words","rgb3"}}
    rows=[]
    for row in result["referenced_palette_candidates"]:
        rows.append({**{k:v for k,v in row.items() if k not in {"palette16","cram64"}},"palette16":strip(row["palette16"]),"cram64":strip(row["cram64"])})
    return {**{k:v for k,v in result.items() if k!="referenced_palette_candidates"},"referenced_palette_candidates":rows}


def main() -> int:
    parser=argparse.ArgumentParser(); parser.add_argument("rom",type=Path); parser.add_argument("--out",type=Path,required=True); parser.add_argument("--allow-noncanonical",action="store_true"); parser.add_argument("--render-private-swatches",action="store_true"); args=parser.parse_args()
    data=args.rom.read_bytes(); result=scan(data,require_canonical_hash=not args.allow_noncanonical); args.out.mkdir(parents=True,exist_ok=True)
    (args.out/"PRIVATE_PALETTE_SCAN.json").write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    (args.out/"PALETTE_STRUCTURE_PUBLIC.json").write_text(json.dumps(public_result(result),indent=2)+"\n",encoding="utf-8")
    if args.render_private_swatches:
        swatches=args.out/"private_swatches"; swatches.mkdir(exist_ok=True)
        for row in result["referenced_palette_candidates"]:
            metrics=row["cram64"] or row["palette16"]
            render_swatch(swatches/f"palette_{row['offset']:06X}_{metrics['colors']}c.png",metrics["words"])
    print(json.dumps({"output":str(args.out),"referenced_candidates":len(result["referenced_palette_candidates"]),"banks":len(result["candidate_banks"]),"valid_word_runs":len(result["valid_word_runs"])},indent=2)); return 0


if __name__ == "__main__":
    raise SystemExit(main())
