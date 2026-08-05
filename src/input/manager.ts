/**
 * Device input.
 *
 * One abstraction over keyboard and standard gamepads. Produces a per-frame
 * snapshot of action state with both level (`held`) and edge (`pressed`)
 * information, so the simulation can be fed edge-triggered punches while guard
 * stays a hold.
 *
 * Handles hot-plugging, a configurable stick deadzone, full remapping, and
 * reports disconnection so the bout can pause itself safely.
 */
import { ACTIONS, DEFAULT_GAMEPAD, DEFAULT_KEYBOARD, type Action } from './actions';

export interface InputSnapshot {
  held: Record<Action, boolean>;
  pressed: Record<Action, boolean>;
  released: Record<Action, boolean>;
  /** Analogue movement from the left stick, already deadzoned. -1..1. */
  axisX: number;
  axisY: number;
  /** Which device produced the most recent input, for glyph switching. */
  lastDevice: 'keyboard' | 'gamepad';
}

function emptyRecord(): Record<Action, boolean> {
  const r = {} as Record<Action, boolean>;
  for (const a of ACTIONS) r[a] = false;
  return r;
}

/**
 * The same snapshot with every edge already consumed.
 *
 * A frame is sampled once but may drive several simulation ticks when the
 * renderer stalls and the fixed-step loop catches up. Level state (`held`)
 * legitimately applies to all of those ticks; an edge does not — a single
 * press must reach the simulation exactly once, or it is re-read inside the
 * input buffer window and queues a punch nobody asked for. Callers running a
 * catch-up loop feed the real snapshot to the first tick and this to the rest.
 */
export function levelOnly(s: InputSnapshot): InputSnapshot {
  return { ...s, pressed: emptyRecord(), released: emptyRecord() };
}

export type BindingCapture = { device: 'keyboard' | 'gamepad'; token: string };

export class InputManager {
  private keyboard: Record<Action, string>;
  private gamepad: Record<Action, string>;
  private readonly keysDown = new Set<string>();
  private prevHeld: Record<Action, boolean> = emptyRecord();
  private snapshot: InputSnapshot = {
    held: emptyRecord(),
    pressed: emptyRecord(),
    released: emptyRecord(),
    axisX: 0,
    axisY: 0,
    lastDevice: 'keyboard',
  };

