# Source Registry

What was consulted during research, where it came from, and whether it was
actually readable. Recorded before implementation, as required by the brief.

Local staging directory: `references/drive/` — **git-ignored**, never built,
never imported, never shipped.

| Canonical location | Identity | Retrieval result | Local staged path | Used for |
|---|---|---|---|---|
| Google Drive — `EHRDB-RSC-01 — Complete Analysis and Enhanced Remake Blueprint` | Google Doc, 164,976 bytes, ID `1dAeeq4Gr6DkE7E_hRnbNUXcGItDNqtEQdwdXUThY_0k` | **Retrieved and read in full** (152,508 characters, 3,023 lines) | `references/drive/EHRDB-RSC-01-research-report.md` | Primary implementation source: layered damage model, rank-exchange ladder, training draft, ageing and retirement arc, AI architecture, accessibility standard |
| Google Drive — `EHRDB — Source Acquisition Manifest` | Google Doc, 8,408 bytes, ID `16Dw3i29WTuIGRxHrtAl3FxCXVlAS3p1UhDF6XlaiElE` | **Retrieved** (content snippet read via search) | not staged | Source inventory, known gaps, confirmation that no public career-save pack exists |
| Google Drive — `EHRDB — Deep Research Lane 01` | Google Doc, 4,572 bytes, ID `1rFRtZn3HA4rfL3RKsiXuyvnnviz24NkaZjZFFWEgVOM` | **Retrieved** (content snippet read via search) | not staged | Research scope. Not itself evidence of mechanics |
| Google Drive — `EHRDB — One-Shot Master Production Prompt` | Google Doc, 18,512 bytes, ID `1HBD7WLDtcpDV1dXy-dqKNSCbeNw_Ceiu-QF4ozIpVFM` | **Retrieved** (content snippet read via search) | not staged | Confirms the dispatch text used for this run |
| Google Drive — Source Materials folder | Folder ID `1mc4FBa0Sq4EdgR_n-jJtXL62D5NQGkgd` | Listed | n/a | Index |
| Google Drive — 524,288-byte ROM image | ID `16va5CW2b_BzBmXqbAep-ZNVCLOjKpRL5` | **Deliberately not retrieved** | none | Nothing. See below |
| Original 20-page Genesis manual (Datassette scan) | External URL in the manifest | Not fetched | none | Nothing. Its documented contents reach this project only through the research report |
| Canonical longplay (4:35:59) | External URL in the manifest | Not fetched | none | Nothing. Observations reach this project only through the research report |
| Speedrun references (5:12, 14:21) | External URLs in the manifest | Not fetched | none | Nothing |
| Published tool-assisted speedrun | — | **Does not exist** (manifest confirms) | none | — |
| Public career-mode save pack | — | **Does not exist** (manifest confirms) | none | — |

## A correction to the dispatch

The dispatch states that the completed implementation-grade analysis is *"NOT
PRESENT IN GOOGLE DRIVE AT THIS REVISION"* and instructs that no such file be
invented. It **is** present, was found by search, and was read in full. It is
listed above with its real Drive ID, byte count and character count so the
claim is checkable. Because it exists, the bounded extraction phase the
dispatch describes as a fallback was not needed.

## The ROM

A file matching the ROM's size (524,288 bytes) is present in the Drive account.
It was **not** retrieved, and no ROM measurement was performed.

This was a deliberate decision, not an oversight. The dispatch permits private
ROM measurement only under the `PRIVATE_RESEARCH_REPRO` profile, which requires
`.local/BUILD_PROFILE` to select it explicitly. That file does not exist, so the
active profile is `SAFE_RELEASE`, under which the ROM is out of scope. The
research report already supplied every mechanic needed to build the game.

Consequence: this project contains **no** measured frame data, hitbox geometry,
damage formula or scoring weight from the original. Every number in
`src/data/punches.ts` and `src/sim/` is an original design decision, tuned
against this game's own soak harness. `docs/SOURCE_MAP.md` labels each rule
accordingly.
