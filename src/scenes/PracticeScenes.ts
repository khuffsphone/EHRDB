/**
 * Exhibition setup and the Training Lab.
 *
 * The lab runs the same authoritative simulation as a real bout — nothing is
 * simplified — with the frame-state readout, hitbox display and input display
 * turned on, and a partner whose behaviour the player chooses.
 */
import Phaser from 'phaser';
import { BaseScene } from '@game/BaseScene';
import { Menu, VIEW, label, panel } from '@ui/kit';
import { UI } from '@art/palettes';
import { t } from '@ui/strings';
import { ROSTER, getFighter } from '@data/fighters';
import { VENUES } from '@data/venues';
import { makeRuleset } from '@data/rulesets';
import { getPunch } from '@data/punches';
import { PUNCH_IDS, emptyCommand, type FighterCommand, type FighterDefinition } from '@sim/types';
import { BoutSim } from '@sim/bout';
import { publicView } from '@sim/view';
import { AiController } from '@ai/controller';
import { DIFFICULTIES } from '@ai/profiles';
import { RingRenderer } from '@game/RingRenderer';
import { drawBoxer, POSES } from '@art/boxer';
import { BoutHud } from '@game/BoutHud';
import type { InputSnapshot } from '@input/manager';

export class ExhibitionScene extends BaseScene {
  static readonly KEY = 'Exhibition';
  private menu!: Menu;
  private previewG!: Phaser.GameObjects.Graphics;

  constructor() {
    super(ExhibitionScene.KEY);
  }

  create(): void {
    this.paintBackground('exhibition.title');
    panel(this, 40, 40, 300, 250);
    panel(this, 350, 40, 250, 250);
    this.previewG = this.add.graphics();

    this.menu = new Menu(this, { x: 52, y: 60, width: 276, rowHeight: 20, size: 10, hintY: 262, onFocusChange: () => this.preview() });
    this.rebuild();
    this.preview();
    this.navFooter('←→ Change');
  }

  private cycleFighter(which: 'aId' | 'bId', d: number): void {
    const ids = ROSTER.map((r) => r.id);
    const i = ids.indexOf(this.ctx.exhibition[which]);
    this.ctx.exhibition[which] = ids[(i + d + ids.length) % ids.length];
    this.preview();
  }

  private rebuild(): void {
    const e = this.ctx.exhibition;
    this.menu.setItems([
      {
        text: t('exhibition.fighterA'),
        value: () => getFighter(e.aId).displayName,
        onAdjust: (d) => this.cycleFighter('aId', d),
        onSelect: () => this.cycleFighter('aId', 1),
      },
      {
        text: t('exhibition.fighterB'),
        value: () => getFighter(e.bId).displayName,
        onAdjust: (d) => this.cycleFighter('bId', d),
        onSelect: () => this.cycleFighter('bId', 1),
      },
      {
        text: t('exhibition.rounds'),
        value: () => String(e.rounds),
        onAdjust: (d) => {
          const list = [3, 6, 10] as const;
          const i = list.indexOf(e.rounds);
          e.rounds = list[(i + d + list.length) % list.length];
        },
        onSelect: () => undefined,
      },
      {
        text: t('exhibition.venue'),
        value: () => t(VENUES.find((v) => v.id === e.venueId)!.nameKey),
        onAdjust: (d) => {
          const i = VENUES.findIndex((v) => v.id === e.venueId);
          e.venueId = VENUES[(i + d + VENUES.length) % VENUES.length].id;
        },
        onSelect: () => undefined,
      },
      { text: '', heading: true },
      { text: t('exhibition.start'), colour: UI.accent, onSelect: () => this.start() },
      { text: t('menu.back'), onSelect: () => this.go('MainMenu') },
    ]);
  }

