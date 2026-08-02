# EHRDB PARITY-00 — Original ROM versus TEN COUNT

> Baseline repository: `khuffsphone/EHRDB` at `6ce097ef0425aa468130e5c1de66f01b9352eaf7`.
>
> This is a traceability audit, not a demand that the release product copy protected expression. `TEN COUNT` remains the `SAFE_RELEASE` spiritual successor. ROM-derived binaries, pixels, audio, text dumps, and data dumps remain private and outside the production bundle.

## Executive finding

The repository is not an empty prototype. It already contains a deterministic 60 Hz boxing simulation, ranked career, training, ageing, save/replay support, five AI archetypes, nineteen screens, CI, and 167 tests. Its strongest parity is **system topology**: layered damage, rank exchange, free post-fight training, decline/retirement, and purse-as-legacy all follow the original research. Its weakest parity is **content scale and original-mode coverage**: the current product deliberately compresses the 30-position/40-bout structure to eight ranked fighters/20 bouts and omits the original's documented two-career interoperability, local two-player exhibition, and CPU-versus-CPU from the settled mode list.

## Status vocabulary

- **PRESERVED** — the original's identity-bearing structure exists in the repository.
- **REDESIGNED** — the same problem is solved differently on purpose.
- **PARTIAL** — related functionality exists, but original scope or semantics are incomplete.
- **UNVERIFIED** — the repository uses original design values because ROM behavior is not yet measured.
- **ROM-CLOSED** — ROM-01 has now directly verified a previously unresolved cartridge fact.

## Initial matrix

| Area | Original evidence | Current repository | Status | Consequence |
|---|---|---|---|---|
| Binary identity | 512 KiB World/US-compatible ROM, `GM MK-1215 -00`, region `U`, checksum `0x760F` | Previously listed as deliberately unread | **ROM-CLOSED** | Source registry and findings must be updated; production code is unaffected. |
| Save hardware | Header declares `RA`, flags `E840`, address `0x00200001`; manifest maps MK-1215 to X24C01/24C01 serial EEPROM | Versioned browser save with migrations, validation, backup and export | **REDESIGNED** | Persistence goals align; formats are intentionally not binary-compatible. EEPROM field mapping remains ROM-06 work. |
| Fight space | Side-on readability plus full-ring position/depth and overhead locator | Deterministic 320×176 ring interior rendered at 640×360, free movement in two axes | **PRESERVED / PARTIAL** | Core spatial premise is present. Locator/camera presentation still needs direct screen-by-screen parity review. |
| Damage model | Immediate energy, recoverable ceiling, localized head/body stoppage risk | Composure, durability, head/body trauma and stamina are separate | **PRESERVED + ENHANCED** | This is the strongest mechanical inheritance. Stamina/exertion is a modern addition. |
| Knockdown/stoppage | Energy zero causes knockdown; three knockdowns in a round causes TKO; localized damage can stop a fight | KO, TKO, durability/trauma and configurable recovery are implemented | **PRESERVED / REDESIGNED** | Recovery interaction is accessibility-driven rather than a forced rapid-mash copy. Exact thresholds are still original design values. |
| Punch vocabulary | Left/right jab, hook and uppercut, with body versions from crouch | Jab, cross, lead/rear hook and lead/rear uppercut; every punch has a body variant | **PARTIAL / REDESIGNED** | Breadth is comparable, but nomenclature and direct mappings differ. Startup/reach/damage values are not ROM-derived. |
| Defensive vocabulary | Block, duck/crouch, movement; original clinch behavior requires further measurement | High/body guard, crouch, slip and dedicated clinch | **ENHANCED / UNVERIFIED** | Modern defense is richer. Direct clinch/slip behavior must not be described as original parity. |
| Scoring | Round score/statistics are documented; hidden weights and tie rules unresolved | Transparent three-judge ten-point-must system | **REDESIGNED** | Correctly labeled a design decision; ROM-05 must locate/measure original scoring before any authenticity mode is claimed. |
| Ladder | Thirty-position ecosystem; beating a higher-ranked boxer exchanges ranks; challenge/refusal pressure | Eight ranked fictional fighters plus player; rank exchange remains the core progression rule | **PRESERVED / COMPRESSED** | Topology survives, population depth does not. Expansion requires data/content, not a new progression architecture. |
| Career length | Ageing begins near fight 25; mandatory retirement by fight 40 | Decline begins at bout 12; retirement by bout 20 | **REDESIGNED** | Explicit scope compression, already documented. Authentic Career would need a separate 40-bout ruleset. |
| Training | Nineteen post-fight training items; choices awarded rather than purchased | Nineteen-item catalogue, free post-fight training | **PRESERVED / UNVERIFIED** | Count and economy align; names/effects are original until ROM tables are found. |
| Purses/legacy | Cumulative earnings are a record/legacy score, not a spendable upgrade currency | Purses feed legacy rather than purchases; Hall of Careers records outcomes | **PRESERVED** | Strong structural match without copying presentation. |
| Simultaneous careers | Two created careers can be retained and can eventually fight each other | Settled mode list includes Career, Exhibition, Training Lab, Hall, Settings, Controls and Credits | **MISSING FROM CANON** | This is an identity-bearing original feature not currently committed to scope. Add only as an explicit product decision. |
| Local/CPU exhibition | Manual/report document local two-player and CPU-versus-CPU | Product canon does not list either mode | **MISSING FROM CANON** | Core combat can likely support them, but UI/input/acceptance work is absent until proven. |
| AI | Original hidden decision rules and possible input reading remain unresolved | Three-layer AI with five authored archetypes and certified mirror-bout balance | **REDESIGNED / UNVERIFIED** | Current AI is measurable and production-ready, but it is not a reconstruction of original AI. |
| Presentation assets | Original ROM contains indexed Genesis graphics; ROM-01 confirms a 448-tile raw 4bpp tail candidate | Fighters and venues are procedural code art; audio is synthesized at runtime | **REDESIGNED** | Correct for `SAFE_RELEASE`. Private ROM atlases are research comparators only and must not enter the bundle. |
| Determinism/replay | Original RNG/seed lifecycle unresolved | Fixed 60 Hz simulation, seeded RNG, replay fixtures and future-complete state hashes | **ENHANCED** | Modern verification substantially exceeds what public evidence establishes for the original. |

## Immediate corrections to repository documentation

1. `references/SOURCE_REGISTRY.md` and `docs/ORIGINAL_GAME_FINDINGS.md` currently say the ROM was not retrieved. That was true for the initial production run and is now stale.
2. `docs/SOURCE_MAP.md` says no project rule is measured against the original. It must now distinguish **static cartridge measurements** from still-unmeasured gameplay behavior.
3. No combat constant should be relabeled as ROM-authentic merely because the cartridge is present. Frame data, hitboxes, damage, scoring, AI and career tables remain unresolved until a later lane produces reproducible evidence.

## Next parity gates

- **ROM-01B:** finish bootstrap/function boundary map and identify code versus data regions.
- **ROM-02:** locate palette/tile/tilemap/metasprite references; keep rendered extraction private.
- **ROM-03:** recover animation sequence tables and measure frame durations through emulator traces.
- **ROM-05:** identify fighter, training, rank, damage and scoring tables; compare against `src/data/` without changing release balance automatically.
- **ROM-06:** create controlled EEPROM snapshots and diff them to map career fields.
- **PARITY-01:** turn this qualitative matrix into executable assertions for the features that can be compared without shipping protected expression.
