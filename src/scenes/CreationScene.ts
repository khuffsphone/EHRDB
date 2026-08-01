/**
 * Create-a-boxer.
 *
 * Fully operable from the keyboard or a gamepad: rows are navigated with
 * up/down, values adjusted with left/right, and the name field is edited in
 * place. The live preview uses the same rig the ring uses, so what you build is
 * what walks out.
 */
import Phaser from 'phaser';
import { BaseScene } from '@game/BaseScene';
import { Menu, bar, label, panel } from '@ui/kit';
import { UI, FIGHTER_PALETTES, SKIN_TONES, TRUNK_PATTERNS, HAIR_STYLES } from '@art/palettes';
import { drawBoxer, POSES } from '@art/boxer';
import { t } from '@ui/strings';
import {
  BASE_RATING,
  CREATION_CAP,
  POINT_POOL,
  STYLE_BASES,
  buildFighter,
  canLower,
  canRaise,
  defaultChoices,
  pointsRemaining,
  validateChoices,
  type CreationChoices,
} from '@career/creation';
import { createCareer } from '@career/career';
import type { InputSnapshot } from '@input/manager';
import type { CoreRatings } from '@sim/types';

const PALETTE_KEYS = Object.keys(FIGHTER_PALETTES);
const SKIN_KEYS = Object.keys(SKIN_TONES);

export class CreationScene extends BaseScene {
  static readonly KEY = 'Creation';