  private preview(): void {
    const e = this.ctx.exhibition;
    const a = getFighter(e.aId);
    const b = getFighter(e.bId);
    this.previewG.clear();
    // Drawn with the same rig used in the ring.
    for (const [x, def, flip] of [
      [420, a, 1],
      [530, b, -1],
    ] as const) {
      this.previewG.save();
      this.previewG.translateCanvas(x, 230);
      this.previewG.scaleCanvas(2.0 * flip, 2.0);
      drawBoxer(this.previewG, POSES.guard, def.appearance, {});
      this.previewG.restore();
    }
    this.nameA?.destroy();
    this.nameB?.destroy();
    this.nameA = label(this, 420, 250, a.displayName, { size: 8, colour: UI.text, align: 'center' });
    this.nameB = label(this, 530, 250, b.displayName, { size: 8, colour: UI.text, align: 'center' });
  }

  private nameA: Phaser.GameObjects.Text | null = null;
  private nameB: Phaser.GameObjects.Text | null = null;

  private start(): void {
    const e = this.ctx.exhibition;
    if (e.aId === e.bId) {
      this.sfx('menu_error');
      this.showNotice('Choose two different fighters.');
      return;
    }
    this.ctx.pendingBout = {
      config: {
        seed: (Date.now() ^ 0x5f3a) >>> 0,
        ruleset: makeRuleset(e.rounds, 'broadcast'),
        venueId: e.venueId,
        fighters: [getFighter(e.aId), getFighter(e.bId)],
      },
      offer: null,
      playerCorner: 0,
      returnScene: ExhibitionScene.KEY,
    };
    this.sfx('menu_confirm');
    this.go('Bout');
  }

  protected handleInput(s: InputSnapshot): void {
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    const a = this.adjustDelta(s);
    if (a !== 0) {
      this.menu.adjust(a);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) this.menu.confirm();
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      this.go('MainMenu');
    }
  }
}

// ---------------------------------------------------------------------------

type DummyMode = 'idle' | 'guard' | 'crouch' | 'counter' | 'live';

/**
 * The Training Lab.
 *
 * Runs the real simulation with an infinite round so the player can work on
 * spacing and timing, with everything the combat model does made visible.
 */
export class LabScene extends BaseScene {
  static readonly KEY = 'Lab';

  private sim!: BoutSim;
  private ring!: RingRenderer;
  private hud!: BoutHud;
  private ai!: AiController;
  private mode: DummyMode = 'guard';
  private accumulator = 0;
  private frameText!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private guardToggle = false;

  constructor() {
    super(LabScene.KEY);
  }

  create(): void {
    const player = this.ctx.career?.player ?? this.ctx.lastCreated ?? getFighter('nikolai_vasque');
    const partner = getFighter('rook_maddox');
    this.buildSim(player, partner);

    const a11y = this.ctx.settings.accessibility;
    this.ring = new RingRenderer(this, 'ironworks', [player.appearance, partner.appearance], {
      screenShake: a11y.screenShake && !a11y.reducedMotion,
      hitFlash: a11y.hitFlash,
      reducedMotion: a11y.reducedMotion,
      colorSafe: a11y.colorSafe,
      // The lab always shows hitboxes; that is the point of it.
      showHitboxes: true,
    });
    this.hud = new BoutHud(this, [player, partner], 0, a11y.colorSafe);

    // Move list with real frame data, read from the punch table itself.
    const lines = PUNCH_IDS.map((id) => {
      const p = getPunch(id, 'head');
      return `${t(p.nameKey).padEnd(14)} ${String(p.startupTicks).padStart(2)}/${p.activeTicks}/${String(p.recoveryTicks).padStart(2)}  reach ${p.reach}`;
    });
    panel(this, 8, 96, 210, 100, 'lab.moveList');
    label(this, 16, 112, `${'move'.padEnd(14)} s/a/r`.padEnd(20) + '\n' + lines.join('\n'), {
      size: 7,
      colour: UI.textDim,
    }).setDepth(50);

    panel(this, VIEW.width - 218, 96, 210, 100, 'lab.frameData');
    this.frameText = label(this, VIEW.width - 210, 112, '', { size: 7, colour: UI.text }).setDepth(50);

    this.inputText = label(this, VIEW.width - 210, 176, '', { size: 7, colour: UI.textDim, wrap: 194 }).setDepth(50);
    this.modeText = label(this, VIEW.width / 2, VIEW.height - 30, '', { size: 9, colour: UI.accent, align: 'center' }).setDepth(50);
    this.updateModeText();

    this.showFooter('1-5 Partner behaviour   R Reset positions   Backspace Back');
  }

