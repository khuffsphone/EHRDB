/**
 * Shared UI kit.
 *
 * A small set of primitives every screen is built from, so focus behaviour,
 * back/confirm semantics and visual language stay identical everywhere. Menus
 * are keyboard- and gamepad-navigable by construction — there is no mouse-only
 * path anywhere in the game.
 */
import Phaser from 'phaser';
import { UI } from '@art/palettes';
import { t } from './strings';

export const VIEW = { width: 640, height: 360 } as const;

export const FONT = {
  family: 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace',
} as const;

let textScale = 1;
export function setTextScale(s: number): void {
  textScale = s;
}
export function getTextScale(): number {
  return textScale;
}

function px(size: number): string {
  return `${Math.max(7, Math.round(size * textScale))}px`;
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { size?: number; colour?: number; align?: 'left' | 'center' | 'right'; wrap?: number; bold?: boolean } = {},
): Phaser.GameObjects.Text {
  const size = opts.size ?? 10;
  const obj = scene.add.text(x, y, text, {
    fontFamily: FONT.family,
    fontSize: px(size),
    color: hex(opts.colour ?? UI.text),
    align: opts.align ?? 'left',
    fontStyle: opts.bold ? 'bold' : 'normal',
    ...(opts.wrap ? { wordWrap: { width: opts.wrap } } : {}),
  });
  if (opts.align === 'center') obj.setOrigin(0.5, 0);
  else if (opts.align === 'right') obj.setOrigin(1, 0);
  obj.setResolution(2);
  return obj;
}

export function hex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** A framed panel. Everything sits inside one so screens share a rhythm. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  titleKey?: string,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(UI.panel, 0.94);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, UI.panelEdge, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // A single accent rule at the top gives the frame a direction.
  g.fillStyle(UI.accentDim, 1);
  g.fillRect(x, y, w, 2);
  if (titleKey) {
    label(scene, x + 8, y + 6, t(titleKey).toUpperCase(), { size: 9, colour: UI.accent, bold: true });
  }
  return g;
}

