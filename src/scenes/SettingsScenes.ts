/**
 * Settings and control remapping.
 *
 * Both screens are fully operable without a mouse, and remapping accepts
 * either device. Destructive actions are behind a confirmation.
 */
import Phaser from 'phaser';
import { BaseScene } from '@game/BaseScene';
import { Menu, label, panel, confirmDialog, VIEW } from '@ui/kit';
import { UI } from '@art/palettes';
import { t } from '@ui/strings';
import { DIFFICULTY_IDS } from '@ai/profiles';
import { ACTION_GROUPS, describeBinding, type Action } from '@input/actions';
import type { InputSnapshot } from '@input/manager';

export class SettingsScene extends BaseScene {
  static readonly KEY = 'Settings';
  private menu!: Menu;
  private dialog: { menu: Menu; destroy: () => void } | null = null;

  constructor() {
    super(SettingsScene.KEY);
  }

  create(): void {
    this.paintBackground('settings.title');
    panel(this, 40, 40, 560, 272);
    this.menu = new Menu(this, { x: 52, y: 56, width: 536, rowHeight: 14, size: 9, hintY: 296 });
    this.rebuild();
    this.navFooter('←→ Adjust');
  }

  private rebuild(): void {
    const s = this.ctx.settings;
    const a = s.accessibility;
    const au = s.audio;
    const onOff = (v: boolean): string => (v ? t('settings.on') : t('settings.off'));
    const pct = (v: number): string => `${Math.round(v * 100)}%`;

    const slider = (key: string, get: () => number, set: (v: number) => void, hint?: string) => ({
      text: `  ${t(key)}`,
      value: () => pct(get()),
      onAdjust: (d: number) => {
        set(Math.max(0, Math.min(1, Math.round((get() + d * 0.05) * 100) / 100)));
        this.ctx.applySettings();
        this.sfx('menu_move');
      },
      onSelect: () => undefined,
      hint,
    });
    const toggle = (key: string, get: () => boolean, set: (v: boolean) => void, hint?: string) => ({
      text: `  ${t(key)}`,
      value: () => onOff(get()),
      onSelect: () => {
        set(!get());
        this.ctx.applySettings();
        this.menu.refresh();
        this.sfx('menu_confirm');
      },
      onAdjust: () => {
        set(!get());
        this.ctx.applySettings();
        this.sfx('menu_move');
      },
      hint,
    });

    this.menu.setItems([
      { text: t('settings.audio'), heading: true },
      slider('settings.master', () => au.master, (v) => (au.master = v)),
      slider('settings.music', () => au.music, (v) => (au.music = v)),
      slider('settings.sfx', () => au.sfx, (v) => (au.sfx = v)),
      slider('settings.crowd', () => au.crowd, (v) => (au.crowd = v)),
      toggle('settings.mute', () => au.muted, (v) => (au.muted = v)),

      { text: t('settings.video'), heading: true },
      {
        text: `  ${t('settings.fullscreen')}`,
        value: () => onOff(this.scale.isFullscreen),
        onSelect: () => {
          if (this.scale.isFullscreen) this.scale.stopFullscreen();
          else this.scale.startFullscreen();
          this.menu.refresh();
        },
        hint: 'The game letterboxes to any window shape.',
      },

      { text: t('settings.accessibility'), heading: true },
      toggle('settings.screenShake', () => a.screenShake, (v) => (a.screenShake = v)),
      toggle('settings.hitFlash', () => a.hitFlash, (v) => (a.hitFlash = v), 'Brief, low-intensity flashes only. Never a strobe.'),
      toggle('settings.reducedMotion', () => a.reducedMotion, (v) => (a.reducedMotion = v), 'Removes shake, hitstop and non-essential motion.'),
      toggle('settings.colorSafe', () => a.colorSafe, (v) => (a.colorSafe = v), 'Adds outlines and hatching so nothing depends on colour alone.'),
      {
        text: `  ${t('settings.textScale')}`,
        value: () => `${a.textScale.toFixed(2)}×`,
        onAdjust: (d: number) => {
          a.textScale = Math.max(0.8, Math.min(1.6, Math.round((a.textScale + d * 0.1) * 100) / 100));
          this.ctx.applySettings();
          this.sfx('menu_move');
          // Text size affects every label, so the screen is rebuilt.
          this.scene.restart();
        },
        onSelect: () => undefined,
      },
      {
        text: `  ${t('settings.holdToGuard')}`,
        value: () => (a.holdToGuard ? t('settings.holdToGuard.hold') : t('settings.holdToGuard.toggle')),
        onSelect: () => {
          a.holdToGuard = !a.holdToGuard;
          this.ctx.applySettings();
          this.menu.refresh();
        },
        onAdjust: () => {
          a.holdToGuard = !a.holdToGuard;
          this.ctx.applySettings();
        },
      },
      {
        text: `  ${t('settings.riseAssist')}`,
        value: () => t(`settings.riseAssist.${a.riseAssist}`),
        onAdjust: (d: number) => {
          const modes = ['tap', 'hold', 'auto'] as const;
          const i = modes.indexOf(a.riseAssist);
          a.riseAssist = modes[(i + d + modes.length) % modes.length];
          this.ctx.applySettings();
          this.sfx('menu_move');
        },
        onSelect: () => undefined,
        hint: 'All three resolve against the same recovery difficulty.',
      },

      { text: t('settings.gameplay'), heading: true },
      {
        text: `  ${t('settings.difficulty')}`,
        value: () => t(`difficulty.${this.ctx.settings.difficulty}`),
        onAdjust: (d: number) => {
          const i = DIFFICULTY_IDS.indexOf(this.ctx.settings.difficulty);
          this.ctx.settings.difficulty = DIFFICULTY_IDS[(i + d + DIFFICULTY_IDS.length) % DIFFICULTY_IDS.length];
          this.ctx.applySettings();
          this.sfx('menu_move');
        },
        onSelect: () => undefined,
        hint: 'Changes reaction time, planning and discipline — never the opponent’s ratings.',
      },

      { text: t('settings.debug'), heading: true },
      toggle('settings.showAiDebug', () => a.showAiDebug, (v) => (a.showAiDebug = v), 'Shows the opponent’s current plan and utilities.'),
      toggle('settings.showFrameData', () => a.showFrameData, (v) => (a.showFrameData = v), 'Draws hurt regions and active punch reach.'),

      { text: t('settings.data'), heading: true },
      { text: `  ${t('settings.export')}`, onSelect: () => this.exportSave() },
      { text: `  ${t('settings.import')}`, onSelect: () => this.importSave() },
      { text: `  ${t('settings.reset')}`, colour: UI.bad, onSelect: () => this.askReset() },
      { text: '', heading: true },
      { text: t('menu.back'), onSelect: () => this.go('MainMenu') },
    ]);
  }

