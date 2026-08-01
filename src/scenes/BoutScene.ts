/**
 * The bout.
 *
 * Runs the authoritative simulation at a fixed 60 Hz regardless of display
 * refresh, translates device input into normalised commands, drives the
 * opponent AI from the same public view an observer would have, and renders
 * the result.
 *
 * Nothing in this scene writes to simulation state. Hitstop freezes rendering
 * only — the simulation and input sampling continue — so effects can never
 * change an outcome or swallow a button press.
 */
import Phaser from 'phaser';
import { BaseScene } from '@game/BaseScene';
import { RingRenderer } from '@game/RingRenderer';
import { BoutHud } from '@game/BoutHud';
import { BoutSim } from '@sim/bout';
import { publicView } from '@sim/view';
import { AiController } from '@ai/controller';
import { DIFFICULTIES } from '@ai/profiles';
import { getPunch } from '@data/punches';
import { emptyCommand, TICK_RATE, type BoutEvent, type FighterCommand, type PunchId } from '@sim/types';
import type { InputSnapshot } from '@input/manager';
import { Menu, VIEW, label, panel } from '@ui/kit';
import { UI } from '@art/palettes';
import { t } from '@ui/strings';
import type { BoutRequest } from '@game/context';

const STEP_MS = 1000 / TICK_RATE;
/** Never simulate more than this many ticks in one frame after a stall. */
const MAX_CATCHUP = 8;

export class BoutScene extends BaseScene {
  static readonly KEY = 'Bout';

  private request!: BoutRequest;
  private sim!: BoutSim;
  private ai!: AiController;
  private ring!: RingRenderer;
  private hud!: BoutHud;
  private accumulator = 0;
  private aiCorner: 0 | 1 = 1;
  private paused = false;
  private pauseMenu: Menu | null = null;
  private pauseLayer: Phaser.GameObjects.GameObject[] = [];
  private finished = false;
  private guardToggle = false;
  private riseHoldTicks = 0;
  private lastFooter: Phaser.GameObjects.Text | null = null;
  private padWarning: Phaser.GameObjects.Text | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;
  private crowdBedLevel = -1;

  constructor() {
    super(BoutScene.KEY);
  }

  create(): void {
    const req = this.ctx.pendingBout;
    if (!req) {
      // Nothing to fight; fall back rather than crash.
      this.scene.start('MainMenu');
      return;
    }
    this.request = req;
    this.finished = false;
    this.paused = false;
    this.accumulator = 0;

    this.sim = new BoutSim(req.config);
    this.aiCorner = req.playerCorner === 0 ? 1 : 0;
    this.ai = new AiController(
      this.aiCorner,
      req.config.fighters[this.aiCorner].style.archetype,
      DIFFICULTIES[this.ctx.settings.difficulty],
      `${req.config.seed}:ai`,
    );

    const a11y = this.ctx.settings.accessibility;
    this.ring = new RingRenderer(
      this,
      req.config.venueId,
      [req.config.fighters[0].appearance, req.config.fighters[1].appearance],
      {
        screenShake: a11y.screenShake && !a11y.reducedMotion,
        hitFlash: a11y.hitFlash,
        reducedMotion: a11y.reducedMotion,
        colorSafe: a11y.colorSafe,
        showHitboxes: a11y.showFrameData,
      },
    );
    this.hud = new BoutHud(this, req.config.fighters, req.playerCorner, a11y.colorSafe);

    this.ctx.audio.playMusic('none');
    this.ctx.audio.startCrowdBed(0.5);

    if (a11y.showAiDebug) {
      this.debugText = label(this, 8, 84, '', { size: 7, colour: 0x9fe8ff }).setDepth(60);
    }

    this.cameras.main.fadeIn(160, 0, 0, 0);
  }

  // -------------------------------------------------------------------------
  // Input translation
  // -------------------------------------------------------------------------