  private buildSim(player: FighterDefinition, partner: FighterDefinition): void {
    // A very long single round: the lab should never end on its own.
    const ruleset = { ...makeRuleset(3, 'championship'), rounds: 1, roundTicks: 60 * 60 * 60, refereeStoppage: false };
    this.sim = new BoutSim({ seed: 1, ruleset, venueId: 'ironworks', fighters: [player, partner] });
    this.ai = new AiController(1, partner.style.archetype, DIFFICULTIES[this.ctx.settings.difficulty], 'lab');
  }

  private updateModeText(): void {
    this.modeText.setText(`${t('lab.dummy')}: ${t(`lab.dummy.${this.mode}`)}    ${t('lab.hint')}`);
  }

  private partnerCommand(): FighterCommand {
    const cmd = emptyCommand();
    const me = this.sim.state.fighters[1];
    const you = this.sim.state.fighters[0];
    switch (this.mode) {
      case 'idle':
        break;
      case 'guard':
        cmd.guard = true;
        break;
      case 'crouch':
        cmd.crouch = true;
        break;
      case 'counter': {
        // Answers whatever you just threw, at the same range.
        cmd.guard = true;
        if (you.state === 'punch_recover' && you.stateTicks < 4) cmd.punch = 'cross';
        break;
      }
      case 'live':
        return this.ai.decide(publicView(this.sim.state, 1, 1, 60 * 60 * 60));
    }
    // Hold a workable distance so the player is not chasing a mannequin.
    const gap = Math.abs(you.x - me.x);
    if (gap > 70) cmd.moveX = 1;
    else if (gap < 26) cmd.moveX = -1;
    return cmd;
  }

  private playerCommand(s: InputSnapshot): FighterCommand {
    const cmd = emptyCommand();
    const me = this.sim.state.fighters[0];
    const a11y = this.ctx.settings.accessibility;
    cmd.moveX = ((s.held.right ? 1 : 0) - (s.held.left ? 1 : 0)) * me.facing;
    cmd.moveZ = (s.held.down ? 1 : 0) - (s.held.up ? 1 : 0);
    if (a11y.holdToGuard) cmd.guard = s.held.guard;
    else {
      if (s.pressed.guard) this.guardToggle = !this.guardToggle;
      cmd.guard = this.guardToggle;
    }
    cmd.crouch = s.held.crouch;
    const upper = s.held.uppercutMod;
    if (s.pressed.jab) cmd.punch = 'jab';
    else if (s.pressed.cross) cmd.punch = 'cross';
    else if (s.pressed.leadHook) cmd.punch = upper ? 'lead_upper' : 'lead_hook';
    else if (s.pressed.rearHook) cmd.punch = upper ? 'rear_upper' : 'rear_hook';
    if (s.pressed.slip) cmd.slip = cmd.moveZ !== 0 ? cmd.moveZ : 1;
    cmd.clinch = s.held.clinch;
    cmd.recover = s.pressed.jab || s.pressed.confirm;
    return cmd;
  }

