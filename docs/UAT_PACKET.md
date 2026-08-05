# TEN COUNT — UAT packet

**For the Experience & Evidence lane (Cowork), and anyone else running acceptance
testing against this build.**

This is the symmetric half of what the unified playbook asks of Cowork: the
build, its identity, how to reproduce it, what it claims, and — stated up front
rather than discovered — where it is weak. A reviewer should not have to spend a
UAT session finding out what the author already knows.

---

## 1. Build identity

| | |
|---|---|
| Repository | `khuffsphone/EHRDB`, branch `claude/ehrdb-boxing-game-2i1zzq` |
| Commit | `1a7f8fd35eb49e831204ac477401bc06d3b7876c` (`1a7f8fd3`) |
| Pull request | #1, open, draft |
| Lockfile hash | `0a0ec05bf4965a76` |
| Toolchain | Node 22.22.2, npm 10.9.7, Vite 6.3.6, TypeScript 5.9.3, Phaser 3.90.0 |
| Release artifact hash | `sha256:806de52b0bf079c431df80af647a70295c6c744e10fcb261563ed30bd253a959` (over `dist/`, 3 files) |
| Playtest file | `ten-count-playtest.html`, 1,666,455 bytes |
| Playtest SHA-256 | `e9f90fead04914b44a2ba5a778cc4db24959273c190b8dec5e6c8452df3183dd` |
| Build profile | `SAFE_RELEASE` |

**The playtest file is not the release artifact.** The release build is
code-split and described by `dist/build-manifest.json`, which
`npm run release:audit` recomputes rather than trusts. The single-file build is
a convenience copy for getting the game in front of a person. Both are stamped
with the same commit, and the identity is visible in-game on the title screen
and in full on Credits — a single-file build that cannot say which release it
is was the defect recorded against HWC v1.1.0, and this does not repeat it.

## 2. How to run it

**Fastest — the hosted link.** One file, no install, no network.

**From the file.** Open `ten-count-playtest.html` in any browser, including from
`file://`. It makes zero network requests once loaded.

**From source, to verify the artifact rather than trust it:**

```bash
git clone <repo> && cd EHRDB
git checkout 1a7f8fd35eb49e831204ac477401bc06d3b7876c
npm ci
npm run verify          # every gate, ~6 min
npm run playtest:build  # regenerates the single file
```

The playtest file is not byte-reproducible across machines yet — `builtAt` is a
wall clock. The release bundle's `artifactHash` is the reproducible identity.
Cowork solved the timestamp problem by sourcing build time from the commit date;
that fix is portable here and is not yet applied. Recorded as a known gap rather
than claimed as done.

## 3. Controls

**Keyboard is required. There is no touch input.** The game renders correctly on
a phone — `Phaser.Scale.FIT` letterboxes a fixed 640×360 view — and cannot be
operated there. Do not assign a mobile-only tester.

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | `W` `A` `S` `D` | Left stick / D-pad |
| Jab | `J` | A |
| Cross | `K` | B |
| Lead hook | `U` | X |
| Rear hook | `I` | Y |
| Uppercut | `L` + hook | LB |
| Guard | `Space` | RB |
| Crouch / body level | `Left Shift` | LT |
| Slip | `H` | RT |
| Clinch | `O` | R3 |
| Confirm / Back | `Enter` / `Backspace` | A / B |
| Pause | `Escape` | Start |

Menu navigation is `W`/`S` or arrows, `Enter` to confirm. Everything is
remappable from Settings → Controls.

**The one rule that explains the combat:** crouch changes the *level* of every
punch, and a guard only protects the level it is held at. Head shots drop an
opponent; body shots drain them and set the head shot up.

## 4. Known weaknesses — do not spend UAT rediscovering these

Stated because a reviewer's time is better spent on what the author cannot see.

**Presentation is the weak half of this build, and measurably behind Heavyweight
Circuit.** Compared side by side at 1280×720 against HWC v1.1.1:

- **Internal resolution is 640×360, upscaled.** This is the root cause of much
  of the rest — every art decision is working inside a budget set early and
  never revisited, and 2× upscaling makes a constraint read as a style.
- **Ring geometry is flat.** A quad floor and straight rope lines, against HWC's
  perspective trapezoid with apron, skirt, rope sag and heavier posts.
- **Lighting is flat wedges**, not cones with falloff.
- **The crowd is a single silhouette band**, not a field with depth.
- **The HUD consumes the top quarter of the frame** in two boxes, where HWC
  carries the same information plus round pips in one compact bar.