  /**
   * Turns a device snapshot into the same command shape the AI produces.
   * Punches are edge-triggered so a held button never machine-guns; guard is a
   * hold or a toggle depending on the accessibility setting.
   */
  private playerCommand(s: InputSnapshot): FighterCommand {
    const cmd = emptyCommand();
    const player = this.sim.state.fighters[this.request.playerCorner];
    const a11y = this.ctx.settings.accessibility;

    // Movement. Left/right are world-space on screen; the simulation wants
    // them relative to facing, so a fighter always walks the way you pressed.
    const worldX = (s.held.right ? 1 : 0) - (s.held.left ? 1 : 0);
    cmd.moveX = worldX * player.facing;
    cmd.moveZ = (s.held.down ? 1 : 0) - (s.held.up ? 1 : 0);

    // Guard.
    if (a11y.holdToGuard) {
      cmd.guard = s.held.guard;
    } else {
      if (s.pressed.guard) this.guardToggle = !this.guardToggle;
      cmd.guard = this.guardToggle;
    }
    cmd.crouch = s.held.crouch;

    // Punches. The uppercut modifier converts the two hook buttons, which
    // keeps the whole six-punch vocabulary on four face buttons.
    const upper = s.held.uppercutMod;
    let punch: PunchId | null = null;
    if (s.pressed.jab) punch = 'jab';
    else if (s.pressed.cross) punch = 'cross';
    else if (s.pressed.leadHook) punch = upper ? 'lead_upper' : 'lead_hook';
    else if (s.pressed.rearHook) punch = upper ? 'rear_upper' : 'rear_hook';
    cmd.punch = punch;

    if (s.pressed.slip) cmd.slip = cmd.moveZ !== 0 ? cmd.moveZ : 1;
    cmd.clinch = s.held.clinch;

    // Knockdown recovery. All three methods resolve against the same recovery
    // difficulty — see docs/ACCESSIBILITY.md.
    if (player.state === 'knockdown') {
      switch (a11y.riseAssist) {
        case 'auto':
          cmd.recover = true;
          break;
        case 'hold':
          this.riseHoldTicks++;
          cmd.recover = s.held.confirm || s.held.guard || s.held.jab;
          break;
        case 'tap':
        default:
          cmd.recover =
            s.pressed.jab || s.pressed.cross || s.pressed.leadHook || s.pressed.rearHook || s.pressed.confirm;
          break;
      }
    }
    return cmd;
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  protected handleInput(s: InputSnapshot): void {
    if (this.finished) return;

    // A controller vanishing mid-round pauses safely rather than leaving the
    // fighter walking into the ropes.
    if (this.ctx.input.takeDisconnect() && !this.paused) {
      this.openPause(true);
    }

    if (this.paused) {
      if (this.pauseMenu) {
        const d = this.navDelta(s);
        if (d !== 0) {
          this.pauseMenu.move(d);
          this.sfx('menu_move');
        }
        if (s.pressed.confirm) {
          this.pauseMenu.confirm();
          this.sfx('menu_confirm');
        }
        if (s.pressed.pause || s.pressed.cancel) this.closePause();
      }
      return;
    }

    if (s.pressed.pause) {
      this.openPause(false);
      return;
    }

    const dt = Math.min(this.game.loop.delta, 250);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < MAX_CATCHUP && !this.sim.isComplete) {
      this.accumulator -= STEP_MS;
      steps++;
      this.step(s);
    }
    // A long stall must not leave the simulation permanently behind.
    if (steps >= MAX_CATCHUP) this.accumulator = 0;

    this.renderFrame();

    if (this.sim.isComplete && !this.finished) this.finish();
  }

  private step(s: InputSnapshot): void {
    const player = this.playerCommand(s);
    const aiView = publicView(
      this.sim.state,
      this.aiCorner,
      this.request.config.ruleset.rounds,
      this.request.config.ruleset.roundTicks,
    );
    const aiCmd = this.ai.decide(aiView);

    const cmds: [FighterCommand, FighterCommand] =
      this.request.playerCorner === 0 ? [player, aiCmd] : [aiCmd, player];

    const events = this.sim.tick(cmds);
    for (const e of events) this.onEvent(e);
  }

