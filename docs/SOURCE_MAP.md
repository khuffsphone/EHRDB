# Source Map

How each material rule is grounded. Labels as required by the brief:

- **VERIFIED_SOURCE** — stated in a readable source (here: the research report,
  which itself cites the original manual).
- **MEASURED** — measured by this project's own instrumentation.
- **INFERRED** — reasoned from a source, not stated by it.
- **DESIGN_DECISION** — chosen for this product.

**No rule in this project is labelled MEASURED against the original game.** The
ROM was deliberately not retrieved (D-002), so no original frame data, hitbox
geometry, damage formula or scoring weight was measured. Everything measured
here was measured against *this* simulation.

| Rule | Label | Grounding |
|---|---|---|
| Layered damage: immediate energy, long-term capacity, localised head/body damage | VERIFIED_SOURCE | Research report §6.4, citing the original manual's HUD description |
| Immediate energy recovers only within remaining capacity | VERIFIED_SOURCE | Research report §6.4 |
| Capacity partially recovers between rounds | VERIFIED_SOURCE | Research report §6.4 |
| A fully-greyed region can produce a technical knockout | VERIFIED_SOURCE | Research report §6.4 |
| Energy at zero causes a knockdown | VERIFIED_SOURCE | Research report Appendix A.2 |
| Three knockdowns in a round is a technical knockout | VERIFIED_SOURCE | Research report Appendix A.2 |
| Punch vocabulary: jab, hook, uppercut per hand, plus body variants | VERIFIED_SOURCE | Research report §6.2 |
| Jabs work at distance; hooks and uppercuts inside | VERIFIED_SOURCE | Research report §6.2 |
| Distance buys recovery when hurt | VERIFIED_SOURCE | Research report §6.2 |
| Beating a higher-ranked fighter exchanges ranks | VERIFIED_SOURCE | Research report §9.2 |
| Losing to a lower-ranked fighter exchanges ranks | VERIFIED_SOURCE | Research report §9.2 |
| Bout length grows with rank; minimum three rounds | VERIFIED_SOURCE | Research report §6.1 |
| Training is awarded after bouts, never bought | VERIFIED_SOURCE | Research report §9.3 |
| Three training choices on a win, fewer on a loss | VERIFIED_SOURCE | Research report Appendix A.1 |
| Purses are a career score, not a spendable economy | VERIFIED_SOURCE | Research report §9.3 |
| Ageing produces irreversible decline | VERIFIED_SOURCE | Research report §9.7 |
| Consecutive losses force retirement | VERIFIED_SOURCE | Research report §9.8 |
| High-ranked fighters receive challenges from below; refusing costs rank | VERIFIED_SOURCE | Research report §9.9 |
| A cumulative-earnings record persists across careers | VERIFIED_SOURCE | Research report §9.11 |
| Side-on view with full-ring positioning in depth | VERIFIED_SOURCE | Research report §5.5 |
| Three-layer AI: plan, utility, motor | INFERRED | Research report §8.4 recommends it; not a claim about the original |
| AI perception delay and noise model | INFERRED | Research report §8.5 |
| Archetype set and counterplay matrix | INFERRED | Research report §8.6 |
| Every punch's frame data (startup/active/recovery) | DESIGN_DECISION | Original to this project; tuned via `npm run soak` |
| Every punch's reach, damage, stagger and score value | DESIGN_DECISION | Original; the report's example values are explicitly illustrative |
| Composure/resilience/trauma/exertion rates | DESIGN_DECISION | Original; tuned against the mirror soak |
| Combo damage scaling | DESIGN_DECISION | D-014 |
| Balance loss scaling with accumulated damage | DESIGN_DECISION | D-015 |
| Accuracy model and evasion | DESIGN_DECISION | Original; the report gives no hit formula |
| Ten-point-must judging with three weighted judges | DESIGN_DECISION | The report explicitly warns the original's scoring is unknown (§6.8) |
| Twenty-bout career, decline from bout 12 | DESIGN_DECISION | D-004; the brief overrides the report's 40 |
| Purse table by rank | DESIGN_DECISION | Original |
| Nineteen-item training catalogue and its effects | DESIGN_DECISION | Item count matches the report; every name and effect is original |
| One-time career rebuild | DESIGN_DECISION | D-012 |
| 90-second default round | DESIGN_DECISION | D-005 |
| Archetype win rates 40–60% with ratings held equal | MEASURED | `npm run soak -- --mirror --bouts 200` |
| ~35% clean-landing accuracy | MEASURED | Same |
| Outcome mix ~32% KO / ~3% TKO / ~57% decision / ~8% draw | MEASURED | Same |
| Mean 5.2 of 6.3 scheduled rounds | MEASURED | Same |
| Careers reach a title shot in 15/16 runs | MEASURED | `npm run career:sim -- --careers 16` |
| Zero console errors across a full career flow | MEASURED | `npm run qa:smoke` |
| Bundle size 1.65 MB raw / 395 kB gzipped | MEASURED | `npm run build` |
