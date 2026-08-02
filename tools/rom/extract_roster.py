#!/usr/bin/env python3
"""Extract EHRDB's private factory-roster and initial-ladder evidence.

The script contains offsets and decoding logic only. Run it against a privately
held ROM and write outputs under an ignored research directory. Do not commit
its full name/data exports to a release repository.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

CANONICAL_SHA256 = "b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880"
ROSTER_START = 0x0097E4
RECORD_SIZE = 0x17
RECORD_COUNT = 60
LADDER_START = 0x009D48
LADDER_COUNT = 30

# Hash-only proofs avoid embedding original instruction bytes in the public tool.
Proof = tuple[str, int, int, str]
PROOFS: tuple[Proof, ...] = (
    ("rank_id_dispatch", 0x00877E, 24, "84e3874074139328793fb3f8d5f298f2378e4a4159583e7bb134ce7dd94bca01"),
    ("factory_record_loader", 0x0087C2, 22, "6d8059abcfb10d9dd91f1c10354988f8a9efad64d8d0a0ed41a67844eccef620"),
    ("ladder_bootstrap_copy", 0x007E26, 18, "3c97371a91a6dcc6c2f0bd90a70d3af8bf13fbcae5f6eeaf5e18997edef28733"),
    ("paired_bout_count_use", 0x0087F0, 22, "71a3afb7ef2f49a1c92edea6c56bbe8ec50918a573f64d9f9c33edafd60fc14f"),
    ("four_rating_transform", 0x008806, 48, "aaff39729c982d124e163b3b55886e72f18776b2836abca4c506cf47f7148166"),
)


@dataclass(frozen=True)
class Record:
    index: int
    offset: int
    name_raw: str
    name: str
    metadata: tuple[int, ...]
    ratings: tuple[int, ...]
    final_field: int


def decode_name(raw: bytes) -> str:
    """Decode the fixed 13-byte display-name field observed in the table."""
    return (
        raw.decode("ascii", errors="replace")
        .rstrip("@\x00 ")
        .replace("@", " ")
        .replace("[", ".")
    )


def verify_proofs(
    data: bytes, proofs: tuple[Proof, ...] | None = None
) -> list[dict[str, Any]]:
    evidence: list[dict[str, Any]] = []
    for name, offset, length, expected_sha256 in proofs or PROOFS:
        actual = data[offset : offset + length]
        actual_sha256 = hashlib.sha256(actual).hexdigest()
        if actual_sha256 != expected_sha256:
            raise ValueError(
                f"proof {name} failed at 0x{offset:06X}: "
                f"expected SHA-256 {expected_sha256}, got {actual_sha256}"
            )
        evidence.append(
            {
                "name": name,
                "offset": offset,
                "offset_hex": f"0x{offset:06X}",
                "length": length,
                "sha256": actual_sha256,
                "status": "MATCH",
            }
        )
    return evidence


def extract(
    data: bytes,
    *,
    require_canonical_hash: bool = True,
    proofs: tuple[Proof, ...] | None = None,
) -> dict[str, Any]:
    minimum = LADDER_START + LADDER_COUNT * 3
    if len(data) < minimum:
        raise ValueError(f"ROM is too short: need at least 0x{minimum:X} bytes")

    sha256 = hashlib.sha256(data).hexdigest()
    if require_canonical_hash and sha256 != CANONICAL_SHA256:
        raise ValueError(f"unexpected ROM SHA-256: {sha256}")

    proof_results = verify_proofs(data, proofs)

    records: list[Record] = []
    for index in range(RECORD_COUNT):
        offset = ROSTER_START + index * RECORD_SIZE
        block = data[offset : offset + RECORD_SIZE]
        name_bytes = block[:13]
        fields = block[13:]
        records.append(
            Record(
                index=index,
                offset=offset,
                name_raw=name_bytes.decode("ascii", errors="replace"),
                name=decode_name(name_bytes),
                metadata=tuple(fields[:5]),
                ratings=tuple(fields[5:9]),
                final_field=fields[9],
            )
        )

    ids = list(data[LADDER_START : LADDER_START + LADDER_COUNT])
    wins = list(data[LADDER_START + LADDER_COUNT : LADDER_START + LADDER_COUNT * 2])
    losses = list(data[LADDER_START + LADDER_COUNT * 2 : LADDER_START + LADDER_COUNT * 3])

    if len(set(ids)) != LADDER_COUNT:
        raise ValueError("initial ladder IDs are not unique")
    if not all(4 <= value < 4 + RECORD_COUNT for value in ids):
        raise ValueError("initial ladder contains an ID outside the factory-record range")

    active_indices = [value - 4 for value in ids]
    active_set = set(active_indices)
    reserve_indices = [i for i in range(RECORD_COUNT) if i not in active_set]

    private_records = [
        {
            "record_index": r.index,
            "rom_offset": r.offset,
            "rom_offset_hex": f"0x{r.offset:06X}",
            "name_raw": r.name_raw,
            "name": r.name,
            "metadata_bytes": list(r.metadata),
            "rating_bytes": list(r.ratings),
            "final_field": r.final_field,
        }
        for r in records
    ]

    ladder = []
    for rank, (internal_id, win_count, loss_count) in enumerate(
        zip(ids, wins, losses), start=1
    ):
        record = records[internal_id - 4]
        ladder.append(
            {
                "rank": rank,
                "internal_fighter_id": internal_id,
                "internal_fighter_id_hex": f"0x{internal_id:02X}",
                "factory_record_index": record.index,
                "factory_record_offset_hex": f"0x{record.offset:06X}",
                "name": record.name,
                "wins": win_count,
                "losses": loss_count,
                "total_bouts": win_count + loss_count,
            }
        )

    return {
        "schema": "ehrdb-private-roster-ladder-v1",
        "source": {
            "size_bytes": len(data),
            "sha256": sha256,
            "canonical_hash_match": sha256 == CANONICAL_SHA256,
        },
        "proofs": proof_results,
        "structure": {
            "factory_roster": {
                "start": ROSTER_START,
                "start_hex": f"0x{ROSTER_START:06X}",
                "end_exclusive": ROSTER_START + RECORD_SIZE * RECORD_COUNT,
                "end_exclusive_hex": f"0x{ROSTER_START + RECORD_SIZE * RECORD_COUNT:06X}",
                "record_size": RECORD_SIZE,
                "record_count": RECORD_COUNT,
                "name_bytes": 13,
                "metadata_bytes": 5,
                "rating_bytes": 4,
                "final_bytes": 1,
            },
            "initial_ladder": {
                "start": LADDER_START,
                "start_hex": f"0x{LADDER_START:06X}",
                "rank_count": LADDER_COUNT,
                "layout": [
                    {"name": "internal_ids", "offset": LADDER_START, "count": LADDER_COUNT},
                    {"name": "wins", "offset": LADDER_START + LADDER_COUNT, "count": LADDER_COUNT},
                    {"name": "losses", "offset": LADDER_START + LADDER_COUNT * 2, "count": LADDER_COUNT},
                ],
                "ram_destination_hex": "0xFFF928",
            },
            "created_fighter_slots": {
                "internal_ids": [0, 1, 2, 3],
                "ram_base_hex": "0xFFF89E",
                "record_size": 0x22,
                "semantic_limit": "Code dispatch is verified; player-facing slot meaning remains unresolved.",
            },
        },
        "records": private_records,
        "initial_ladder": ladder,
        "reserve": [
            {
                "factory_record_index": i,
                "internal_id_candidate": i + 4,
                "name": records[i].name,
            }
            for i in reserve_indices
        ],
        "semantic_limits": {
            "metadata_bytes": "unresolved",
            "rating_order": "four rating bytes verified; manual-order mapping not yet proven",
            "final_field": "unresolved three-value field",
            "reserve_use": "inactive at bootstrap; later replacement behavior remains inferred",
            "wins_losses": "supported by paired total-bout use and the champion 27-0 row",
        },
    }


def write_outputs(result: dict[str, Any], out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "PRIVATE_ROSTER_LADDER.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8"
    )

    with (out / "PRIVATE_FACTORY_ROSTER.tsv").open("w", newline="", encoding="utf-8") as handle:
        fields = [
            "record_index",
            "rom_offset_hex",
            "name",
            "name_raw",
            "metadata_bytes",
            "rating_bytes",
            "final_field",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        for row in result["records"]:
            writer.writerow(
                {
                    **row,
                    "metadata_bytes": " ".join(f"{v:02X}" for v in row["metadata_bytes"]),
                    "rating_bytes": " ".join(f"{v:02X}" for v in row["rating_bytes"]),
                }
            )

    with (out / "PRIVATE_INITIAL_LADDER.tsv").open("w", newline="", encoding="utf-8") as handle:
        fields = [
            "rank",
            "internal_fighter_id_hex",
            "factory_record_index",
            "factory_record_offset_hex",
            "name",
            "wins",
            "losses",
            "total_bouts",
        ]
        writer = csv.DictWriter(handle, fieldnames=fields, delimiter="\t", extrasaction="ignore")
        writer.writeheader()
        writer.writerows(result["initial_ladder"])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("rom", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--allow-noncanonical", action="store_true")
    args = parser.parse_args()

    result = extract(
        args.rom.read_bytes(), require_canonical_hash=not args.allow_noncanonical
    )
    write_outputs(result, args.out)
    print(
        json.dumps(
            {
                "output": str(args.out),
                "factory_records": len(result["records"]),
                "initial_ladder": len(result["initial_ladder"]),
                "reserve": len(result["reserve"]),
                "sha256": result["source"]["sha256"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
