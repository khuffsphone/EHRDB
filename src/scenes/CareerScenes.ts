/**
 * The career loop: camp, opponent selection, tale of the tape, the result,
 * training camp, incoming challenges and retirement.
 */
import Phaser from 'phaser';
import { BaseScene } from '@game/BaseScene';
import { Menu, VIEW, bar, label, panel, confirmDialog } from '@ui/kit';
import { UI } from '@art/palettes';
import { drawBoxer, POSES } from '@art/boxer';
import { money, ratingCode, record, t } from '@ui/strings';
import { getFighter } from '@data/fighters';
import { getVenue } from '@data/venues';
import {
  acceptChallenge,
  boutConfigFor,
  boutsRemaining,
  describeBout,
  finishTraining,
  legalOpponents,
  refuseChallenge,
  resolveBout,
  retire,
  scaledOpponent,
  takeTraining,
  toLegacyRecord,
  UNRANKED,
} from '@career/career';
import { CAREER_RULES } from '@career/types';
import type { InputSnapshot } from '@input/manager';
import type { CareerState } from '@career/types';

function rankLabel(c: CareerState): string {
  if (c.isChampion) return t('career.champion');
  return c.playerRank >= UNRANKED ? t('career.unranked') : `#${c.playerRank}`;
}

/** Guards against reaching a career screen with no career loaded. */
function requireCareer(scene: BaseScene, ctx: { career: CareerState | null }): CareerState | null {
  if (!ctx.career) {
    scene.scene.start('MainMenu');
    return null;
  }
  return ctx.career;
}

// ---------------------------------------------------------------------------

export class CareerHubScene extends BaseScene {
  static readonly KEY = 'CareerHub';
  private menu!: Menu;
  private dialog: { menu: Menu; destroy: () => void } | null = null;

