/**
 * Boot, title, main menu, credits and the Hall of Careers.
 */
import Phaser from 'phaser';
import { BaseScene } from '@game/BaseScene';
import { CTX_KEY, GameContext } from '@game/context';
import { Menu, VIEW, label, panel } from '@ui/kit';
import { UI } from '@art/palettes';
import { drawBoxer, POSES } from '@art/boxer';
import { money, record, t } from '@ui/strings';
import { CAREER_RULES } from '@career/types';
import { BUILD, buildLabel } from '@util/build-info';
import type { InputSnapshot } from '@input/manager';

/** Creates shared services and hands off to the title. */
export class BootScene extends Phaser.Scene {
  static readonly KEY = 'Boot';
  constructor() {
    super(BootScene.KEY);
  }

  create(): void {
    const ctx = new GameContext();
    this.registry.set(CTX_KEY, ctx);
    ctx.input.attach();

    // Surface a save problem immediately rather than silently starting fresh.
    if (ctx.save.report.messageKey) ctx.notice = t(ctx.save.report.messageKey);

    this.scene.start(TitleScene.KEY);
  }
}

export class TitleScene extends BaseScene {
  static readonly KEY = 'Title';
  private blink = 0;
  private prompt!: Phaser.GameObjects.Text;

  constructor() {
    super(TitleScene.KEY);
  }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0a0c11, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);
    // Spotlight cone behind the title.
    g.fillStyle(0x1d2433, 1);
    g.fillTriangle(VIEW.width / 2, -40, VIEW.width / 2 - 210, VIEW.height, VIEW.width / 2 + 210, VIEW.height);
    g.fillStyle(0x262f42, 0.7);
    g.fillTriangle(VIEW.width / 2, -20, VIEW.width / 2 - 120, VIEW.height, VIEW.width / 2 + 120, VIEW.height);

    // A fighter silhouette, drawn with the same rig the ring uses.
    const fig = this.add.graphics();
    fig.save();
    fig.translateCanvas(VIEW.width / 2, 306);
    fig.scaleCanvas(2.5, 2.5);
    drawBoxer(fig, POSES.intro, {
      paletteKey: 'crimson',
      skinKey: 'bronze',
      buildKey: 'athletic',
      trunksKey: 'crown',
      hairKey: 'fade',
    }, {});
    fig.restore();

    label(this, VIEW.width / 2, 54, t('game.title'), { size: 42, colour: UI.accent, align: 'center', bold: true });
    label(this, VIEW.width / 2, 104, t('game.subtitle'), { size: 12, colour: UI.text, align: 'center' });
    label(this, VIEW.width / 2, 122, t('game.tagline'), { size: 9, colour: UI.textDim, align: 'center' });
    this.prompt = label(this, VIEW.width / 2, VIEW.height - 44, t('menu.start'), {
      size: 11,
      colour: UI.focus,
      align: 'center',
    });
    label(this, VIEW.width / 2, VIEW.height - 22, 'An original game. All fighters and events are fictional.', {
      size: 7,
      colour: UI.textDim,
      align: 'center',
    });
    // Build identity, so a player reporting a bug and a developer reproducing
    // it are provably talking about the same bytes.
    label(this, VIEW.width - 6, VIEW.height - 10, buildLabel(), {
      size: 6,
      colour: UI.textDim,
      align: 'right',
    }).setOrigin(1, 0);
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  protected handleInput(s: InputSnapshot): void {
    this.blink++;
    this.prompt.setAlpha(0.45 + 0.55 * Math.abs(Math.sin(this.blink * 0.045)));
    if (s.pressed.confirm || s.pressed.jab || s.pressed.pause) {
      this.ctx.audio.unlock();
      this.ctx.audio.playMusic('menu');
      this.sfx('menu_confirm');
      this.go(MainMenuScene.KEY);
    }
  }
}

export class MainMenuScene extends BaseScene {
  static readonly KEY = 'MainMenu';
  private menu!: Menu;

  constructor() {
    super(MainMenuScene.KEY);
  }

  create(): void {
    this.paintBackground('game.title', t('game.subtitle'));
    this.ctx.audio.playMusic('menu');
    panel(this, 40, 46, 250, 210);
    panel(this, 306, 46, 294, 210, 'career.record');

    this.menu = new Menu(this, { x: 52, y: 66, width: 226, rowHeight: 20, size: 11, hintY: 232 });
    this.rebuild();
    this.drawSummary();
    this.navFooter();
  }

  private rebuild(): void {
    const hasCareer = this.ctx.career !== null && this.ctx.career.ending === null;
    const items = [];
    if (hasCareer) {
      items.push({
        text: t('menu.careerContinue'),
        onSelect: () => this.go('CareerHub'),
        hint: 'Return to your camp and pick your next fight.',
      });
    }
    items.push({
      text: t('menu.careerNew'),
      onSelect: () => this.go('Creation'),
      hint: hasCareer
        ? 'Starting a new career retires the one in progress.'
        : 'Create a boxer and take them through twenty fights.',
    });
    items.push(
      { text: t('menu.exhibition'), onSelect: () => this.go('Exhibition'), hint: 'A single fight between any two fighters.' },
      { text: t('menu.trainingLab'), onSelect: () => this.go('Lab'), hint: 'Practise against a configurable partner with frame data on screen.' },
      { text: t('menu.legacy'), onSelect: () => this.go('Legacy'), hint: 'Completed careers and the record to beat.' },
      { text: t('menu.settings'), onSelect: () => this.go('Settings'), hint: 'Audio, accessibility, difficulty and save data.' },
      { text: t('menu.controls'), onSelect: () => this.go('Controls'), hint: 'Rebind the keyboard and gamepad.' },
      { text: t('menu.credits'), onSelect: () => this.go('Credits'), hint: 'Who and what made this.' },
    );
    this.menu.setItems(items);
  }

