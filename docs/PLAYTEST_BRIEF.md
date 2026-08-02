# Playtest Brief

**Build:** see `dist/build-manifest.json` in the candidate. Every claim below is
about that exact artifact; if the manifest says `"ci": "local"` this is not a
candidate and should not be used for a session.

This document exists because automated evidence has a hard ceiling. `npm run
verify` establishes that the simulation is not broken, that the balance targets
hold at a sample size that can support them, and that the build is traceable to
its source. It establishes nothing whatsoever about whether the game is
comprehensible or enjoyable, and it never will.

What follows is the list of questions this project cannot answer from inside
itself.

---

## How to use this

The evaluator does not coach. If a tester is stuck, that is the finding — write
down what they tried, not what they should have tried. Record the session with
consent. Think-aloud is more useful than a survey afterwards, because the
useful information is what confused them *at the moment it confused them*, which
they will have rationalised away by the end.

Return findings as defects, not preferences. "The jab feels weak" is not
actionable against a deterministic simulation. "I threw six jabs at what looked
like the right distance and none of them landed, and I could not tell why" is.

---

## Questions automation cannot answer

### Control feel

1. Does the fighter go where the player expects when they press a direction?
   Left/right are screen-space and get converted to facing-relative; the
   conversion is correct, but nobody has confirmed it is *intuitive*.
2. Is the punch's response to a button press perceptibly immediate? The
   simulation acknowledges on the next tick; whether that reads as immediate is
   a human question.
3. Does the input buffer help or surprise? A punch requested during commitment
   fires on release. Testers should be asked whether follow-ups ever felt like
   something they did not ask for.
4. Six punches live on four face buttons plus an uppercut modifier. Is that
   discoverable, or does it read as four punches and a mystery?

### Readability under pressure

5. Can the player tell head guard from body guard on their opponent, mid-
   exchange, without pausing?
6. When a punch misses, can the player tell *why* — out of range, wrong level,
   slipped, or blocked? The simulation distinguishes all four. The presentation
   may not.
7. Is the vulnerability window after a committed punch visible as an
   opportunity, or does a successful counter feel like the opponent got lucky?
8. Do the four damage channels (composure, resilience, head/body trauma,
   exertion) read as four different things on the HUD, or as four bars?

### Comprehension

9. After one fight, can the player explain what head/body defence does?
10. After one fight, can the player explain what stamina costs them?
11. Can the player say why they won or lost, in their own words, without being
    shown the scorecards?
12. Does a loss produce a specific idea about what to do differently, or does it
    feel arbitrary?

### Onboarding

13. How long until the first controlled movement, the first intentional punch,
    the first successful defence, and the first completed bout? The target is a
    first meaningful fight within three minutes.
14. Does anyone read the controls screen? Does anyone need to?
15. Is the boxer-creation screen a meaningful choice or a form to get through?
    The style choice is mechanically real; whether it feels real is unknown.

### Career

16. Does the opponent card give enough information to make the choice feel like
    a decision rather than a guess?
17. Is the training draft interesting, or is there an obviously correct pick?
    Diminishing returns and wear are modelled, but a dominant strategy would not
    show up in any automated gate.
18. Does the rank exchange feel earned?
19. **Does the decline phase land as poignant or merely punishing?** Ageing
    starts at bout 12 and the career is capped at 20. This is the single design
    decision least defensible from automation, and the one most likely to be
    wrong.
20. When told the session may end, does the player choose to start another bout?

### Accessibility

21. Do the three knockdown-recovery modes (tap, hold, automatic) feel equivalent
    in difficulty? They resolve against the same recovery model by construction,
    but "equivalent by construction" is not "equivalent to play".
22. With reduced motion on, is hit feedback still legible?
23. With colour-safe mode on, is every colour-coded state still distinguishable?
24. Can every screen be completed with a gamepad alone? **No physical controller
    has ever been connected to this build** — the code path is implemented and
    reachable, and that is all anyone can currently say about it.

---

## Known limitations, stated before anyone finds them

- **No physical gamepad has been tested.** No controller exists in the build
  environment. Treat gamepad support as unverified, not as working.
- **The art is geometric.** This is a deliberate trade for complete provenance
  (D-016), and it is also under-invested: single-pose keyframes with linear
  blending, no secondary motion, no anticipation or follow-through frames, flat
  lighting, no impact deformation. Testers will notice. The planned response is
  to raise the generator's ceiling, not to buy art.
- **Draw rate is about 8%**, against 2–4% in real boxing (D-017).
- **Individual archetype matchups are lopsided** even though every archetype's
  overall win rate is inside the documented band. Partly real, partly sampling —
  no automated gate asserts the matchup matrix.
- **Presentation has had no dedicated pass.** Camera behaviour, impact feedback,
  hit pause tuning and audio layering are all first-draft.

---

## What this build *can* prove without a tester

So the session does not spend time re-establishing it:

| Claim | Evidence |
|---|---|
| Same seed and inputs reproduce the same bout, exactly | `tests/sim/replay.test.ts` against a committed fixture |
| The AI cannot see anything a player could not | `tests/ai/fairness.test.ts` |
| Every archetype wins 40–60% with ratings held equal | `npm run balance:certify`, 1200 bouts, three seeds |
| A career can be created, played, saved, reloaded and completed | `npm run qa:smoke` and 12 headless careers |
| Corrupt saves are quarantined, never silently deleted | `tests/save/validate.test.ts` |
| Nothing in the bundle has unknown provenance | `npm run release:audit` |

None of these are reasons to believe the game is good. They are reasons to
believe that what a tester experiences is what the build actually does, and that
any defect they report can be reproduced from the seed.