  constructor() {
    super(CareerHubScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;

    // Route straight to whatever the career is actually waiting on.
    if (c.ending) {
      this.scene.start('Retirement');
      return;
    }
    if (c.phase === 'training') {
      this.scene.start('Training');
      return;
    }
    if (c.phase === 'challenge') {
      this.scene.start('Challenge');
      return;
    }

    this.paintBackground('career.hub', c.player.displayName);
    this.ctx.audio.playMusic('menu');

    panel(this, 16, 40, 214, 200, 'career.record');
    panel(this, 238, 40, 180, 200);
    panel(this, 426, 40, 198, 200, 'career.news');
    panel(this, 16, 248, 608, 66);

    this.drawStatus(c);
    this.drawFighter(c);
    this.drawNews(c);

    this.menu = new Menu(this, { x: 26, y: 266, width: 588, rowHeight: 16, size: 10 });
    this.menu.setItems([
      { text: t('career.nextFight'), colour: UI.accent, onSelect: () => this.go('OpponentSelect') },
      { text: t('career.rankings'), onSelect: () => this.go('Rankings') },
      { text: t('career.retire'), colour: UI.bad, onSelect: () => this.askRetire() },
      { text: t('menu.quit'), onSelect: () => { this.ctx.persist(); this.go('MainMenu'); } },
    ]);
    this.navFooter();
    this.ctx.persist();
  }

  private drawStatus(c: CareerState): void {
    const rows: [string, string][] = [
      [t('career.rank'), rankLabel(c)],
      [t('career.record'), record(c.wins, c.losses, c.draws, c.kos)],
      [t('career.stage'), t(`stage.${c.stage}`)],
      [t('career.boutsLeft'), `${boutsRemaining(c)} of ${CAREER_RULES.maxBouts}`],
      [t('career.earnings'), money(c.earnings)],
      [t('retirement.defences'), String(c.titleDefences)],
    ];
    rows.forEach(([k, v], i) => {
      label(this, 26, 62 + i * 18, k, { size: 9, colour: UI.textDim });
      label(this, 220, 62 + i * 18, v, { size: 9, colour: UI.text, align: 'right' });
    });

    // Career clock: a visible bar so decline is never a surprise.
    const g = this.add.graphics();
    label(this, 26, 176, 'Career Clock', { size: 8, colour: UI.textDim });
    bar(g, 26, 188, 194, 7, c.boutIndex / CAREER_RULES.maxBouts, UI.accent, {});
    const ageMark = 26 + (CAREER_RULES.agingStartsAt / CAREER_RULES.maxBouts) * 194;
    g.fillStyle(UI.bad, 1);
    g.fillRect(ageMark - 1, 186, 2, 11);
    label(this, 26, 200, c.boutIndex >= CAREER_RULES.agingStartsAt ? 'Decline has begun.' : 'Decline begins at the marker.', {
      size: 7,
      colour: c.boutIndex >= CAREER_RULES.agingStartsAt ? UI.bad : UI.textDim,
    });

    const ratings = ['power', 'stamina', 'speed', 'defense'] as const;
    ratings.forEach((k, i) => {
      label(this, 26, 214 + i * 0, '', { size: 7 });
      bar(g, 26 + i * 50, 216, 44, 6, c.player.ratings[k] / 100, UI.stamina, {});
      label(this, 26 + i * 50, 224, ratingCode(k), { size: 7, colour: UI.textDim });
    });
  }

  private drawFighter(c: CareerState): void {
    const g = this.add.graphics();
    g.save();
    g.translateCanvas(328, 214);
    g.scaleCanvas(2.6, 2.6);
    drawBoxer(g, POSES.guard, c.player.appearance, { colorSafe: this.ctx.settings.accessibility.colorSafe });
    g.restore();
    label(this, 328, 48, c.player.displayName, { size: 10, colour: UI.text, align: 'center' });
    if (c.player.nickname) {
      label(this, 328, 62, `"${c.player.nickname}"`, { size: 8, colour: UI.accent, align: 'center' });
    }
  }

  private drawNews(c: CareerState): void {
    if (c.news.length === 0) {
      label(this, 436, 62, 'Nothing to report.', { size: 8, colour: UI.textDim });
      return;
    }
    c.news.slice(0, 8).forEach((n, i) => {
      const [key, ...args] = n.split('|');
      const names = args.map((a) => {
        try {
          return getFighter(a).displayName;
        } catch {
          return a;
        }
      });
      label(this, 436, 62 + i * 20, `· ${t(key, ...names)}`, { size: 8, colour: UI.textDim, wrap: 180 });
    });
  }

  private askRetire(): void {
    if (this.dialog) return;
    this.modalOpen = true;
    this.dialog = confirmDialog(
      this,
      t('career.retireConfirm'),
      () => {
        const c = this.ctx.career!;
        retire(c, 'ending.voluntary');
        this.ctx.persist();
        this.closeDialog();
        this.go('Retirement');
      },
      () => this.closeDialog(),
    );
  }

  private closeDialog(): void {
    this.dialog?.destroy();
    this.dialog = null;
    this.modalOpen = false;
  }

  protected handleInput(s: InputSnapshot): void {
    const active = this.dialog?.menu ?? this.menu;
    if (!active) return;
    const d = this.navDelta(s);
    if (d !== 0) {
      active.move(d);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) {
      this.sfx('menu_confirm');
      active.confirm();
    }
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      if (this.dialog) this.closeDialog();
    }
  }
}

// ---------------------------------------------------------------------------