  private exportSave(): void {
    const text = this.ctx.save.exportTo(new Date().toISOString());
    // The clipboard is the least intrusive channel available offline; a
    // download fallback covers browsers that refuse it.
    const done = (): void => this.showNotice(t('save.exported'));
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.downloadSave(text));
    } else {
      this.downloadSave(text);
    }
    this.sfx('menu_confirm');
  }

  private downloadSave(text: string): void {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ten-count-save.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showNotice(t('save.exported'));
  }

  private importSave(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        const err = this.ctx.save.importFrom(text, new Date().toISOString());
        if (err) {
          this.sfx('menu_error');
          this.showNotice(t(err));
        } else {
          this.ctx.career = this.ctx.save.data.career;
          this.ctx.applySettings();
          this.showNotice(t('save.imported'));
          this.scene.restart();
        }
      });
    };
    input.click();
  }

  private askReset(): void {
    if (this.dialog) return;
    this.dialog = confirmDialog(
      this,
      t('settings.resetConfirm'),
      () => {
        this.ctx.save.reset(new Date().toISOString());
        this.ctx.career = null;
        this.ctx.input.resetBindings();
        this.ctx.applySettings();
        this.closeDialog();
        this.scene.restart();
      },
      () => this.closeDialog(),
    );
  }

  private closeDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
  }

  protected handleInput(s: InputSnapshot): void {
    const active = this.dialog?.menu ?? this.menu;
    const d = this.navDelta(s);
    if (d !== 0) {
      active.move(d);
      this.sfx('menu_move');
    }
    const a = this.adjustDelta(s);
    if (a !== 0 && !this.dialog) this.menu.adjust(a);
    if (s.pressed.confirm) active.confirm();
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      if (this.dialog) this.closeDialog();
      else this.go('MainMenu');
    }
  }
}