  protected handleInput(s: InputSnapshot): void {
    // Partner behaviour hotkeys.
    const modes: DummyMode[] = ['idle', 'guard', 'crouch', 'counter', 'live'];
    for (let i = 0; i < modes.length; i++) {
      if (this.input.keyboard?.checkDown(this.input.keyboard.addKey(49 + i), 400)) {
        if (this.mode !== modes[i]) {
          this.mode = modes[i];
          this.updateModeText();
          this.sfx('menu_move');
        }
      }
    }
    if (this.input.keyboard?.checkDown(this.input.keyboard.addKey('R'), 500)) this.reset();

    if (s.pressed.cancel) {
      this.sfx('menu_back');
      this.go('MainMenu');
      return;
    }

    const dt = Math.min(this.game.loop.delta, 250);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= 1000 / 60 && steps < 8) {
      this.accumulator -= 1000 / 60;
      steps++;
      const cmds: [FighterCommand, FighterCommand] = [this.playerCommand(s), this.partnerCommand()];
      const events = this.sim.tick(cmds);
      for (const e of events) {
        if (e.type === 'punch_result') {
          if (e.quality === 'miss' || e.quality === 'slipped') this.ctx.audio.play('whiff');
          else if (e.quality === 'blocked') {
            this.ctx.audio.play('block');
            this.ring.impact(e.x, e.z, 0.2, 'blocked');
          } else {
            this.ctx.audio.play(e.level === 'head' ? 'hit_head_light' : 'hit_body_light', 0.7 + e.severity);
            this.ring.impact(e.x, e.z, e.severity, e.quality === 'counter' ? 'counter' : 'clean');
          }
        }
      }
    }
    if (steps >= 8) this.accumulator = 0;

    this.renderFrame(s);
  }

  private reset(): void {
    const st = this.sim.state;
    st.fighters[0].x = -46;
    st.fighters[1].x = 46;
    st.fighters[0].z = 0;
    st.fighters[1].z = 0;
    st.fighters[0].composure = st.fighters[0].resilienceMax;
    st.fighters[1].composure = st.fighters[1].resilienceMax;
    st.fighters[0].resilience = st.fighters[0].resilienceMax;
    st.fighters[1].resilience = st.fighters[1].resilienceMax;
    st.fighters[0].exertion = 0;
    st.fighters[1].exertion = 0;
    st.fighters[0].headTrauma = 0;
    st.fighters[0].bodyTrauma = 0;
    st.fighters[1].headTrauma = 0;
    st.fighters[1].bodyTrauma = 0;
    this.sfx('menu_confirm');
  }

  private renderFrame(s: InputSnapshot): void {
    const f = this.sim.state.fighters[0];
    const startup = f.activePunch ? getPunch(f.activePunch, f.activeLevel).startupTicks : 8;
    const recovery = f.activePunch ? getPunch(f.activePunch, f.activeLevel).recoveryTicks : 12;
    this.ring.render(this.sim.state, [startup, 8], [recovery, 12]);
    this.hud.update(this.sim.state, { rounds: 1, roundTicks: 60 * 60 * 60 });

    // Live frame-state readout.
    const punch = f.activePunch ? getPunch(f.activePunch, f.activeLevel) : null;
    const sep = Math.abs(this.sim.state.fighters[1].x - f.x);
    this.frameText.setText(
      `state    ${f.state} (${f.stateTicks}t)\n` +
        `commit   ${f.commitTicks}t\n` +
        `punch    ${f.activePunch ? `${f.activePunch}/${f.activeLevel}` : '—'}\n` +
        (punch ? `frames   ${punch.startupTicks}/${punch.activeTicks}/${punch.recoveryTicks}  reach ${punch.reach}\n` : 'frames   —\n') +
        `range    ${sep.toFixed(0)}   balance ${f.balance.toFixed(2)}\n` +
        `buffer   ${f.bufferedPunch ?? '—'}`,
    );

    const pressed = (Object.keys(s.held) as (keyof typeof s.held)[]).filter((k) => s.held[k]);
    this.inputText.setText(`${t('lab.inputDisplay')}: ${pressed.join(' ') || '—'}`);
  }

  override shutdown(): void {
    this.ring?.destroy();
    this.hud?.destroy();
  }
}
