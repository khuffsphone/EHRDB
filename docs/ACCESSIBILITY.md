# Accessibility

## Standard

No required information depends on colour, sound, flashing, or rapid input
alone. Every screen is fully operable with a keyboard alone or a gamepad alone.

## Motor

- **Every control is remappable**, on both keyboard and gamepad, from
  Settings → Controls. A binding can only drive one action per device; taking a
  key from another action clears it there.
- **Guard can be hold or toggle.** Settings → Accessibility → Guard.
- **Knockdown recovery has three methods** — repeated presses, hold, or
  automatic — and *all three resolve against the same recovery difficulty*.
  Choosing the accessible option does not make you worse at boxing.
- **Recovery always progresses on its own.** Rise progress accrues passively at
  all times; inputs accelerate it. A player who cannot press repeatedly is
  slower to rise, never locked out.
- **Mashing is capped.** Recovery inputs count at most once every six ticks, so
  pressing faster than a person usefully can gains nothing.
- **No control requires a chord** except the uppercut modifier, which is
  remappable and duplicates punches already reachable another way.
- Losing window focus clears all held keys, so nothing sticks.

## Vision

- **Colour-safe HUD** (Settings → Accessibility) adds outlines to fighters and
  borders to every HUD segment, so silhouette and shape carry the information
  that colour otherwise would.
- Condition bars carry **text captions** (`COMP`, `STAM`, `HEAD`, `BODY`) at
  all times, not only in colour-safe mode.
- **Critical damage is hatched**, not merely recoloured — the segment pattern
  changes when a region reaches stoppage risk.
- The durability ceiling is drawn as a **notch**, a shape, not a hue.
- **Menu focus is never colour alone**: the focused row carries a caret, a
  filled background and a left bar.
- **Text scale** is adjustable from 0.8× to 1.6×; every label in the game
  respects it.
- Internal resolution is fixed at 640×360 and scales with letterboxing, so
  everything grows proportionally with the window.

## Photosensitivity and motion

- **Reduced Motion** removes screen shake, hitstop and non-essential motion.
- **Screen shake** and **hit flash** are independently switchable, and are also
  in the pause menu so they can be turned off mid-bout without losing progress.
- Hit flash is brief and low-intensity by construction — capped at 0.22 alpha
  and decaying within a few frames. **There is no full-screen strobe anywhere in
  the game.**
- Crowd and venue animation is ambient, never strobing.

## Hearing

- Nothing required is audio-only. The bell, the count, knockdowns and round
  transitions all have on-screen equivalents: the round banner, the large
  numeric count, the `DOWN ×n` indicator and the between-rounds card.
- Music, effects and crowd have **independent volume buses** plus a master and
  a mute, so the mix can be shaped rather than only silenced.
- Music is deliberately sparse so it never masks the bell or the count.

## Cognitive

- The **career clock** on the hub shows exactly how many bouts remain and marks
  where decline begins, so ageing is never a surprise.
- Every bout offer states the purse, the distance, and the rank consequence of
  **both** a win and a loss before it is accepted.
- Every training item shows its **exact resolved numbers**, not a description
  of a promise.
- Menu rows carry contextual hints beneath the list.
- The **Training Lab** exposes the real frame data, hitboxes, input display and
  a configurable partner, so the systems can be learned directly rather than
  guessed at.
- Difficulty adjusts the opponent's reaction time, planning and discipline —
  never its ratings — so a lower setting makes the game slower to punish, not
  a different game.

## Safe interruption

- Pause is available at any time in a bout, from a single button.
- **A gamepad disconnecting mid-round pauses the bout automatically** and
  explains how to recover — the fighter never keeps walking into the ropes.
- The career autosaves after every bout and after every training choice.

## Verified

- `npm run qa:smoke` drives the entire game — menus, creation, a full bout,
  results, save and reload — with **keyboard input only**, and fails on any
  console error.
- `npm run qa:screens` captures every screen at three viewport sizes and
  asserts navigation, including the controls screen in both device modes.