// ---------------------------------------------------------------------------

export class ControlsScene extends BaseScene {
  static readonly KEY = 'Controls';
  private menu!: Menu;
  private device: 'keyboard' | 'gamepad' = 'keyboard';
  private capturing: Action | null = null;
  private captureText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(ControlsScene.KEY);
  }

  create(): void {
    this.paintBackground('controls.title');
    panel(this, 40, 40, 560, 272);
    this.menu = new Menu(this, { x: 52, y: 56, width: 536, rowHeight: 13, size: 9, hintY: 296 });
    this.rebuild();
    this.navFooter('←→ Switch device');
  }

  private rebuild(): void {
    const b = this.ctx.input.bindings;
    const map = this.device === 'keyboard' ? b.keyboard : b.gamepad;
    const items: Parameters<Menu['setItems']>[0] = [
      {
        text: `${t('controls.keyboard')}  /  ${t('controls.gamepad')}`,
        value: () => (this.device === 'keyboard' ? t('controls.keyboard') : t('controls.gamepad')),
        onAdjust: () => {
          this.device = this.device === 'keyboard' ? 'gamepad' : 'keyboard';
          this.rebuild();
          this.sfx('menu_move');
        },
        onSelect: () => {
          this.device = this.device === 'keyboard' ? 'gamepad' : 'keyboard';
          this.rebuild();
        },
      },
    ];

    if (this.device === 'gamepad' && !this.ctx.input.hasGamepad) {
      items.push({ text: t('controls.noPad'), disabled: true, colour: UI.warn });
    }

    for (const group of ACTION_GROUPS) {
      items.push({ text: t(group.titleKey), heading: true });
      for (const action of group.actions) {
        items.push({
          text: `  ${t(`action.${action}`)}`,
          value: () => (this.capturing === action ? t('controls.pressKey') : describeBinding(map[action], this.device)),
          onSelect: () => this.beginCapture(action),
          hint: 'Enter to rebind. A key can only drive one action.',
        });
      }
    }

    items.push({ text: '', heading: true });
    items.push({
      text: t('controls.reset'),
      onSelect: () => {
        this.ctx.input.resetBindings();
        this.ctx.applySettings();
        this.rebuild();
        this.sfx('menu_confirm');
      },
    });
    items.push({ text: t('menu.back'), onSelect: () => this.go('MainMenu') });

    this.menu.setItems(items);
  }

  private beginCapture(action: Action): void {
    this.capturing = action;
    this.menu.refresh();
    this.menu.setEnabled(false);
    this.captureText = label(this, VIEW.width / 2, 320, t('controls.pressKey'), {
      size: 10,
      colour: UI.focus,
      align: 'center',
    });
    void this.ctx.input.captureNext().then((cap) => {
      // A binding always lands on the device page the player is editing, so
      // pressing a key while on the gamepad page cannot silently rebind it.
      if (cap.device === this.device) {
        this.ctx.input.setBinding(this.device, action, cap.token);
        this.ctx.applySettings();
        this.sfx('menu_confirm');
      } else {
        this.sfx('menu_error');
      }
      this.capturing = null;
      this.captureText?.destroy();
      this.captureText = null;
      this.menu.setEnabled(true);
      this.rebuild();
    });
  }

  protected handleInput(s: InputSnapshot): void {
    if (this.capturing) return;
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    const a = this.adjustDelta(s);
    if (a !== 0) this.menu.adjust(a);
    if (s.pressed.confirm) this.menu.confirm();
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      this.go('MainMenu');
    }
  }

  override shutdown(): void {
    this.ctx.input.cancelCapture();
  }
}