  /** Stick deadzone, 0..0.6. Exposed in settings. */
  deadzone = 0.28;
  private padIndex: number | null = null;
  private padWasConnected = false;
  /** Raised when a pad disconnects mid-session. Cleared by the consumer. */
  disconnectedFlag = false;
  /** When set, the next input is captured for remapping instead of acted on. */
  private captureResolve: ((c: BindingCapture) => void) | null = null;
  private lastDevice: 'keyboard' | 'gamepad' = 'keyboard';

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.captureResolve) {
      e.preventDefault();
      const resolve = this.captureResolve;
      this.captureResolve = null;
      resolve({ device: 'keyboard', token: e.code });
      return;
    }
    // Stop the browser scrolling or activating the page behind the canvas.
    if (SWALLOW.has(e.code)) e.preventDefault();
    this.keysDown.add(e.code);
    this.lastDevice = 'keyboard';
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private readonly onBlur = (): void => {
    // Losing focus must not leave a key stuck down.
    this.keysDown.clear();
  };

  private readonly onPadConnected = (): void => {
    this.padWasConnected = true;
  };

  private readonly onPadDisconnected = (): void => {
    if (this.padWasConnected) this.disconnectedFlag = true;
    this.padIndex = null;
  };

  constructor(keyboard?: Record<string, string>, gamepad?: Record<string, string>) {
    this.keyboard = { ...DEFAULT_KEYBOARD, ...(keyboard ?? {}) } as Record<Action, string>;
    this.gamepad = { ...DEFAULT_GAMEPAD, ...(gamepad ?? {}) } as Record<Action, string>;
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', this.onPadConnected);
    window.addEventListener('gamepaddisconnected', this.onPadDisconnected);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('gamepadconnected', this.onPadConnected);
    window.removeEventListener('gamepaddisconnected', this.onPadDisconnected);
  }

  get bindings(): { keyboard: Record<Action, string>; gamepad: Record<Action, string> } {
    return { keyboard: { ...this.keyboard }, gamepad: { ...this.gamepad } };
  }

  setBinding(device: 'keyboard' | 'gamepad', action: Action, token: string): void {
    const map = device === 'keyboard' ? this.keyboard : this.gamepad;
    // A token may only drive one action per device; clear any previous holder
    // so remapping can never produce two actions on one key.
    for (const a of ACTIONS) {
      if (a !== action && map[a] === token) map[a] = '';
    }
    map[action] = token;
  }

  resetBindings(): void {
    this.keyboard = { ...DEFAULT_KEYBOARD };
    this.gamepad = { ...DEFAULT_GAMEPAD };
  }

  /** Waits for the next raw input and returns it, for the remap screen. */
  captureNext(): Promise<BindingCapture> {
    return new Promise((resolve) => {
      this.captureResolve = resolve;
    });
  }

  cancelCapture(): void {
    this.captureResolve = null;
  }

  get isCapturing(): boolean {
    return this.captureResolve !== null;
  }

  private activePad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (this.padIndex !== null) {
      const p = pads[this.padIndex];
      if (p && p.connected) return p;
      this.padIndex = null;
    }
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        this.padIndex = i;
        this.padWasConnected = true;
        return p;
      }
    }
    return null;
  }

  private padTokenActive(pad: Gamepad, token: string): boolean {
    if (!token) return false;
    if (token.startsWith('button:')) {
      const idx = Number(token.slice(7));
      const b = pad.buttons[idx];
      return !!b && (b.pressed || b.value > 0.5);
    }
    if (token.startsWith('axis:')) {
      const [, n, dir] = token.split(':');
      const v = pad.axes[Number(n)] ?? 0;
      return dir === '+' ? v > this.deadzone : v < -this.deadzone;
    }
    return false;
  }

  /** Samples all devices. Call once per rendered frame. */
  update(): InputSnapshot {
    const held = emptyRecord();
    const pad = this.activePad();

    // Remap capture consumes gamepad input too.
    if (this.captureResolve && pad) {
      for (let i = 0; i < pad.buttons.length; i++) {
        const b = pad.buttons[i];
        if (b && (b.pressed || b.value > 0.5)) {
          const resolve = this.captureResolve;
          this.captureResolve = null;
          resolve({ device: 'gamepad', token: `button:${i}` });
          break;
        }
      }
    }

    for (const a of ACTIONS) {
      const key = this.keyboard[a];
      if (key && this.keysDown.has(key)) held[a] = true;
    }

    let axisX = 0;
    let axisY = 0;
    if (pad) {
      let padActive = false;
      for (const a of ACTIONS) {
        if (this.padTokenActive(pad, this.gamepad[a])) {
          held[a] = true;
          padActive = true;
        }
      }
      const rawX = pad.axes[0] ?? 0;
      const rawY = pad.axes[1] ?? 0;
      axisX = Math.abs(rawX) > this.deadzone ? rawX : 0;
      axisY = Math.abs(rawY) > this.deadzone ? rawY : 0;
      if (axisX !== 0 || axisY !== 0) {
        padActive = true;
        // The stick also drives the four directional actions, so menus and the
        // ring both work without touching the d-pad.
        if (axisX > 0) held.right = true;
        if (axisX < 0) held.left = true;
        if (axisY > 0) held.down = true;
        if (axisY < 0) held.up = true;
      }
      if (padActive) this.lastDevice = 'gamepad';
    }

    const pressed = emptyRecord();
    const released = emptyRecord();
    for (const a of ACTIONS) {
      pressed[a] = held[a] && !this.prevHeld[a];
      released[a] = !held[a] && this.prevHeld[a];
    }
    this.prevHeld = held;

    this.snapshot = { held, pressed, released, axisX, axisY, lastDevice: this.lastDevice };
    return this.snapshot;
  }

  get current(): InputSnapshot {
    return this.snapshot;
  }

  /** True while any gamepad is connected. */
  get hasGamepad(): boolean {
    return this.activePad() !== null;
  }

  /** Consumes the disconnect flag. */
  takeDisconnect(): boolean {
    const v = this.disconnectedFlag;
    this.disconnectedFlag = false;
    return v;
  }
}

/** Keys whose default browser behaviour would interfere with play. */
const SWALLOW = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Tab',
  'Enter',
]);
