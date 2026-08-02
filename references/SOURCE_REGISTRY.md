# Source Registry

What was consulted during research, where it came from, and whether it was
actually readable. Recorded before implementation and updated when the private
ROM research lane was explicitly opened.

Local staging directories:

- `references/drive/` — readable Drive exports, git-ignored.
- `references/private-rom/` — operator-supplied private cartridge files, git-ignored.
- `artifacts/private-repro/` — generated ROM research output, git-ignored.

None of those paths may be imported by `src/`, bundled, deployed, or committed.

| Canonical location | Identity | Retrieval result | Local staged path | Used for |
|---|---|---|---|---|
| Google Drive — `EHRDB-RSC-01 — Complete Analysis and Enhanced Remake Blueprint` | Google Doc, ID `1dAeeq4Gr6DkE7E_hRnbNUXcGItDNqtEQdwdXUThY_0k` | **Retrieved and read in full** (152,508 characters, 3,023 lines in the implementation run) | `references/drive/EHRDB-RSC-01-research-report.md` | Primary implementation source: layered damage model, rank-exchange ladder, training draft, ageing and retirement arc, AI architecture, accessibility standard |
| Google Drive — `EHRDB — Source Acquisition Manifest` | Google Doc, ID `16Dw3i29WTuIGRxHrtAl3FxCXVlAS3p1UhDF6XlaiElE` | **Retrieved and read** | not staged | Source inventory, ROM identity leads, EEPROM hardware finding, known gaps |
| Google Drive — `EHRDB — Deep Research Lane 01` | Google Doc, ID `1rFRtZn3HA4rfL3RKsiXuyvnnviz24NkaZjZFFWEgVOM` | **Retrieved** | not staged | Research scope. Not itself evidence of mechanics |
| Google Drive — `EHRDB — One-Shot Master Production Prompt` | Google Doc, ID `1HBD7WLDtcpDV1dXy-dqKNSCbeNw_Ceiu-QF4ozIpVFM` | **Retrieved** | not staged | Dispatch and build-profile rules |
| Google Drive — Source Materials folder | Folder ID `1mc4FBa0Sq4EdgR_n-jJtXL62D5NQGkgd` | Listed | n/a | Canonical project index |
| Google Drive — `Evander Holyfield's 'Real Deal' Boxing (World).md` | 524,288-byte cartridge image, ID `16va5CW2b_BzBmXqbAep-ZNVCLOjKpRL5` | **Retrieved into a private orchestration workspace and verified; never committed** | operator/private workspace; expected repository location `references/private-rom/` when reproduced | Static ROM-01 measurements only: hashes, header, vectors, bootstrap boundary, coarse content boundaries |
| Original 20-page Genesis manual (Datassette scan) | External URL in the manifest | Not fetched by the implementation run | none | Documented contents reach the project through the research report |
| Canonical longplay (4:35:59) | External URL in the manifest | Not fetched by the implementation run | none | Observations reach the project through the research report |
| Speedrun references (5:12, 14:21) | External URLs in the manifest | Not fetched by the implementation run | none | Optimization leads only |
| Published tool-assisted speedrun | — | **Does not exist in the searched principal archive** | none | — |
| Public career-mode save pack | — | **No trustworthy staged pack found** | none | ROM-06 must generate controlled saves |

## Research-report correction

The original dispatch stated that the completed implementation-grade analysis
was not present in Drive. It was present, was found by search, and was read in
full. Its real Drive identity is listed above. The production implementation
used that report rather than inventing missing findings.

## ROM retrieval update — 2026-08-02

The initial `SAFE_RELEASE` implementation deliberately did not retrieve the ROM.
After the user explicitly opened a private reverse-engineering lane, ROM-01
retrieved the canonical Drive file into an isolated orchestration workspace and
verified:

- size: `524288` bytes;
- MD5: `91f8f3ef27055687a12015b0123cc067`;
- SHA-1: `eb4aca22f8b5837a0a0b10491c46714948b09844`;
- SHA-256: `b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880`;
- product field: `GM MK-1215 -00`;
- header checksum: `0x760F`, independently recomputed and matching;
- declared save address: `0x00200001`.

This does not change the release profile. The public repository receives only a
reproducible inspector, non-expressive cartridge measurements, confidence
labels, and parity documentation. The ROM, extracted pixels, audio, text dumps,
saves and diagnostic atlases remain private and ignored.

Consequence: the project now has **MEASURED original-cartridge metadata**, but
still has no ROM-verified combat frame data, hitbox geometry, damage formula,
scoring weight, AI state graph, career table, or EEPROM field layout. Every
current gameplay constant remains an original `TEN COUNT` design decision until
a later lane supplies reproducible evidence.
