# Findings From the Reference Work

What the research established about the historical game, and what this project
took from it. This is a design-reference document; none of it is shipped
expression.

## Method and limits

The single readable implementation-grade source was the completed research
report (`references/SOURCE_REGISTRY.md`). It labels its own claims as
documented, observed, inferred, or unresolved, and explicitly states that **no
verified ROM was supplied to that research lane** — so it makes no claim about
frame data, hitbox geometry, damage formulas, scoring weights or random-number
behaviour.

This project did not close those gaps either: the ROM was deliberately not
retrieved (D-002). Every combat number here is therefore an original design
decision rather than a reconstruction. `docs/SOURCE_MAP.md` labels each rule.

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

## What the manual established (via the report)

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

## What the report deliberately does not establish

Scoring weights, judge count, round aggregation and tie resolution. Hitbox
geometry and damage formulas. AI decision rules, reaction times, and whether
the original rubber-bands. Whether the training slate is random, rank-gated or
seeded. The exact interaction between the loss-streak rules and ageing.

Everywhere the original is unknown, this project made a documented design
decision instead of guessing and presenting the guess as fact.

## What was changed on purpose

| Original behaviour | Here | Why |
|---|---|---|
| 40-bout career, ageing from 25 | 20 bouts, decline from 12 | Brief's hard scope (D-004) |
| Three-minute rounds | 90 s default, 180 s available | Sitting length (D-005) |
| Rapid-tap get-up | Passive progress plus optional taps, cadence-capped, three modes | Accessibility (D-009) |
| Opaque energy bars | Named bars with captions, hatching and a durability notch | Readability |
| Unknown scoring | Transparent ten-point-must with three weighted judges | The original's model is unknowable (D-010) |
| Attribute-only fighter differences | Explicit archetypes with distinct goals | Reception faulted the original AI as robotic |
| A loss spiral that ends the campaign | One documented rebuild before bout 12 | Brief requires recoverable failure (D-012) |