export class RankingsScene extends BaseScene {
  static readonly KEY = 'Rankings';
  constructor() {
    super(RankingsScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;
    this.paintBackground('career.rankings');
    panel(this, 24, 40, 592, 276);

    const heads = ['Rank', 'Fighter', 'Style', 'Record', 'Form'];
    const xs = [40, 96, 262, 400, 500];
    heads.forEach((h, i) => label(this, xs[i], 54, h, { size: 8, colour: UI.accent, bold: true }));

    const rows = c.ladder
      .filter((e) => !e.retired)
      .map((e) => ({ ...e, name: getFighter(e.fighterId).displayName, arch: getFighter(e.fighterId).style.archetype }))
      .concat([
        {
          fighterId: 'player',
          rank: c.playerRank,
          wins: c.wins,
          losses: c.losses,
          draws: c.draws,
          kos: c.kos,
          bouts: c.boutIndex,
          age: 0,
          form: c.history.slice(-5).map((h) => (h.result === 'win' ? 'W' : h.result === 'loss' ? 'L' : 'D')),
          retired: false,
          earnings: c.earnings,
          wear: c.wear,
          name: c.player.displayName,
          arch: c.player.style.archetype,
        },
      ])
      .sort((a, b) => a.rank - b.rank);

    rows.forEach((e, i) => {
      const y = 70 + i * 19;
      const isPlayer = e.fighterId === 'player';
      const colour = isPlayer ? UI.accent : UI.text;
      if (isPlayer) {
        const g = this.add.graphics();
        g.fillStyle(UI.raised, 1);
        g.fillRect(32, y - 3, 576, 18);
      }
      label(this, xs[0], y, e.rank === 1 ? '★ 1' : `${e.rank}`, { size: 9, colour });
      label(this, xs[1], y, isPlayer ? `${e.name} (you)` : e.name, { size: 9, colour });
      label(this, xs[2], y, t(`archetype.${e.arch}`), { size: 8, colour: UI.textDim });
      label(this, xs[3], y, record(e.wins, e.losses, e.draws, e.kos), { size: 8, colour: UI.textDim });
      label(this, xs[4], y, e.form.slice(-5).join(' ') || '—', { size: 8, colour: UI.textDim });
    });

    this.showFooter('Backspace  Back');
  }

  protected handleInput(s: InputSnapshot): void {
    if (s.pressed.cancel || s.pressed.confirm) {
      this.sfx('menu_back');
      this.go('CareerHub');
    }
  }
}

// ---------------------------------------------------------------------------

export class OpponentSelectScene extends BaseScene {
  static readonly KEY = 'OpponentSelect';
  private menu!: Menu;
  private detail!: Phaser.GameObjects.Text;
  private detailG!: Phaser.GameObjects.Graphics;
  private ids: string[] = [];

