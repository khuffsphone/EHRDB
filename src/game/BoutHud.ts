/**
 * In-fight HUD.
 *
 * Shows round and clock, both fighters' names, condition, durability, stamina
 * and localised damage, plus knockdown counts and the referee's count when one
 * is running — without covering the ring.
 *
 * Condition is shown as bars, consistently, and never as hidden numbers. Every
 * bar also carries a label and, in colour-safe mode, a hatch pattern, so no
 * required information depends on hue.
 */
import Phaser from 'phaser';
import { UI } from '@art/palettes';
import { VIEW, bar, label, hex } from '@ui/kit';
import { t } from '@ui/strings';
import { TICK_RATE, type BoutState, type FighterDefinition } from '@sim/types';

const PANEL_W = 214;
const PANEL_H = 52;
/** Width reserved for bar captions inside a panel. */
const CAPTION_W = 40;

export class BoutHud {
  private readonly scene: Phaser.Scene;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly names: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly records: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly roundText: Phaser.GameObjects.Text;
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly centreText: Phaser.GameObjects.Text;
  private readonly countText: Phaser.GameObjects.Text;
  private readonly kdText: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private colorSafe: boolean;

  constructor(
    scene: Phaser.Scene,
    defs: [FighterDefinition, FighterDefinition],
    playerCorner: 0 | 1,
    colorSafe: boolean,
    depth = 40,
  ) {
    this.scene = scene;
    this.colorSafe = colorSafe;
    this.g = scene.add.graphics().setDepth(depth);

    const mk = (x: number, align: 'left' | 'right', text: string, size: number, colour: number, y: number) =>
      label(scene, x, y, text, { size, colour, align }).setDepth(depth + 1);

    this.names = [
      mk(10, 'left', defs[0].displayName.toUpperCase(), 10, playerCorner === 0 ? UI.accent : UI.text, 8),
      mk(VIEW.width - 10, 'right', defs[1].displayName.toUpperCase(), 10, playerCorner === 1 ? UI.accent : UI.text, 8),
    ];
    this.records = [
      mk(10, 'left', defs[0].nickname, 8, UI.textDim, 20),
      mk(VIEW.width - 10, 'right', defs[1].nickname, 8, UI.textDim, 20),
    ];

    this.roundText = mk(VIEW.width / 2, 'left', '', 10, UI.accent, 8).setOrigin(0.5, 0);
    this.clockText = mk(VIEW.width / 2, 'left', '', 14, UI.text, 19).setOrigin(0.5, 0);
    this.centreText = mk(VIEW.width / 2, 'left', '', 16, UI.accent, 96).setOrigin(0.5, 0.5);
    this.countText = mk(VIEW.width / 2, 'left', '', 44, UI.bad, 150).setOrigin(0.5, 0.5);
    this.kdText = [
      mk(10, 'left', '', 8, UI.bad, 60),
      mk(VIEW.width - 10, 'right', '', 8, UI.bad, 60),
    ];

    // Bar captions, anchored to the outer edge of each panel and mirrored, so
    // the two fighters read symmetrically and nothing overlaps.
    for (const corner of [0, 1] as const) {
      const panelX = corner === 0 ? 10 : VIEW.width - 10 - PANEL_W;
      const capX = corner === 0 ? panelX + 5 : panelX + PANEL_W - 5;
      const align = corner === 0 ? 'left' : 'right';
      this.labels.push(mk(capX, align, 'COMP', 7, UI.textDim, 32));
      this.labels.push(mk(capX, align, 'STAM', 7, UI.textDim, 43));
      this.labels.push(mk(capX, align, t('bout.head').toUpperCase(), 7, UI.textDim, 54));
      this.labels.push(mk(capX, align, t('bout.body').toUpperCase(), 7, UI.textDim, 64));
    }
  }

  setColorSafe(on: boolean): void {
    this.colorSafe = on;
  }