- **No range affordance.** HWC draws an engagement-range ellipse on the canvas.
  Range is the whole game here and nothing communicates it.
- **Composition wastes frame.** The ring sits mid-frame with dead space above
  and below rather than filling it.

Other known gaps:

- No touch controls (§3).
- Gamepad-only operation has never been verified against a physical controller;
  no controller exists in the build environment.
- The replay fixture is exercised in Node and reproduces on a clean CI checkout.
  It is **not** verified across browsers.
- Crouch, slip and clinch exist here; HWC deliberately omits them. That is a
  difference in scope, not a defect on either side.

## 5. What this build does claim, and what enforces it

Every quantitative claim below is asserted by something that fails if it stops
being true. Anything not in this list should be treated as descriptive.

| Claim | Enforced by |
|---|---|
| 11/11 gates pass | `npm run verify` |
| 200 tests across 12 files | `tests/` — see the list below |
| Every archetype wins 40–60% at 1200 mirror bouts | `npm run balance:certify`, `tools/balance-targets.ts` |
| Accuracy 30–40%, mean rounds 4.4–5.6, stoppages 30–45% | same |
| Same seed + same commands ⇒ identical bout, byte for byte | `tests/sim/replay.test.ts` against a committed fixture |
| State identity covers everything affecting the future | completeness test perturbing every `FighterState` field |
| No phantom inputs at catch-up rates 1–60 | `tests/input/edges.test.ts`, both directions |
| The AI sees only `PublicBoutView` | structural — the type is the interface |
| No ROM, ROM-derived data or third-party asset ships | `npm run release:audit`, 11 controls in `tests/legal/` |
| Every tracked binary media file has a provenance row | `release:audit`, verified against a planted file |

Test files: `ai/fairness`, `ai/soak`, `career/career`, `content/content`,
`input/edges`, `legal/contamination`, `save/save`, `save/validate`, `sim/combat`,
`sim/determinism`, `sim/outcomes`, `sim/replay`.

Certified balance, 1200 mirror bouts, seeds 63000 / 88000 / 11111 — the last two
held out from tuning:

```
  archetype           win%   KO%   thrown  land%  head/body   KD+  KD-
  boxer_puncher      41.9%  14.9%     385  29.7%     90/10   27  166
  brawler            56.7%  97.1%     185  33.7%      98/2  278   53
  counterpuncher     43.5%  19.1%     266  39.9%      95/5   40  104
  out_boxer          46.9%   4.4%     366  32.9%      98/2    1   67
  pressure           50.0%  71.3%     235  34.8%     68/32  190  146
```

## 6. What UAT should actually answer

The five acceptance items no automation can close. These are the point of the
session; everything above exists so they are not confounded by a broken build.

1. Can a novice reach their first fight in **under three minutes**, unaided?
2. Do **four of five** novice testers complete a fight without coaching?
3. Afterwards, can they **explain** head/body guard, stamina, and counter
   vulnerability in their own words? (If they cannot, the systems are invisible,
   which is a design failure regardless of what the simulation does.)
4. Every screen operable by **gamepad alone** — needs a physical controller.
5. Combat-feel criticals from testers with fighting-game experience.

**Comparative questions, if you are testing both builds:**

- Which reads more clearly *at range* — can a player tell when they are in
  punching distance, and how?
- Which communicates damage state faster during an exchange?
- Which onboarding gets a novice throwing a deliberate body shot sooner?
- Where does each build's feedback on a landed punch differ, in ticks?

## 7. What would make the comparison usable, in return

The single highest-value thing this lane could receive: **presentation deltas as
tick-based timing targets and string keys**, not prose. "The camera feels better"
is not portable. "Camera lerp 0.18 → 0.24, hitstop 6 ticks not 4, copy key
`hud.round.callout` reads *X*" is implementable the same day.

Also outstanding, from the playbook: the source archive, the exact commit and
lockfile for the HWC build, the 453-test inventory, and the 24-career raw
output. Canonical-repository selection stays blocked until the symmetric audit
can run in both directions.

## 8. Legal boundary

`SAFE_RELEASE`. No Heavyweight Circuit code, markup, styling or asset has been
copied into this repository, and none will be. The comparison in §4 is
observational — composition, resolution and affordances derived from running the
artifact — which is precisely the specification the playbook asks Cowork to
produce, and is not reproduction of expression.

No fact about the historical work has entered this build. Every number in the
game is a design decision, a fact from a published source, or a measurement of
this simulation's own behaviour (`docs/SOURCE_MAP.md` labels which, per rule).
The research-to-build fact channel is defined and has never been used (D-036).
