# UI Flows

Nineteen scenes. Every one is operable with a keyboard alone or a gamepad
alone; there is no mouse-only path anywhere.

## Map

```
Boot
 └─ Title ── Enter ──► MainMenu
                        ├─ New Career ─────► Creation ──► CareerHub
                        ├─ Continue Career ─► CareerHub
                        ├─ Exhibition ─────► Exhibition ──► Bout ──► Result
                        ├─ Training Lab ───► Lab
                        ├─ Hall of Careers ► Legacy
                        ├─ Settings ───────► Settings
                        ├─ Controls ───────► Controls
                        └─ Credits ────────► Credits

CareerHub ─┬─ Choose Your Next Fight ─► OpponentSelect ─► PreFight ─► Bout
           ├─ Rankings ───────────────► Rankings
           └─ Retire (confirm) ───────► Retirement ─► Legacy

Bout ─► Result ─► Training ─┬─► Challenge ─► PreFight
                            ├─► CareerHub
                            └─► Retirement ─► Legacy
```

## Conventions

- **Up/Down** navigate, wrapping. **Left/Right** adjust a value.
  **Enter** confirms. **Backspace** goes back. **Escape** pauses.
- The focused row always carries a caret, a filled background and a left bar —
  never colour alone.
- Headings and disabled rows are skipped by navigation.
- Every screen shows a footer stating the active controls.
- Destructive actions (erase all data, retire) sit behind a modal confirmation
  that defaults to "No".
- Scene transitions fade rather than snap.

## Screens

| Scene | Shows |
|---|---|
| **Title** | Logo, a fighter drawn with the same rig the ring uses, prompt, originality notice |
| **MainMenu** | Mode list with per-row hints; career summary panel |
| **Creation** | Identity, style base with its description, four ratings with a point pool, appearance, live preview, derived secondary ratings and body |
| **CareerHub** | Rank, record, stage, bouts remaining, earnings, defences; career clock with the decline threshold marked; current ratings; the fighter; division news |
| **Rankings** | Full ladder with the player highlighted, styles, records and recent form |
| **OpponentSelect** | Legal opponents; per-opponent ratings, record, purse, distance, scouting line, and rank consequences of **both** a win and a loss |
| **PreFight** | Tale of the tape, both fighters facing off, venue |
| **Bout** | The ring; HUD with round, clock, both fighters' condition, durability notch, stamina, head/body damage, knockdown count; between-rounds statistics; count; recovery prompt with progress |
| **Pause** | Resume, screen shake, reduced motion, quit |
| **Result** | Outcome and reason, three scorecards, punch statistics, purse, rank change, updated record, save confirmation |
| **Training** | Slate of five with exact resolved gains, picks remaining, wear, synergy, per-item description |
| **Challenge** | Challenger, stakes, and the rank cost of refusing |
| **Retirement** | Ending reason, full record, peak rank, defences, earnings, legacy grade |
| **Legacy** | Hall of Careers with the record to beat |
| **Exhibition** | Fighter, opponent, rounds and venue selection with preview |
| **Lab** | Live simulation with move list, frame-state readout, hitboxes, input display, five partner behaviours, reset |
| **Settings** | Audio buses, fullscreen, accessibility, difficulty, developer overlays, save export/import/erase |
| **Controls** | Per-device rebinding for every action, deadzone, restore defaults |
| **Credits** | Provenance statement |

## Fighter animation coverage

Every state below has authored joint positions in `src/art/boxer.ts`; none is a
rectangle, a label, or a reused unrelated pose. Verified by
`npm run assets:validate`, which resolves all 19 states × 7 punch values × 2
levels and rejects any empty or non-finite pose.

Idle with breathing · locomotion · high guard · body guard · slip · punch
startup/active/recovery for all six punches at both levels · light hit reaction
· heavy hit reaction · stagger · clinch · exhaustion droop · knockdown · the
count · rising · corner · ring introduction · victory · defeat.
