/**
 * The action vocabulary.
 *
 * Everything the player can do — in menus and in the ring — is one of these.
 * Devices bind to actions, never to game logic, which is what makes remapping
 * and controller-only navigation work everywhere without special cases.
 */

export const ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'jab',
  'cross',
  'leadHook',
  'rearHook',
  'uppercutMod',
  'guard',
  'crouch',
  'slip',
  'clinch',
  'confirm',
  'cancel',
  'pause',
] as const;

export type Action = (typeof ACTIONS)[number];

/** Actions the remapping screen will not let the player unbind. */
export const REQUIRED_ACTIONS: readonly Action[] = [
  'up',
  'down',
  'left',
  'right',
  'jab',
  'cross',
  'leadHook',
  'rearHook',
  'guard',
  'crouch',
  'confirm',
  'cancel',
  'pause',
];

/** Grouping and labels for the controls screen and the printed guide. */
export const ACTION_GROUPS: { titleKey: string; actions: Action[] }[] = [
  { titleKey: 'controls.group.movement', actions: ['up', 'down', 'left', 'right'] },
  { titleKey: 'controls.group.punches', actions: ['jab', 'cross', 'leadHook', 'rearHook', 'uppercutMod'] },
  { titleKey: 'controls.group.defence', actions: ['guard', 'crouch', 'slip', 'clinch'] },
  { titleKey: 'controls.group.system', actions: ['confirm', 'cancel', 'pause'] },
];

export const DEFAULT_KEYBOARD: Record<Action, string> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jab: 'KeyJ',
  cross: 'KeyK',
  leadHook: 'KeyU',
  rearHook: 'KeyI',
  uppercutMod: 'KeyL',
  guard: 'Space',
  crouch: 'ShiftLeft',
  slip: 'KeyH',
  clinch: 'KeyO',
  confirm: 'Enter',
  cancel: 'Backspace',
  pause: 'Escape',
};

/**
 * Standard-gamepad defaults. Numbers are button indices in the W3C standard
 * mapping; `axis:N:+` / `axis:N:-` bind an axis direction.
 */
export const DEFAULT_GAMEPAD: Record<Action, string> = {
  up: 'button:12',
  down: 'button:13',
  left: 'button:14',
  right: 'button:15',
  jab: 'button:0',
  cross: 'button:1',
  leadHook: 'button:2',
  rearHook: 'button:3',
  uppercutMod: 'button:4',
  guard: 'button:5',
  crouch: 'button:6',
  slip: 'button:7',
  clinch: 'button:10',
  confirm: 'button:0',
  cancel: 'button:1',
  pause: 'button:9',
};

/** Human-readable label for a binding token. */
export function describeBinding(token: string | undefined, device: 'keyboard' | 'gamepad'): string {
  if (!token) return '—';
  if (device === 'keyboard') {
    return token
      .replace(/^Key/, '')
      .replace(/^Digit/, '')
      .replace(/^Arrow/, '')
      .replace('ShiftLeft', 'L-Shift')
      .replace('ShiftRight', 'R-Shift')
      .replace('ControlLeft', 'L-Ctrl')
      .replace('ControlRight', 'R-Ctrl')
      .replace('Space', 'Space')
      .replace('Escape', 'Esc');
  }
  if (token.startsWith('button:')) return `Button ${token.slice(7)}`;
  if (token.startsWith('axis:')) {
    const [, n, dir] = token.split(':');
    return `Axis ${n}${dir}`;
  }
  return token;
}