  private choices!: CreationChoices;
  private menu!: Menu;
  private preview!: Phaser.GameObjects.Graphics;
  private ratingsG!: Phaser.GameObjects.Graphics;
  private derivedText!: Phaser.GameObjects.Text;
  private styleText!: Phaser.GameObjects.Text;
  private editingName: 'name' | 'nickname' | null = null;
  /**
   * Frames to ignore confirm for after leaving the text field. The Enter that
   * closes the editor is still held when the menu next samples input, and
   * without this it immediately re-opens the same field.
   */
  private confirmCooldown = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    super(CreationScene.KEY);
  }

  create(): void {
    this.choices = defaultChoices();
    this.paintBackground('creation.title');

    panel(this, 16, 40, 300, 266);
    panel(this, 326, 40, 298, 178, 'creation.ratings');
    panel(this, 326, 226, 298, 90);

    this.preview = this.add.graphics();
    this.ratingsG = this.add.graphics();
    this.derivedText = label(this, 336, 236, '', { size: 8, colour: UI.textDim, wrap: 278 });
    this.styleText = label(this, 336, 196, '', { size: 8, colour: UI.textDim, wrap: 278 });

    this.menu = new Menu(this, { x: 26, y: 58, width: 280, rowHeight: 14, size: 9, hintY: 314 });
    this.rebuild();
    this.redraw();
    this.navFooter('←→ Adjust');

    // Text entry is a genuine input mode, so it takes over the keyboard while
    // active and hands it straight back on Enter or Escape.
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.editingName) return;
      e.preventDefault();
      const field = this.editingName;
      const current = this.choices[field];
      if (e.key === 'Enter' || e.key === 'Escape') {
        this.editingName = null;
        this.confirmCooldown = 3;
        this.menu.setEnabled(true);
        this.rebuild();
        this.sfx('menu_confirm');
        return;
      }
      if (e.key === 'Backspace') {
        this.choices[field] = current.slice(0, -1);
      } else if (e.key.length === 1 && current.length < 18 && /[\w '\-.]/.test(e.key)) {
        this.choices[field] = current + e.key;
      }
      this.rebuild();
      this.redraw();
    };
    window.addEventListener('keydown', this.keyHandler, { passive: false });
  }

  private cycle<T>(list: readonly T[], current: T, delta: number): T {
    const i = list.indexOf(current);
    const n = list.length;
    return list[((i < 0 ? 0 : i) + delta + n) % n];
  }

  private rebuild(): void {
    const c = this.choices;
    const remaining = pointsRemaining(c.allocation);
    const ratingRow = (key: keyof CoreRatings) => ({
      text: `  ${t(`rating.${key}`)}`,
      value: () => `${BASE_RATING + c.allocation[key]}`,
      onAdjust: (d: number) => {
        if (d > 0 && canRaise(c.allocation, key)) c.allocation[key]++;
        else if (d < 0 && canLower(c.allocation, key)) c.allocation[key]--;
        else this.sfx('menu_error');
        this.redraw();
      },
      onSelect: () => undefined,
      hint: `Base ${BASE_RATING}, maximum ${CREATION_CAP} at creation. Style modifiers apply on top.`,
    });

    this.menu.setItems([
      { text: 'Identity', heading: true },
      {
        text: `  ${t('creation.name')}`,
        value: () => (this.editingName === 'name' ? `${c.name}_` : c.name || '—'),
        onSelect: () => this.beginEdit('name'),
        hint: t('creation.typeHint'),
      },
      {
        text: `  ${t('creation.nickname')}`,
        value: () => (this.editingName === 'nickname' ? `${c.nickname}_` : c.nickname || '—'),
        onSelect: () => this.beginEdit('nickname'),
        hint: t('creation.typeHint'),
      },
      { text: t('creation.style'), heading: true },
      {
        text: `  ${t('creation.style')}`,
        value: () => t(STYLE_BASES.find((s) => s.archetype === c.archetype)!.nameKey),
        onAdjust: (d) => {
          const list = STYLE_BASES.map((s) => s.archetype);
          c.archetype = this.cycle(list, c.archetype, d);
          this.redraw();
        },
        onSelect: () => undefined,
        hint: 'Each style trades something real for what it gives you.',
      },
      {
        text: `  ${t('creation.stance')}`,
        value: () => t(`stance.${c.stance}`),
        onAdjust: () => {
          c.stance = c.stance === 'orthodox' ? 'southpaw' : 'orthodox';
          this.redraw();
        },
        onSelect: () => undefined,
      },
      { text: `${t('creation.ratings')}  —  ${t('creation.points')}: ${remaining}`, heading: true },
      ratingRow('power'),
      ratingRow('stamina'),
      ratingRow('speed'),
      ratingRow('defense'),
      { text: t('creation.appearance'), heading: true },
      {
        text: '  Trunks',
        value: () => `${c.paletteKey} / ${c.trunksKey}`,
        onAdjust: (d) => {
          if (d > 0) c.paletteKey = this.cycle(PALETTE_KEYS, c.paletteKey, 1);
          else c.trunksKey = this.cycle(TRUNK_PATTERNS as readonly string[], c.trunksKey, 1);
          this.redraw();
        },
        onSelect: () => undefined,
        hint: '→ cycles colour, ← cycles pattern.',
      },
      {
        text: '  Build & Look',
        value: () => `${c.buildKey} / ${c.skinKey} / ${c.hairKey}`,
        onAdjust: (d) => {
          if (d > 0) {
            c.buildKey = this.cycle(['lean', 'athletic', 'heavy'] as const, c.buildKey, 1);
          } else {
            c.skinKey = this.cycle(SKIN_KEYS, c.skinKey, 1);
            c.hairKey = this.cycle(HAIR_STYLES as readonly string[], c.hairKey, 1);
          }
          this.redraw();
        },
        onSelect: () => undefined,
        hint: 'Appearance never affects performance.',
      },
      { text: '', heading: true },
      {
        text: t('creation.randomise'),
        onSelect: () => this.randomise(),
      },
      {
        text: t('creation.begin'),
        colour: UI.accent,
        onSelect: () => this.begin(),
      },
    ]);
  }

  private beginEdit(field: 'name' | 'nickname'): void {
    this.editingName = field;
    this.menu.setEnabled(false);
    this.rebuild();
    this.sfx('menu_confirm');
  }

  private randomise(): void {
    const c = this.choices;
    const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
    c.archetype = pick(STYLE_BASES).archetype;
    c.paletteKey = pick(PALETTE_KEYS);
    c.trunksKey = pick(TRUNK_PATTERNS as readonly string[]);
    c.skinKey = pick(SKIN_KEYS);
    c.hairKey = pick(HAIR_STYLES as readonly string[]);
    c.buildKey = pick(['lean', 'athletic', 'heavy'] as const);
    const alloc = { power: 0, stamina: 0, speed: 0, defense: 0 };
    const keys = ['power', 'stamina', 'speed', 'defense'] as const;
    for (let i = 0; i < POINT_POOL; i++) {
      const k = pick(keys);
      if (BASE_RATING + alloc[k] < CREATION_CAP) alloc[k]++;
      else i--;
    }
    c.allocation = alloc;
    this.sfx('menu_confirm');
    this.rebuild();
    this.redraw();
  }

  private begin(): void {
    const errors = validateChoices(this.choices);
    if (errors.length > 0) {
      this.sfx('menu_error');
      this.showNotice(t(errors[0]));
      return;
    }
    const fighter = buildFighter(this.choices);
    this.ctx.lastCreated = fighter;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0;
    this.ctx.career = createCareer(seed, fighter, this.ctx.settings.difficulty);
    this.ctx.persist();
    this.sfx('menu_confirm');
    this.go('CareerHub');
  }

  private redraw(): void {
    const c = this.choices;
    // Live preview.
    this.preview.clear();
    this.preview.save();
    this.preview.translateCanvas(470, 176);
    this.preview.scaleCanvas(2.3, 2.3);
    drawBoxer(this.preview, POSES.guard, {
      paletteKey: c.paletteKey,
      skinKey: c.skinKey,
      buildKey: c.buildKey,
      trunksKey: c.trunksKey,
      hairKey: c.hairKey,
    }, { colorSafe: this.ctx.settings.accessibility.colorSafe });
    this.preview.restore();

    // Derived ratings, so nothing about the build is hidden.
    const f = buildFighter(c);
    this.ratingsG.clear();
    const keys: (keyof CoreRatings)[] = ['power', 'stamina', 'speed', 'defense'];
    keys.forEach((k, i) => {
      bar(this.ratingsG, 336, 62 + i * 14, 100, 7, f.ratings[k] / 100, UI.accent, {});
    });
    const style = STYLE_BASES.find((s) => s.archetype === c.archetype)!;
    this.styleText.setText(t(style.descriptionKey));
    this.derivedText.setText(
      `${t('rating.chin')} ${f.secondary.chin}   ${t('rating.bodyToughness')} ${f.secondary.bodyToughness}   ${t('rating.recovery')} ${f.secondary.recovery}\n` +
        `${t('rating.footwork')} ${f.secondary.footwork}   ${t('rating.accuracy')} ${f.secondary.accuracy}   ${t('rating.composure')} ${f.secondary.composure}\n\n` +
        `${f.body.heightCm} cm · ${f.body.reachCm} cm reach · ${f.body.massKg} kg`,
    );
  }

  protected handleInput(s: InputSnapshot): void {
    if (this.editingName) return;
    if (this.confirmCooldown > 0) {
      this.confirmCooldown--;
      return;
    }
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    const a = this.adjustDelta(s);
    if (a !== 0) {
      if (this.menu.adjust(a)) {
        this.sfx('menu_move');
        this.rebuild();
      }
    }
    if (s.pressed.confirm) {
      this.sfx('menu_confirm');
      this.menu.confirm();
    }
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      this.go('MainMenu');
    }
  }

  override shutdown(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
  }
}