  constructor() {
    super(OpponentSelectScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;
    this.paintBackground('opponent.select', `${t('career.rank')} ${rankLabel(c)}`);

    this.ids = c.offeredOpponents.length > 0 ? c.offeredOpponents : legalOpponents(c);
    panel(this, 16, 40, 250, 276);
    panel(this, 276, 40, 348, 276);
    this.detailG = this.add.graphics();
    this.detail = label(this, 288, 190, '', { size: 9, colour: UI.text, wrap: 326 });

    this.menu = new Menu(this, {
      x: 26, y: 60, width: 230, rowHeight: 22, size: 10,
      onFocusChange: () => this.drawDetail(),
    });
    this.menu.setItems(
      this.ids.map((id) => {
        const offer = describeBout(c, id);
        return {
          text: `#${offer.opponentRank}  ${offer.opponentName}`,
          value: () => (offer.titleBout ? '★' : ''),
          colour: offer.titleBout ? UI.accent : undefined,
          onSelect: () => {
            this.ctx.pendingOpponentId = id;
            this.sfx('menu_confirm');
            this.go('PreFight');
          },
        };
      }),
    );
    this.drawDetail();
    this.navFooter();
  }

  private drawDetail(): void {
    const c = this.ctx.career!;
    const id = this.ids[this.menu.focusedIndex];
    if (!id) return;
    const offer = describeBout(c, id);
    const def = scaledOpponent(c, id);
    const entry = c.ladder.find((e) => e.fighterId === id)!;

    this.detailG.clear();
    this.detailG.save();
    this.detailG.translateCanvas(560, 160);
    this.detailG.scaleCanvas(2.0, 2.0);
    drawBoxer(this.detailG, POSES.guard, def.appearance, { colorSafe: this.ctx.settings.accessibility.colorSafe });
    this.detailG.restore();

    const ratings = ['power', 'stamina', 'speed', 'defense'] as const;
    ratings.forEach((k, i) => {
      bar(this.detailG, 288, 120 + i * 13, 110, 7, def.ratings[k] / 100, UI.accent, {});
    });

    this.detail.setText(
      `${t('opponent.style')}: ${t(`archetype.${def.style.archetype}`)}\n` +
        `${t('opponent.record')}: ${record(entry.wins, entry.losses, entry.draws, entry.kos)}\n\n` +
        `${t('opponent.rounds')}: ${offer.rounds}      ${t('opponent.purse')}: ${money(offer.purse)}\n` +
        `${t('opponent.ifWin')}: ${offer.rankIfWin === c.playerRank ? t('opponent.rankHold', c.playerRank) : t('opponent.rankTo', c.playerRank, offer.rankIfWin)}\n` +
        `${t('opponent.ifLoss')}: ${offer.rankIfLoss === c.playerRank ? t('opponent.rankHold', c.playerRank) : t('opponent.rankTo', c.playerRank, offer.rankIfLoss)}\n\n` +
        `${t(getFighter(id).scoutKey)}`,
    );

    this.detailTitle?.destroy();
    this.detailTitle = label(this, 288, 52, offer.titleBout ? `${offer.opponentName}  ·  ${t('opponent.titleBout')}` : offer.opponentName, {
      size: 12,
      colour: offer.titleBout ? UI.accent : UI.text,
    });
    this.ratingLabels?.forEach((l) => l.destroy());
    this.ratingLabels = ratings.map((k, i) =>
      label(this, 404, 119 + i * 13, `${t(`rating.${k}`)} ${Math.round(def.ratings[k])}`, { size: 8, colour: UI.textDim }),
    );
  }

  private detailTitle: Phaser.GameObjects.Text | null = null;
  private ratingLabels: Phaser.GameObjects.Text[] = [];

  protected handleInput(s: InputSnapshot): void {
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) this.menu.confirm();
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      this.go('CareerHub');
    }
  }
}

// ---------------------------------------------------------------------------

export class PreFightScene extends BaseScene {
  static readonly KEY = 'PreFight';
  private menu!: Menu;