  private drawSummary(): void {
    const c = this.ctx.career;
    if (!c) {
      label(this, 320, 76, 'No career in progress.', { size: 10, colour: UI.textDim });
      label(this, 320, 96, 'Create a boxer, climb eight ranked contenders,\ntake the title, then survive long enough\nto be remembered for it.', {
        size: 9,
        colour: UI.textDim,
        wrap: 264,
      });
      return;
    }
    const rows: [string, string][] = [
      [t('creation.name'), c.player.displayName],
      [t('career.rank'), c.isChampion ? t('career.champion') : c.playerRank >= 9 ? t('career.unranked') : `#${c.playerRank}`],
      [t('career.record'), record(c.wins, c.losses, c.draws, c.kos)],
      [t('career.stage'), t(`stage.${c.stage}`)],
      [t('career.boutsLeft'), String(Math.max(0, CAREER_RULES.maxBouts - c.boutIndex))],
      [t('career.earnings'), money(c.earnings)],
    ];
    rows.forEach(([k, v], i) => {
      label(this, 320, 76 + i * 20, k, { size: 10, colour: UI.textDim });
      label(this, 586, 76 + i * 20, v, { size: 10, colour: UI.text, align: 'right' });
    });
  }

  protected handleInput(s: InputSnapshot): void {
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) {
      this.sfx('menu_confirm');
      this.menu.confirm();
    }
    if (s.pressed.cancel) this.sfx('menu_back');
  }
}

export class CreditsScene extends BaseScene {
  static readonly KEY = 'Credits';
  constructor() {
    super(CreditsScene.KEY);
  }

  create(): void {
    this.paintBackground('credits.title');
    panel(this, 60, 42, 520, 268);
    label(this, 80, 62, t('credits.body'), { size: 9, colour: UI.text, wrap: 480 });

    /*
     * Build identity, in full, on the screen a player is most likely to be
     * looking at when they file a bug. The short form is on the title screen;
     * this is the version a report can be reconciled against — the same values
     * `dist/build-manifest.json` carries, and the same ones the read-only
     * `window.__TEN_COUNT__.build` hook exposes.
     */
    const lines = [
      `Version ${BUILD.version}`,
      `Commit ${BUILD.commitShort}${BUILD.dirty ? ' (modified working tree)' : ''}`,
      `Lockfile ${BUILD.lockfileHash}`,
      `Built ${BUILD.builtAt.slice(0, 19).replace('T', ' ')} UTC · ${BUILD.ci}`,
    ];
    lines.forEach((line, i) => {
      label(this, 80, 268 + i * 11, line, { size: 7, colour: UI.textDim });
    });

    this.showFooter('Backspace  Back');
  }

  protected handleInput(s: InputSnapshot): void {
    if (s.pressed.cancel || s.pressed.confirm) {
      this.sfx('menu_back');
      this.go(MainMenuScene.KEY);
    }
  }
}

export class LegacyScene extends BaseScene {
  static readonly KEY = 'Legacy';
  constructor() {
    super(LegacyScene.KEY);
  }

  create(): void {
    this.paintBackground('legacy.title', t('legacy.target', money(CAREER_RULES.legacyTarget)));
    panel(this, 30, 42, 580, 268);

    const legacy = this.ctx.save.data.legacy;
    if (legacy.length === 0) {
      label(this, VIEW.width / 2, 150, t('legacy.empty'), { size: 11, colour: UI.textDim, align: 'center' });
    } else {
      const heads = ['Boxer', 'Record', 'Peak', 'Def.', 'Earnings', 'Legacy'];
      const xs = [46, 200, 300, 350, 400, 490];
      heads.forEach((h, i) => label(this, xs[i], 58, h, { size: 8, colour: UI.accent, bold: true }));
      legacy.slice(0, 12).forEach((l, i) => {
        const y = 76 + i * 18;
        const beat = l.earnings >= CAREER_RULES.legacyTarget;
        const colour = beat ? UI.accent : UI.text;
        label(this, xs[0], y, l.nickname ? `${l.name} "${l.nickname}"` : l.name, { size: 9, colour });
        label(this, xs[1], y, record(l.wins, l.losses, l.draws, l.kos), { size: 9, colour: UI.textDim });
        label(this, xs[2], y, l.peakRank >= 9 ? '—' : `#${l.peakRank}`, { size: 9, colour: UI.textDim });
        label(this, xs[3], y, String(l.titleDefences), { size: 9, colour: UI.textDim });
        label(this, xs[4], y, money(l.earnings), { size: 9, colour });
        label(this, xs[5], y, t(l.gradeKey), { size: 9, colour });
        if (beat) label(this, 560, y, t('legacy.beaten'), { size: 7, colour: UI.accent });
      });
    }
    this.showFooter('Backspace  Back');
  }

  protected handleInput(s: InputSnapshot): void {
    if (s.pressed.cancel || s.pressed.confirm) {
      this.sfx('menu_back');
      this.go(MainMenuScene.KEY);
    }
  }
}