  update(state: BoutState, ruleset: { rounds: number; roundTicks: number }): void {
    const g = this.g;
    g.clear();

    // Round and clock.
    this.roundText.setText(
      state.round >= ruleset.rounds ? t('bout.final') : t('bout.roundOf', state.round, ruleset.rounds),
    );
    const remaining = Math.max(0, ruleset.roundTicks - state.roundTick);
    const secs = Math.ceil(remaining / TICK_RATE);
    // The training lab uses an effectively endless round; a counting clock
    // there is meaningless noise.
    this.clockText.setText(secs > 3600 ? '--:--' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);

    for (const corner of [0, 1] as const) {
      const f = state.fighters[corner];
      const left = corner === 0;
      const x = left ? 10 : VIEW.width - 10 - PANEL_W;

      g.fillStyle(UI.panel, 0.82);
      g.fillRect(x, 28, PANEL_W, PANEL_H);
      g.lineStyle(1, UI.panelEdge, 1);
      g.strokeRect(x + 0.5, 28.5, PANEL_W - 1, PANEL_H - 1);

      // The caption column sits on the outer edge; bars fill the rest.
      const bx = left ? x + 5 + CAPTION_W : x + 5;
      const bw = PANEL_W - 10 - CAPTION_W;

      // Composure over durability: the shrinking ceiling is drawn as a notch,
      // so the player can see the long-term damage as well as the immediate.
      const maxV = Math.max(1, f.resilienceMax);
      bar(g, bx, 31, bw, 9, f.composure / maxV, UI.composure, {
        ghost: f.resilience / maxV,
        ghostColour: 0x5a2b2b,
      });
      // Durability marker.
      const notch = bx + (f.resilience / maxV) * bw;
      g.fillStyle(UI.text, 0.9);
      g.fillRect(notch - 1, 29, 2, 13);

      // Stamina.
      bar(g, bx, 43, bw, 7, 1 - f.exertion, UI.stamina, {});

      // Localised damage: head and body pips, drawn as filled segments with a
      // shape change at critical so colour is never the only signal.
      this.damagePips(g, bx, 54, f.headTrauma);
      this.damagePips(g, bx, 64, f.bodyTrauma);

      this.kdText[corner].setText(f.knockdownsThisRound > 0 ? `DOWN x${f.knockdownsThisRound}` : '');
      this.kdText[corner].setY(82);
    }

    // Centre messaging.
    let centre = '';
    if (state.phase === 'intro') centre = t('game.title');
    else if (state.phase === 'round_break') centre = t('bout.break');
    else if (state.phase === 'knockdown') centre = t('bout.knockdown');
    this.centreText.setText(centre);

    // The count.
    if (state.phase === 'knockdown' && state.groundedCorner !== null) {
      const n = state.fighters[state.groundedCorner].countReached;
      this.countText.setText(n > 0 ? String(n) : '');
    } else {
      this.countText.setText('');
    }
  }

  /** Segments per region; hatched when critical so colour is never the signal. */
  private damagePips(g: Phaser.GameObjects.Graphics, x: number, y: number, trauma: number): void {
    const segs = 8;
    const w = 18;
    const gap = 2;
    const filled = Math.round(trauma * segs);
    const critical = trauma >= 0.85;
    for (let i = 0; i < segs; i++) {
      const sx = x + i * (w + gap);
      const on = i < filled;
      g.fillStyle(on ? (critical ? UI.bad : UI.trauma) : UI.resilience, 1);
      g.fillRect(sx, y, w, 6);
      if (on && critical) {
        // Hatch marks: readable when colour is not.
        g.fillStyle(0x000000, 0.55);
        g.fillRect(sx + 3, y, 1.5, 6);
        g.fillRect(sx + 9, y, 1.5, 6);
        g.fillRect(sx + 14, y, 1.5, 6);
      }
      if (this.colorSafe) {
        g.lineStyle(1, UI.panelEdge, 1);
        g.strokeRect(sx + 0.5, y + 0.5, w - 1, 5);
      }
    }
  }

  /** Live punch statistics for the between-rounds card. */
  showRoundStats(visible: boolean, stats: [{ thrown: number; landed: number; percent: number }, { thrown: number; landed: number; percent: number }]): void {
    if (!this.statsText) {
      this.statsText = label(this.scene, VIEW.width / 2, 118, '', {
        size: 9,
        colour: UI.text,
        align: 'center',
      }).setDepth(42);
      this.statsText.setOrigin(0.5, 0);
    }
    if (!visible) {
      this.statsText.setText('');
      return;
    }
    this.statsText.setText(
      `${t('bout.thrown')} ${stats[0].thrown} / ${stats[1].thrown}\n` +
        `${t('bout.landed')} ${stats[0].landed} / ${stats[1].landed}\n` +
        `${t('bout.percent')} ${stats[0].percent}% / ${stats[1].percent}%`,
    );
  }

  private statsText: Phaser.GameObjects.Text | null = null;

  destroy(): void {
    this.g.destroy();
    for (const n of [...this.names, ...this.records, ...this.kdText, ...this.labels]) n.destroy();
    this.roundText.destroy();
    this.clockText.destroy();
    this.centreText.destroy();
    this.countText.destroy();
    this.statsText?.destroy();
  }
}

export const HUD_COLOURS = { hex };