  constructor() {
    super(PreFightScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;
    const id = this.ctx.pendingOpponentId;
    if (!id) {
      this.scene.start('OpponentSelect');
      return;
    }
    const offer = describeBout(c, id);
    const opp = scaledOpponent(c, id);
    const venue = getVenue(offer.venueId);

    this.paintBackground('prefight.title', t(venue.nameKey));
    panel(this, 16, 40, 608, 216);

    // Both fighters facing each other.
    const g = this.add.graphics();
    for (const [x, def, flip] of [
      [150, c.player, 1],
      [490, opp, -1],
    ] as const) {
      g.save();
      g.translateCanvas(x, 200);
      g.scaleCanvas(2.6 * flip, 2.6);
      drawBoxer(g, POSES.intro, def.appearance, { colorSafe: this.ctx.settings.accessibility.colorSafe });
      g.restore();
    }

    label(this, 150, 52, c.player.displayName, { size: 11, colour: UI.accent, align: 'center' });
    label(this, 490, 52, opp.displayName, { size: 11, colour: UI.text, align: 'center' });
    label(this, VIEW.width / 2, 52, offer.titleBout ? t('opponent.titleBout') : `${offer.rounds} ROUNDS`, {
      size: 11,
      colour: offer.titleBout ? UI.accent : UI.textDim,
      align: 'center',
    });

    const rows: [string, string, string][] = [
      [record(c.wins, c.losses, c.draws), t('career.record'), record(0, 0, 0)],
      [`${c.player.body.heightCm} cm`, t('prefight.height'), `${opp.body.heightCm} cm`],
      [`${c.player.body.reachCm} cm`, t('prefight.reach'), `${opp.body.reachCm} cm`],
      [`${c.player.body.massKg} kg`, t('prefight.weight'), `${opp.body.massKg} kg`],
      [t(`archetype.${c.player.style.archetype}`), t('opponent.style'), t(`archetype.${opp.style.archetype}`)],
      [rankLabel(c), t('career.rank'), `#${offer.opponentRank}`],
      ['', t('opponent.purse'), money(offer.purse)],
    ];
    const entry = c.ladder.find((e) => e.fighterId === id)!;
    rows[0][2] = record(entry.wins, entry.losses, entry.draws, entry.kos);

    rows.forEach(([l, m, r], i) => {
      const y = 76 + i * 17;
      label(this, 262, y, l, { size: 9, colour: UI.text, align: 'right' });
      label(this, VIEW.width / 2, y, m, { size: 8, colour: UI.textDim, align: 'center' });
      label(this, 378, y, r, { size: 9, colour: UI.text });
    });

    label(this, VIEW.width / 2, 232, t(venue.descriptionKey), { size: 8, colour: UI.textDim, align: 'center' });

    this.menu = new Menu(this, { x: 200, y: 274, width: 240, rowHeight: 18, size: 11 });
    this.menu.setItems([
      { text: t('prefight.begin'), colour: UI.accent, onSelect: () => this.start(id) },
      { text: t('menu.back'), onSelect: () => this.go('OpponentSelect') },
    ]);
    this.navFooter();
  }

  private start(id: string): void {
    const c = this.ctx.career!;
    const cfg = boutConfigFor(c, id);
    this.ctx.pendingBout = {
      config: { seed: cfg.seed, ruleset: cfg.ruleset, venueId: cfg.venueId, fighters: cfg.fighters },
      offer: cfg.offer,
      playerCorner: 0,
      returnScene: 'CareerHub',
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
    if (s.pressed.confirm) this.menu.confirm();
    if (s.pressed.cancel) {
      this.sfx('menu_back');
      this.go('OpponentSelect');
    }
  }
}

// ---------------------------------------------------------------------------

export class ResultScene extends BaseScene {
  static readonly KEY = 'Result';
  private menu!: Menu;

  constructor() {
    super(ResultScene.KEY);
  }

  create(): void {
    const req = this.ctx.pendingBout;
    if (!req?.outcome) {
      this.scene.start('MainMenu');
      return;
    }
    const outcome = req.outcome;
    const playerWon = outcome.winner === req.playerCorner;
    const drew = outcome.winner === null;

    // A career bout is applied to the career exactly once, here.
    let purse = 0;
    let rankBefore = 0;
    let rankAfter = 0;
    if (req.offer && this.ctx.career) {
      const c = this.ctx.career;
      rankBefore = c.playerRank;
      const rec = resolveBout(c, req.offer.opponentId, outcome);
      purse = rec.purse;
      rankAfter = c.playerRank;
      this.ctx.persist();
    }

    this.paintBackground(drew ? 'result.draw' : playerWon ? 'result.winner' : 'result.defeat');
    this.ctx.audio.playMusic('menu');

    panel(this, 16, 40, 300, 200, 'result.scorecards');
    panel(this, 326, 40, 298, 200, 'result.stats');

    label(this, 166, 60, t(outcome.reasonKey), { size: 11, colour: UI.accent, align: 'center' });
    label(this, 166, 78, `Round ${outcome.round}`, { size: 9, colour: UI.textDim, align: 'center' });

    outcome.scorecards.forEach((card, i) => {
      const y = 100 + i * 22;
      label(this, 30, y, t(card.judgeId), { size: 9, colour: UI.textDim });
      const a = card.totals[req.playerCorner];
      const b = card.totals[req.playerCorner === 0 ? 1 : 0];
      label(this, 300, y, `${a} — ${b}`, {
        size: 10,
        colour: a > b ? UI.good : a < b ? UI.bad : UI.text,
        align: 'right',
      });
    });

    const stats = req.stats ?? [
      { thrown: 0, landed: 0, percent: 0 },
      { thrown: 0, landed: 0, percent: 0 },
    ];
    const p = stats[req.playerCorner];
    const o = stats[req.playerCorner === 0 ? 1 : 0];
    const statRows: [string, string, string][] = [
      [String(p.thrown), t('bout.thrown'), String(o.thrown)],
      [String(p.landed), t('bout.landed'), String(o.landed)],
      [`${p.percent}%`, t('bout.percent'), `${o.percent}%`],
    ];
    statRows.forEach(([l, m, r], i) => {
      const y = 74 + i * 20;
      label(this, 440, y, l, { size: 10, colour: UI.text, align: 'right' });
      label(this, 475, y, m, { size: 9, colour: UI.textDim, align: 'center' });
      label(this, 520, y, r, { size: 10, colour: UI.text });
    });

    if (req.offer) {
      label(this, 336, 150, `${t('result.purse')}: ${money(purse)}`, { size: 10, colour: UI.accent });
      label(this, 336, 168, `${t('result.rankChange')}: ${rankBefore >= 9 ? '—' : `#${rankBefore}`} → ${rankAfter >= 9 ? '—' : `#${rankAfter}`}`, {
        size: 10,
        colour: rankAfter < rankBefore ? UI.good : rankAfter > rankBefore ? UI.bad : UI.text,
      });
      const c = this.ctx.career!;
      label(this, 336, 190, `${t('career.record')}: ${record(c.wins, c.losses, c.draws, c.kos)}`, {
        size: 9,
        colour: UI.textDim,
      });
      label(this, 336, 206, t('save.autosaved'), { size: 8, colour: UI.good });
    }

    this.menu = new Menu(this, { x: 200, y: 260, width: 240, rowHeight: 18, size: 11 });
    this.menu.setItems([{ text: t('result.continue'), colour: UI.accent, onSelect: () => this.continue() }]);
    this.navFooter();
  }

  private continue(): void {
    const req = this.ctx.pendingBout!;
    this.ctx.pendingBout = null;
    this.sfx('menu_confirm');
    if (!req.offer) {
      this.go(req.returnScene);
      return;
    }
    const c = this.ctx.career!;
    if (c.ending) this.go('Retirement');
    else this.go('Training');
  }

  protected handleInput(s: InputSnapshot): void {
    if (s.pressed.confirm) this.menu.confirm();
  }
}

// ---------------------------------------------------------------------------

export class TrainingScene extends BaseScene {
  static readonly KEY = 'Training';
  private menu!: Menu;
  private info!: Phaser.GameObjects.Text;
  private header!: Phaser.GameObjects.Text;

