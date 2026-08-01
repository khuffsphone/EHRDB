/**
 * Common scene behaviour.
 *
 * Every screen inherits the same background, the same navigation semantics and
 * the same audio feedback, so "confirm" and "back" mean the same thing
 * everywhere and no screen can accidentally become mouse-only.
 */
import Phaser from 'phaser';
import { UI } from '@art/palettes';
import { VIEW, label, footer } from '@ui/kit';
import { t } from '@ui/strings';
import { getContext, type GameContext } from './context';
import type { InputSnapshot } from '@input/manager';

export abstract class BaseScene extends Phaser.Scene {
  protected ctx!: GameContext;
  protected snapshot!: InputSnapshot;
  private noticeText: Phaser.GameObjects.Text | null = null;
  private noticeTicks = 0;
  /** Blocks navigation while a modal is open. */
  protected modalOpen = false;

  /** Called every frame after input has been sampled. */
  protected abstract handleInput(s: InputSnapshot): void;

  /** Phaser lifecycle hook. Subclasses override this to release resources. */
  shutdown(): void {
    /* nothing to release by default */
  }

  init(): void {
    this.ctx = getContext(this);
  }

  /** Paints the shared backdrop. Call from `create`. */
  protected paintBackground(titleKey?: string, subtitle?: string): void {
    const g = this.add.graphics();
    g.fillStyle(UI.ink, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    // A subtle vertical gradient built from bands — cheap, and it stops the
    // background reading as a flat void at large window sizes.
    for (let i = 0; i < 12; i++) {
      g.fillStyle(0x141824, 1 - i / 14);
      g.fillRect(0, VIEW.height - 18 * (i + 1), VIEW.width, 18);
    }
    g.fillStyle(UI.accentDim, 1);
    g.fillRect(0, 26, VIEW.width, 1);

    if (titleKey) {
      label(this, 16, 10, t(titleKey).toUpperCase(), { size: 13, colour: UI.accent, bold: true });
    }
    if (subtitle) {
      label(this, VIEW.width - 16, 13, subtitle, { size: 9, colour: UI.textDim, align: 'right' });
    }
  }

  protected showFooter(text: string): void {
    footer(this, text);
  }

  /** Standard footer text for a list screen. */
  protected navFooter(extra?: string): void {
    const base = '↑↓ Navigate   Enter Confirm   Backspace Back';
    this.showFooter(extra ? `${base}   ${extra}` : base);
  }

  /** Shows a transient message near the top of the screen. */
  protected showNotice(text: string): void {
    this.noticeText?.destroy();
    this.noticeText = label(this, VIEW.width / 2, 32, text, {
      size: 9,
      colour: UI.accent,
      align: 'center',
    });
    this.noticeTicks = 180;
  }

  protected sfx(id: Parameters<GameContext['audio']['play']>[0]): void {
    this.ctx.audio.play(id);
  }

  /** Moves to another scene with a short fade so transitions never snap. */
  protected go(key: string, data?: object): void {
    this.cameras.main.fadeOut(110, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(key, data);
    });
  }

  override update(): void {
    // The audio context can only start from a gesture; any input counts.
    const s = this.ctx.input.update();
    this.snapshot = s;
    if (!this.ctx.audio.isRunning && anyPressed(s)) {
      this.ctx.audio.unlock();
      this.ctx.audio.applySettings(this.ctx.settings.audio);
    }

    if (this.noticeTicks > 0) {
      this.noticeTicks--;
      if (this.noticeTicks === 0) {
        this.noticeText?.destroy();
        this.noticeText = null;
      }
    }

    if (this.ctx.notice) {
      this.showNotice(this.ctx.notice);
      this.ctx.notice = null;
    }

    this.handleInput(s);
  }

  /** Repeat-friendly directional read for menus. */
  protected navDelta(s: InputSnapshot): number {
    if (s.pressed.down) return 1;
    if (s.pressed.up) return -1;
    return 0;
  }

  protected adjustDelta(s: InputSnapshot): number {
    if (s.pressed.right) return 1;
    if (s.pressed.left) return -1;
    return 0;
  }
}

function anyPressed(s: InputSnapshot): boolean {
  for (const k of Object.keys(s.pressed) as (keyof typeof s.pressed)[]) {
    if (s.pressed[k]) return true;
  }
  return false;
}