  private onEvent(e: BoutEvent): void {
    const audio = this.ctx.audio;
    switch (e.type) {
      case 'round_start':
        audio.play('bell_single');
        this.hud.showRoundStats(false, [this.sim.stats(0), this.sim.stats(1)]);
        break;
      case 'round_end':
        audio.play('bell_single');
        this.hud.showRoundStats(true, [this.sim.stats(0), this.sim.stats(1)]);
        break;
      case 'punch_thrown':
        break;
      case 'punch_result': {
        if (e.quality === 'miss' || e.quality === 'slipped') {
          audio.play('whiff', 0.8);
          break;
        }
        if (e.quality === 'blocked') {
          audio.play('block', 0.9);
          this.ring.impact(e.x, e.z, 0.2, 'blocked');
          break;
        }
        const heavy = e.severity > 0.3;
        if (e.quality === 'counter') audio.play('counter', 0.9 + e.severity * 0.4);
        else if (e.level === 'head') audio.play(heavy ? 'hit_head_heavy' : 'hit_head_light', 0.7 + e.severity);
        else audio.play(heavy ? 'hit_body_heavy' : 'hit_body_light', 0.7 + e.severity);

        this.ring.impact(e.x, e.z, e.severity, e.quality === 'counter' ? 'counter' : e.quality === 'glancing' ? 'glancing' : 'clean');
        this.ring.flashFighter(e.corner === 0 ? 1 : 0, Math.min(0.7, e.severity + 0.15));
        if (e.severity > 0.45) audio.play('crowd_pop', e.severity);
        break;
      }
      case 'guard_break':
        audio.play('guard_break');
        break;
      case 'knockdown':
        audio.play('knockdown');
        break;
      case 'count':
        audio.play('count');
        break;
      case 'rise':
        audio.play('rise');
        break;
      case 'rope_pressure':
        audio.play('rope', 0.6);
        break;
      case 'clinch_start':
      case 'clinch_break':
        audio.play('footwork');
        break;
      case 'bout_end': {
        const won = e.outcome.winner === this.request.playerCorner;
        audio.play('bell_triple');
        this.time.delayedCall(600, () => audio.play(won ? 'victory' : 'defeat'));
        break;
      }
      default:
        break;
    }
  }

  private renderFrame(): void {
    // Hitstop holds the picture for a few frames without touching the
    // simulation or the input sampler.
    if (this.ring.hitstopTicks > 0) return;

    const startups: [number, number] = [0, 1].map((i) => {
      const f = this.sim.state.fighters[i as 0 | 1];
      if (!f.activePunch) return 8;
      const p = getPunch(f.activePunch, f.activeLevel);
      return Math.max(2, Math.round(p.startupTicks * this.sim.derived[i as 0 | 1].startupScale));
    }) as [number, number];
    const recoveries: [number, number] = [0, 1].map((i) => {
      const f = this.sim.state.fighters[i as 0 | 1];
      if (!f.activePunch) return 12;
      const p = getPunch(f.activePunch, f.activeLevel);
      return Math.max(2, Math.round(p.recoveryTicks * this.sim.derived[i as 0 | 1].recoveryScale));
    }) as [number, number];

    this.ring.render(this.sim.state, startups, recoveries);
    this.hud.update(this.sim.state, this.request.config.ruleset);

    // Crowd bed follows the action, re-set only when it moves meaningfully.
    const energy = Math.round(this.ring.energy * 8) / 8;
    if (energy !== this.crowdBedLevel) {
      this.crowdBedLevel = energy;
      this.ctx.audio.startCrowdBed(energy);
    }

    // Recovery prompt.
    const player = this.sim.state.fighters[this.request.playerCorner];
    if (player.state === 'knockdown') {
      const mode = this.ctx.settings.accessibility.riseAssist;
      const msg =
        mode === 'auto'
          ? t('bout.autoRise')
          : mode === 'hold'
            ? t('bout.hold', 'Enter')
            : t('bout.mash', 'J');
      if (!this.lastFooter) {
        this.lastFooter = label(this, VIEW.width / 2, 196, '', { size: 10, colour: UI.accent, align: 'center' }).setDepth(60);
        this.lastFooter.setOrigin(0.5, 0);
      }
      // A visible progress bar so the player can see recovery working.
      this.lastFooter.setText(`${t('bout.getUp')}  ${msg}  [${'█'.repeat(Math.round(player.riseProgress * 10)).padEnd(10, '·')}]`);
    } else if (this.lastFooter) {
      this.lastFooter.destroy();
      this.lastFooter = null;
    }

    if (this.debugText) {
      const d = this.ai.debugInfo;
      this.debugText.setText(
        `AI  plan:${d.plan}  action:${d.action}\n` +
          `range ${d.actualRange.toFixed(0)} → ${d.targetRange.toFixed(0)}  conf ${(d.confidence * 100).toFixed(0)}%\n` +
          `why:${d.reason}  next in ${d.ticksToNextDecision}t\n` +
          d.considered.map((c) => `  ${c.action} ${c.utility}`).join('\n'),
      );
    }
  }