  constructor() {
    super(TrainingScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;
    if (c.phase !== 'training') {
      this.scene.start('CareerHub');
      return;
    }

    this.paintBackground('training.title', t(`stage.${c.stage}`));
    panel(this, 16, 40, 358, 262);
    panel(this, 384, 40, 240, 262);

    this.header = label(this, 26, 50, '', { size: 10, colour: UI.accent });
    this.info = label(this, 392, 60, '', { size: 9, colour: UI.text, wrap: 224 });

    this.menu = new Menu(this, {
      x: 26, y: 74, width: 338, rowHeight: 22, size: 9,
      onFocusChange: () => this.showInfo(),
    });
    this.rebuild();
    this.navFooter();
  }

  private rebuild(): void {
    const c = this.ctx.career!;
    this.header.setText(t('training.picks', c.trainingPicks));
    const items = c.trainingSlate.map((o) => ({
      text: t(o.nameKey),
      value: () => summarise(o.gains, o.secondaryGains),
      onSelect: () => {
        if (c.trainingPicks <= 0) {
          this.sfx('menu_error');
          return;
        }
        takeTraining(c, o.id);
        this.sfx('menu_confirm');
        this.ctx.persist();
        this.rebuild();
        this.showInfo();
      },
    }));
    items.push({
      text: t('training.done'),
      value: () => '',
      onSelect: () => {
        finishTraining(c);
        this.ctx.persist();
        this.sfx('menu_confirm');
        if (c.ending) this.go('Retirement');
        else if (c.phase === 'challenge') this.go('Challenge');
        else this.go('CareerHub');
      },
    });
    this.menu.setItems(items);
    this.showInfo();
  }

  private showInfo(): void {
    const c = this.ctx.career!;
    const idx = this.menu.focusedIndex;
    const o = c.trainingSlate[idx];
    if (!o) {
      this.info.setText(
        `${t('career.stage')}: ${t(`stage.${c.stage}`)}\n\n` +
          `Gains shrink as a rating climbs, and shrink further as your career\nadvances. Nothing here reaches every ceiling.\n\n` +
          `${t('training.wear')}: ${c.wear.toFixed(1)}`,
      );
      return;
    }
    const synergy = o.synergy ? `\n${t('training.synergy', t(`archetype.${o.synergy}`))}` : '';
    const gains = summariseLong(o.gains, o.secondaryGains) || t('training.noGain');
    this.info.setText(
      `${t(o.nameKey)}\n\n${t(o.descriptionKey)}\n\n${gains}\n${t('training.wear')}: ${o.wearCost > 0 ? '+' : ''}${o.wearCost.toFixed(1)}${synergy}`,
    );
  }

  protected handleInput(s: InputSnapshot): void {
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) this.menu.confirm();
  }
}

/**
 * Compact summary for the training row's value column. Full rating names
 * overran the column and collided with the item name, so the row uses codes
 * and the detail panel carries the readable version.
 */
function summarise(gains: Record<string, number | undefined>, secondary: Record<string, number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(gains)) if (v) parts.push(`+${v} ${ratingCode(k)}`);
  for (const [k, v] of Object.entries(secondary)) if (v) parts.push(`+${v} ${ratingCode(k)}`);
  return parts.join(' ');
}