/** A labelled bar. Used for condition, stamina and rating displays. */
export function bar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  colour: number,
  opts: { background?: number; ghost?: number; ghostColour?: number; border?: boolean } = {},
): void {
  g.fillStyle(opts.background ?? UI.resilience, 1);
  g.fillRect(x, y, w, h);
  if (opts.ghost !== undefined) {
    g.fillStyle(opts.ghostColour ?? UI.trauma, 0.85);
    g.fillRect(x, y, Math.max(0, Math.min(1, opts.ghost)) * w, h);
  }
  g.fillStyle(colour, 1);
  g.fillRect(x, y, Math.max(0, Math.min(1, value)) * w, h);
  if (opts.border !== false) {
    g.lineStyle(1, UI.panelEdge, 1);
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export interface MenuItem {
  /** Left-hand label. */
  text: string;
  /** Right-hand value, for settings-style rows. */
  value?: () => string;
  /** Called on confirm. */
  onSelect?: () => void;
  /** Called on left/right, for sliders and cycles. */
  onAdjust?: (delta: number) => void;
  /** Rows that cannot be chosen — headings and explanatory lines. */
  disabled?: boolean;
  heading?: boolean;
  /** Optional per-row description shown beneath the list. */
  hint?: string;
  colour?: number;
}

export interface MenuOptions {
  x: number;
  y: number;
  width: number;
  /** Vertical distance between rows. */
  rowHeight?: number;
  size?: number;
  /** Called whenever the highlighted row changes. */
  onFocusChange?: (index: number) => void;
  /** Rendered beneath the list. */
  hintY?: number;
}

/**
 * The most recently interacted-with menu. Exposed read-only to the browser
 * smoke test so it can navigate by row label instead of counting keypresses,
 * which silently breaks whenever a row is added. Test introspection only —
 * nothing in the game reads it.
 */
let activeMenuRef: Menu | null = null;

function markActive(m: Menu): void {
  activeMenuRef = m;
}

export function debugFocusedLabel(): string | null {
  const item = activeMenuRef?.focusedItem;
  if (!item) return null;
  return item.text.replace(/^[\s▸]+/, '');
}

/**
 * A vertical, wrap-around menu.
 *
 * The focused row always carries a visible marker and a background, never
 * colour alone — required by the accessibility standard.
 */
export class Menu {
  private readonly scene: Phaser.Scene;
  private readonly opts: Required<Pick<MenuOptions, 'x' | 'y' | 'width' | 'rowHeight' | 'size'>> & MenuOptions;
  private items: MenuItem[] = [];
  private rows: { text: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text | null }[] = [];
  private cursor = 0;
  private readonly g: Phaser.GameObjects.Graphics;
  private hintText: Phaser.GameObjects.Text | null = null;
  private enabled = true;

  constructor(scene: Phaser.Scene, opts: MenuOptions) {
    markActive(this);
    this.scene = scene;
    this.opts = { rowHeight: 15, size: 10, ...opts } as Required<
      Pick<MenuOptions, 'x' | 'y' | 'width' | 'rowHeight' | 'size'>
    > &
      MenuOptions;
    this.g = scene.add.graphics();
  }

  setItems(items: MenuItem[]): void {
    markActive(this);
    for (const r of this.rows) {
      r.text.destroy();
      r.value?.destroy();
    }
    this.rows = [];
    this.items = items;

    items.forEach((it, i) => {
      const y = this.opts.y + i * this.opts.rowHeight;
      const text = label(this.scene, this.opts.x + 12, y, it.text, {
        size: this.opts.size,
        colour: it.colour ?? (it.heading ? UI.accent : it.disabled ? UI.textDim : UI.text),
        bold: it.heading,
      });
      let value: Phaser.GameObjects.Text | null = null;
      if (it.value) {
        value = label(this.scene, this.opts.x + this.opts.width - 8, y, it.value(), {
          size: this.opts.size,
          colour: UI.textDim,
          align: 'right',
        });
      }
      this.rows.push({ text, value });
    });

    if (this.opts.hintY !== undefined && !this.hintText) {
      this.hintText = label(this.scene, this.opts.x + 2, this.opts.hintY, '', {
        size: 8,
        colour: UI.textDim,
        wrap: this.opts.width,
      });
    }

    if (this.items[this.cursor]?.disabled || this.items[this.cursor]?.heading) this.moveTo(this.nextSelectable(0, 1));
    this.redraw();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.redraw();
  }

  get focusedIndex(): number {
    return this.cursor;
  }

  get focusedItem(): MenuItem | undefined {
    return this.items[this.cursor];
  }

  /** Refreshes value columns without rebuilding the list. */
  refresh(): void {
    this.items.forEach((it, i) => {
      const row = this.rows[i];
      if (row?.value && it.value) row.value.setText(it.value());
      if (row) row.text.setText(it.text);
    });
    this.redraw();
  }

  private nextSelectable(from: number, dir: number): number {
    if (this.items.length === 0) return 0;
    let i = from;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + dir + this.items.length) % this.items.length;
      const it = this.items[i];
      if (!it.disabled && !it.heading) return i;
    }
    return from;
  }

  private moveTo(i: number): void {
    this.cursor = i;
    this.opts.onFocusChange?.(i);
    this.redraw();
  }

  move(dir: number): boolean {
    markActive(this);
    if (!this.enabled || this.items.length === 0) return false;
    const next = this.nextSelectable(this.cursor, dir);
    if (next === this.cursor) return false;
    this.moveTo(next);
    return true;
  }

  adjust(delta: number): boolean {
    const it = this.items[this.cursor];
    if (!this.enabled || !it || !it.onAdjust) return false;
    it.onAdjust(delta);
    this.refresh();
    return true;
  }

  confirm(): boolean {
    const it = this.items[this.cursor];
    if (!this.enabled || !it || it.disabled || it.heading || !it.onSelect) return false;
    it.onSelect();
    return true;
  }

  private redraw(): void {
    this.g.clear();
    const { x, width, rowHeight } = this.opts;
    this.items.forEach((it, i) => {
      const row = this.rows[i];
      if (!row) return;
      const y = this.opts.y + i * rowHeight;
      const focused = i === this.cursor && this.enabled && !it.disabled && !it.heading;
      if (focused) {
        this.g.fillStyle(UI.raised, 1);
        this.g.fillRect(x, y - 3, width, rowHeight - 1);
        this.g.fillStyle(UI.focus, 1);
        this.g.fillRect(x, y - 3, 3, rowHeight - 1);
        row.text.setColor(hex(UI.focus));
        // A caret as well as the highlight: focus never depends on colour.
        row.text.setText(`▸ ${stripCaret(it.text)}`);
      } else {
        row.text.setColor(hex(it.colour ?? (it.heading ? UI.accent : it.disabled ? UI.textDim : UI.text)));
        row.text.setText(it.heading ? stripCaret(it.text) : `  ${stripCaret(it.text)}`);
      }
      row.value?.setColor(hex(focused ? UI.text : UI.textDim));
    });
    if (this.hintText) this.hintText.setText(this.items[this.cursor]?.hint ?? '');
  }

  destroy(): void {
    if (activeMenuRef === this) activeMenuRef = null;
    this.g.destroy();
    for (const r of this.rows) {
      r.text.destroy();
      r.value?.destroy();
    }
    this.hintText?.destroy();
    this.rows = [];
  }
}

function stripCaret(s: string): string {
  return s.startsWith('▸ ') ? s.slice(2) : s.startsWith('  ') ? s.slice(2) : s;
}

/** Standard footer showing the current confirm/back prompts. */
export function footer(scene: Phaser.Scene, text: string): Phaser.GameObjects.Text {
  return label(scene, VIEW.width / 2, VIEW.height - 14, text, {
    size: 8,
    colour: UI.textDim,
    align: 'center',
  });
}

/** A full-screen modal confirmation. Returns a disposer. */
export function confirmDialog(
  scene: Phaser.Scene,
  message: string,
  onYes: () => void,
  onNo: () => void,
): { menu: Menu; destroy: () => void } {
  const w = 380;
  const h = 110;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  const shade = scene.add.graphics();
  shade.fillStyle(0x000000, 0.72);
  shade.fillRect(0, 0, VIEW.width, VIEW.height);
  const p = panel(scene, x, y, w, h);
  const text = label(scene, x + 14, y + 24, message, { size: 10, wrap: w - 28 });
  const menu = new Menu(scene, { x: x + 14, y: y + h - 34, width: w - 28, rowHeight: 14 });
  menu.setItems([
    { text: t('common.no'), onSelect: onNo },
    { text: t('common.yes'), onSelect: onYes, colour: UI.bad },
  ]);
  return {
    menu,
    destroy: () => {
      shade.destroy();
      p.destroy();
      text.destroy();
      menu.destroy();
    },
  };
}