  // -------------------------------------------------------------------------
  // Pause
  // -------------------------------------------------------------------------

  private openPause(fromDisconnect: boolean): void {
    if (this.paused) return;
    this.paused = true;
    this.sfx('menu_back');

    const w = 240;
    const h = 132;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    const shade = this.add.graphics().setDepth(70);
    shade.fillStyle(0x000000, 0.74);
    shade.fillRect(0, 0, VIEW.width, VIEW.height);
    const p = panel(this, x, y, w, h, 'bout.paused').setDepth(71);
    this.pauseLayer = [shade, p];

    if (fromDisconnect) {
      this.padWarning = label(this, x + 12, y + 22, `${t('bout.padLost')}\n${t('bout.padLostHint')}`, {
        size: 8,
        colour: UI.warn,
        wrap: w - 24,
      }).setDepth(72);
      this.pauseLayer.push(this.padWarning);
    }

    this.pauseMenu = new Menu(this, { x: x + 10, y: y + (fromDisconnect ? 58 : 30), width: w - 20, rowHeight: 16 });
    this.pauseMenu.setItems([
      { text: t('menu.resume'), onSelect: () => this.closePause() },
      {
        text: t('settings.screenShake'),
        value: () => (this.ctx.settings.accessibility.screenShake ? t('settings.on') : t('settings.off')),
        onSelect: () => {
          const a = this.ctx.settings.accessibility;
          a.screenShake = !a.screenShake;
          this.applyRenderOptions();
          this.ctx.applySettings();
          this.pauseMenu?.refresh();
        },
      },
      {
        text: t('settings.reducedMotion'),
        value: () => (this.ctx.settings.accessibility.reducedMotion ? t('settings.on') : t('settings.off')),
        onSelect: () => {
          const a = this.ctx.settings.accessibility;
          a.reducedMotion = !a.reducedMotion;
          this.applyRenderOptions();
          this.ctx.applySettings();
          this.pauseMenu?.refresh();
        },
      },
      { text: t('menu.quit'), colour: UI.bad, onSelect: () => this.abandon() },
    ]);
  }

  private applyRenderOptions(): void {
    const a = this.ctx.settings.accessibility;
    this.ring.setOptions({
      screenShake: a.screenShake && !a.reducedMotion,
      hitFlash: a.hitFlash,
      reducedMotion: a.reducedMotion,
      colorSafe: a.colorSafe,
      showHitboxes: a.showFrameData,
    });
    this.hud.setColorSafe(a.colorSafe);
  }

  private closePause(): void {
    this.paused = false;
    this.accumulator = 0;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    for (const o of this.pauseLayer) o.destroy();
    this.pauseLayer = [];
    this.padWarning = null;
    this.sfx('menu_confirm');
  }

  /** Leaving a bout early forfeits it; the career must not be left mid-fight. */
  private abandon(): void {
    this.finished = true;
    this.ctx.audio.stopCrowdBed();
    this.closePause();
    this.ctx.pendingBout = null;
    this.go(this.request.offer ? 'CareerHub' : 'MainMenu');
  }

  private finish(): void {
    this.finished = true;
    this.ctx.audio.stopCrowdBed();
    const outcome = this.sim.state.outcome!;
    this.request.outcome = outcome;
    this.request.stats = [this.sim.stats(0), this.sim.stats(1)];
    // A beat before the result screen so the final moment can land.
    this.time.delayedCall(1400, () => this.go('Result'));
  }

  override shutdown(): void {
    this.ring?.destroy();
    this.hud?.destroy();
    this.pauseMenu?.destroy();
    this.ctx.audio.stopCrowdBed();
  }
}
