# Findings From the Reference Work

What the research established about the historical game, what the private ROM
lane has since measured, and what this project took from it. This is a
design-reference document; none of the historical work's expression ships.

## Method and limits

The primary implementation-grade source was the completed research report
(`references/SOURCE_REGISTRY.md`). It labels claims as documented, observed,
inferred, recommended, unresolved, or estimated and explicitly states that no
verified ROM was supplied to that research lane. The initial production build
therefore made no claim about frame data, hitbox geometry, damage formulas,
scoring weights or random-number behaviour.

After the initial implementation, the user explicitly opened a private ROM
research lane. ROM-01 retrieved and verified the cartridge in an isolated,
ignored workspace. That lane closes static cartridge facts only: binary
identity, header fields, checksum, vector destinations, save-address declaration,
bootstrap handoff, and one raw-graphics candidate region. See
`docs/rom/ROM_ATLAS_00_HEADER.md` and `docs/rom/ROM_METADATA.json`.

It does **not** retroactively authenticate any current combat number. Every
punch timing, range, damage value, scoring weight, AI parameter and career table
in the release remains an original design decision unless a later ROM lane
produces a reproducible offset, extraction method, or runtime measurement.

## ROM-01 facts now measured

- 524,288-byte cartridge image; declared ROM range `0x00000000–0x0007FFFF`.
- MD5 `91f8f3ef27055687a12015b0123cc067` and SHA-256
  `b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880`.
- Product field `GM MK-1215 -00`, region `U`, header checksum `0x760F` with an
  exact independent checksum match.
- Reset vector `0x00000200`; the bounded bootstrap transfers to `0x00001710`.
- Save signature/flags `RA`/`E840`, with start and end both `0x00200001`,
  consistent with the acquisition manifest's X24C01/24C01 finding.
- A 22,366-byte `0xFF` fill precedes a 14,336-byte, 448-tile candidate raw 4bpp
  graphics bank at `0x07C800–0x07FFFF`.

## The five ideas worth preserving

The report identifies the original's identity as coming from the interaction of
five unusual systems rather than from roster, presentation or controls:

1. A side-on fight view paired with genuine full-ring positioning in depth.
2. Independent short-term knockdown energy, long-term punch resistance, and
   localised head/body stoppage damage.
3. An open challenge ladder where beating a higher-ranked fighter exchanges
   ranks.
4. Post-fight training choices, ageing and mandatory retirement inside a finite
   career.
5. A persistent cumulative-earnings record that outlives the boxer.

All five are implemented. They are the spine of `docs/COMBAT_SPEC.md` and
`docs/CAREER_SPEC.md`.

## What the manual established through the report

- Three-minute rounds; a bell; between-round statistics; partial recovery.
- Career bout length scales with ranking, minimum three rounds.
- Left and right jab, hook and uppercut, plus body versions from a crouch.
- Blocking is a dedicated action; ducking avoids punches.
- Red immediate energy recovers when not being hit, capped by remaining black
  capacity; black capacity shrinks with punishment and partly returns between
  rounds; head and body indicators grey and flash near a stoppage.
- Energy at zero is a knockdown; three in a round is a technical knockout.
- Get-up is rapid taps plus a prompted press; failure is a knockout.
- Round statistics: thrown, connected, percentage, and a score.
- Nineteen training items, each improving one or more of four attributes.
- Three choices after a first win, two after a first loss.
- More than three consecutive losses can force retirement.
- Ageing begins around 25 fights; every career ends at 40 bouts.
- Ranked fighters receive challenges from one to four ranks below; refusing
  drops the player to the challenger's position.

## What remains unresolved after ROM-01

Scoring weights, judge count, round aggregation and tie resolution. Hitbox
geometry and damage formulas. AI decision rules, reaction times, and whether
the original rubber-bands. Whether the training slate is random, rank-gated or
seeded. Exact rank, age, purse and training tables. Animation timing. Palette,
metasprite and audio-bank mapping. EEPROM logical fields, slot checksum and
corruption behaviour.

Everywhere the original is unknown, this project keeps the existing documented
design decision instead of guessing and presenting the guess as fact.

## What was changed on purpose

| Original behaviour | Here | Why |
|---|---|---|
| 40-bout career, ageing from 25 | 20 bouts, decline from 12 | Brief's hard scope (D-004) |
| Thirty-position ecosystem | Eight ranked fighters plus player | Focused one-shot content scope |
| Three-minute rounds | 90 s default, 180 s available | Sitting length (D-005) |
| Rapid-tap get-up | Passive progress plus optional taps, cadence-capped, three modes | Accessibility (D-009) |
| Opaque energy bars | Named bars with captions, hatching and a durability notch | Readability |
| Unknown scoring | Transparent ten-point-must with three weighted judges | Original model still unresolved (D-010) |
| Attribute-only fighter differences | Explicit archetypes with distinct goals | Reception faulted the original AI as robotic |
| A loss spiral that ends the campaign | One documented rebuild before bout 12 | Brief requires recoverable failure (D-012) |
