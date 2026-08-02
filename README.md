# TEN COUNT — Championship Boxing

An original browser boxing game built on a deterministic simulation core.
Create a boxer, climb a ranked ladder of eight contenders, take the title, then
survive long enough to be remembered for it.

Twenty fights. One legacy.

## Play it

```bash
npm ci
npm run build
npm run preview     # then open http://localhost:4173
```

For development with hot reload:

```bash
npm run dev         # http://localhost:5173
```

The build in `dist/` is a static site. It needs no server beyond a file host
and makes **zero network requests** once loaded.

## Controls

Everything is remappable from **Settings → Controls**, on both keyboard and
gamepad. Defaults:

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | `W` `A` `S` `D` | Left stick / D-pad |
| Jab | `J` | A |
| Cross | `K` | B |
| Lead hook | `U` | X |
| Rear hook | `I` | Y |
| Uppercut (hold + hook) | `L` | LB |
| Guard | `Space` | RB |
| Crouch / body level | `Left Shift` | LT |
| Slip | `H` | RT |
| Clinch | `O` | R3 |
| Confirm / Back | `Enter` / `Backspace` | A / B |
| Pause | `Escape` | Start |

**Crouch changes the level of every punch.** Head shots drop an opponent; body
shots drain them and set the head shot up. A guard only protects the level it
is held at — that is the whole game.

## How a fight works

Four things are tracked separately, not one health bar:

- **Composure** — immediate energy. At zero you go down. It recovers when you
  are not being hit, and faster at distance.
- **Durability** — the ceiling composure can return to. It only partly recovers
  between rounds, so a long fight starts each round from a lower ceiling.
- **Head / body damage** — localised and accumulating. Enough of it and the
  referee steps in.
- **Stamina** — slows your hands, sags your guard and takes the weight off your
  punches. It never disables you.

Volume punching grinds durability down. Power punching attacks composure and
balance. Body work drains stamina and sets up the finish. Counters land when
your opponent is inside the vulnerability window of a punch they have already
committed to — a state, not a dice roll.

## Career

Beat someone ranked above you and you take their place. Lose to someone below
you and they take yours. That is the entire progression system.

Purses are a legacy score, not a currency — training is awarded for fighting,
never bought. From bout twelve your ratings start to slip faster than training
can hold them. Every career ends by bout twenty, and is graded on what it
actually achieved.

## Architecture

```
src/sim/         Deterministic simulation. No DOM, no wall clock, no unseeded
                 randomness. 60 Hz fixed tick. The authority on everything.
src/ai/          Three-layer opponent AI. Sees only PublicBoutView.
src/career/      Ladder, training, ageing, retirement, boxer creation.
src/save/        Versioned saves with ordered migrations.
src/data/        Fighters, punches, venues, rulesets — all schema-validated.
src/art/         Procedural fighter rig and palettes. No image files.
src/audio/       Web Audio synthesis. No sound files.
src/input/       Keyboard and gamepad behind one action abstraction.
src/ui/          String table and the shared menu kit.
src/game/        Ring renderer, HUD, scene base, shared services.
src/scenes/      Nineteen screens.
tools/           Soak harness, career fast-forward, QA, release audit, verify.
tests/           Simulation, combat, outcomes, AI fairness, soak, career,
                 saves, save validation, content, input edges and golden replay.
```

The simulation never imports from presentation, and presentation never writes
to simulation state. `npm run verify` enforces the boundary along with
everything else.

## Commands

| Command | What it does |
|---|---|
| `npm run verify` | Every required gate; output preserved in `artifacts/qa/verify/` |
| `npm test` | The test suite |
| `npm run soak` | Seeded AI-vs-AI batch (`-- --mirror` for the control field) |
| `npm run career:sim` | Play complete careers headlessly |
| `npm run qa:smoke` | Browser end-to-end: menu → bout → result → save → reload |
| `npm run qa:screens` | Screenshot every screen at three viewports |
| `npm run release:audit` | Legal and provenance audit |
| `npm run balance:certify` | Assert the documented balance targets over 1200 control bouts |
| `npm run balance:tune` | Search the archetype profile space; prints a patch, never writes one |
| `npm run fixture:replay` | Regenerate the committed golden replay fixture |
| `RELEASE=1 npm run release:audit` | Release-grade audit: a dirty tree or a local build blocks |

Every gate also runs on push in `.github/workflows/verify.yml`, on a clean
checkout with the pinned lockfile. That run is the only evidence of
correctness that does not depend on trusting a local machine.

## Deploying

`dist/` is a static bundle with relative paths, so it works from any
subdirectory:

```bash
npm ci && npm run build
# then copy dist/ to any static host
```

Every build writes `dist/build-manifest.json` recording the commit, the
lockfile hash, the build time and the CI run, and the same identity is
compiled into the bundle and shown on the title screen and in full on Credits.
The manifest also carries a SHA-256 over every emitted file, which
`npm run release:audit` recomputes rather than taking on trust. A build whose
manifest says `"ci": "local"` did not come from the pipeline: the audit warns
during development and, under `RELEASE=1`, blocks.

It works from `file://` in most browsers, and from any static host —
GitHub Pages, Netlify, S3, or `python3 -m http.server` inside `dist/`.
No backend, no accounts, no telemetry, no analytics.

## Accessibility

Colour-safe HUD, reduced motion, adjustable text scale, hold-or-toggle guard,
three knockdown-recovery methods that all resolve against the same difficulty,
full remapping, and complete keyboard-only and gamepad-only operation. No
required information depends on colour, sound, flashing or rapid input alone.
See `docs/ACCESSIBILITY.md`.

## Originality

Every fighter, venue, judge and event is fictional. Every sprite is drawn by
code at runtime; every sound is synthesised at runtime. **The build contains no
binary media files at all.** The repository tracks 85 PNGs as visual evidence — 84
QA screen captures under `artifacts/qa/screens/` and one ring-geometry
diagnostic; all are generated by this project's own renderer, each is covered by
a ledger row that `npm run release:audit` enforces, and none are copied into
`dist/`. The only
third-party code is Phaser 3 (MIT).

Full provenance: `docs/LEGAL_AND_ASSET_LEDGER.md`.

## Documentation

`docs/PRODUCT_CANON.md` · `COMBAT_SPEC` · `AI_SPEC` · `CAREER_SPEC` ·
`CONTENT_SCHEMAS` · `UI_FLOWS` · `ACCESSIBILITY` · `DECISIONS` · `SOURCE_MAP` ·
`ORIGINAL_GAME_FINDINGS` · `ACCEPTANCE_TESTS` · `TEST_REPORT` ·
`RELEASE_NOTES` · `LEGAL_AND_ASSET_LEDGER` · `PLAYTEST_BRIEF` (the questions
automation cannot answer)

## Licence

MIT. See `LICENSE`.