/** Readable version, for the detail panel where there is room. */
function summariseLong(gains: Record<string, number | undefined>, secondary: Record<string, number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(gains)) if (v) parts.push(`+${v} ${t(`rating.${k}`)}`);
  for (const [k, v] of Object.entries(secondary)) if (v) parts.push(`+${v} ${t(`rating.${k}`)}`);
  return parts.join('   ');
}

// ---------------------------------------------------------------------------

export class ChallengeScene extends BaseScene {
  static readonly KEY = 'Challenge';
  private menu!: Menu;

  constructor() {
    super(ChallengeScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;
    const ch = c.pendingChallenge;
    if (!ch) {
      this.scene.start('CareerHub');
      return;
    }

    this.paintBackground('challenge.title');
    panel(this, 90, 60, 460, 190);

    const def = getFighter(ch.challengerId);
    const g = this.add.graphics();
    g.save();
    g.translateCanvas(170, 220);
    g.scaleCanvas(2.6, 2.6);
    drawBoxer(g, POSES.intro, def.appearance, { colorSafe: this.ctx.settings.accessibility.colorSafe });
    g.restore();

    label(this, 250, 80, t('challenge.body', ch.challengerName, ch.challengerRank), {
      size: 11,
      colour: UI.text,
      wrap: 280,
    });
    label(this, 250, 126, `${t('opponent.rounds')}: ${ch.rounds}\n${t('opponent.purse')}: ${money(ch.purse)}`, {
      size: 10,
      colour: UI.textDim,
    });
    label(this, 250, 164, t('challenge.refuseWarning', ch.refusalRank), { size: 9, colour: UI.bad, wrap: 280 });

    this.menu = new Menu(this, { x: 250, y: 196, width: 280, rowHeight: 18, size: 11 });
    this.menu.setItems([
      {
        text: t('challenge.accept'),
        colour: UI.accent,
        onSelect: () => {
          const id = acceptChallenge(c);
          this.ctx.pendingOpponentId = id;
          this.ctx.persist();
          this.sfx('menu_confirm');
          this.go('PreFight');
        },
      },
      {
        text: t('challenge.refuse'),
        colour: UI.bad,
        onSelect: () => {
          refuseChallenge(c);
          this.ctx.persist();
          this.sfx('menu_back');
          this.go('CareerHub');
        },
      },
    ]);
    this.navFooter();
  }

  protected handleInput(s: InputSnapshot): void {
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) this.menu.confirm();
  }
}

// ---------------------------------------------------------------------------

export class RetirementScene extends BaseScene {
  static readonly KEY = 'Retirement';
  private menu!: Menu;

  constructor() {
    super(RetirementScene.KEY);
  }

  create(): void {
    const c = requireCareer(this, this.ctx);
    if (!c) return;
    const ending = c.ending ?? retire(c, 'ending.voluntary');

    // Archive the career, then clear it so the slot is free.
    const already = this.ctx.save.data.legacy.some(
      (l) => l.name === c.player.displayName && l.earnings === ending.earnings && l.wins === ending.record.wins,
    );
    if (!already) {
      this.ctx.save.data.legacy.unshift(toLegacyRecord(c));
      if (this.ctx.save.data.legacy.length > 30) this.ctx.save.data.legacy.length = 30;
    }
    this.ctx.career = null;
    this.ctx.persist();

    this.paintBackground('retirement.title', c.player.displayName);
    panel(this, 60, 46, 520, 236);

    const g = this.add.graphics();
    g.save();
    g.translateCanvas(150, 250);
    g.scaleCanvas(2.8, 2.8);
    drawBoxer(g, ending.wasChampion ? POSES.celebrate : POSES.intro, c.player.appearance, {
      colorSafe: this.ctx.settings.accessibility.colorSafe,
    });
    g.restore();

    label(this, 250, 66, t(ending.reasonKey), { size: 11, colour: UI.accent, wrap: 310 });

    const rows: [string, string][] = [
      [t('career.record'), record(ending.record.wins, ending.record.losses, ending.record.draws, ending.record.kos)],
      [t('retirement.finalRank'), ending.finalRank >= 9 ? '—' : `#${ending.finalRank}`],
      [t('retirement.peakRank'), `#${c.history.reduce((b, h) => Math.min(b, h.playerRankAfter), 9)}`],
      [t('retirement.defences'), String(ending.titleDefences)],
      [t('career.earnings'), money(ending.earnings)],
      ['Bouts', `${ending.boutsFought} of ${CAREER_RULES.maxBouts}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 108 + i * 19;
      label(this, 250, y, k, { size: 9, colour: UI.textDim });
      label(this, 560, y, v, { size: 9, colour: UI.text, align: 'right' });
    });

    label(this, 250, 232, `${t('retirement.grade')}: ${t(ending.gradeKey)}`, { size: 14, colour: UI.accent });
    if (ending.earnings >= CAREER_RULES.legacyTarget) {
      label(this, 250, 254, t('legacy.beaten'), { size: 10, colour: UI.good });
    }

    this.menu = new Menu(this, { x: 200, y: 292, width: 240, rowHeight: 18, size: 11 });
    this.menu.setItems([
      { text: t('retirement.toLegacy'), colour: UI.accent, onSelect: () => this.go('Legacy') },
      { text: t('menu.quit'), onSelect: () => this.go('MainMenu') },
    ]);
    this.navFooter();
  }

  protected handleInput(s: InputSnapshot): void {
    const d = this.navDelta(s);
    if (d !== 0) {
      this.menu.move(d);
      this.sfx('menu_move');
    }
    if (s.pressed.confirm) this.menu.confirm();
  }
}
