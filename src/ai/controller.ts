/**
 * The opponent AI.
 *
 * Three layers, exactly as designed in docs/AI_SPEC.md:
 *
 *   1. Strategic plan  — re-chosen at round start and on major state changes.
 *   2. Tactical utility — every `decisionInterval` ticks, score the available
 *      actions and pick one.
 *   3. Motor execution  — convert the chosen tactic into the same
 *      `FighterCommand` a player's keyboard produces.
 *
 * Fairness is structural: `decide` accepts a `PublicBoutView` delayed by the
 * profile's perception latency. It has no reference to the simulation, the
 * opponent's command, or the simulation's random stream.
 */
import { clamp01, dist, sign } from '@sim/fixed';
import { Rng } from '@sim/rng';
import { emptyCommand, type FighterCommand, type PunchId, type TargetLevel } from '@sim/types';
import type { PublicBoutView, PublicFighterView } from '@sim/view';
import { getPunch } from '@data/punches';
import { AI_PROFILES, RANGE, type AiProfile, type Difficulty } from './profiles';
import type { ArchetypeId } from '@sim/types';

/** What the fighter is trying to achieve right now. */
export type FightPlan =
  | 'establish_range'
  | 'pressure_body'
  | 'counter_lead'
  | 'hunt_finish'
  | 'protect_lead'
  | 'recover';

export interface AiDebugInfo {
  plan: FightPlan;
  targetRange: number;
  actualRange: number;
  action: string;
  confidence: number;
  /** Top scoring alternatives, for the debug overlay. */
  considered: { action: string; utility: number }[];
  reason: string;
  ticksToNextDecision: number;
}

type Action =
  | { kind: 'advance' }
  | { kind: 'retreat' }
  | { kind: 'circle'; dir: number }
  | { kind: 'align' }
  | { kind: 'punch'; punch: PunchId; level: TargetLevel }
  | { kind: 'guard' }
  | { kind: 'crouch' }
  | { kind: 'slip'; dir: number }
  | { kind: 'clinch' }
  | { kind: 'reset' };

function actionLabel(a: Action): string {
  switch (a.kind) {
    case 'punch':
      return `${a.punch}:${a.level}`;
    case 'circle':
      return `circle:${a.dir > 0 ? 'out' : 'in'}`;
    case 'slip':
      return `slip:${a.dir > 0 ? 'out' : 'in'}`;
    default:
      return a.kind;
  }
}

export class AiController {
  readonly corner: 0 | 1;
  readonly profile: AiProfile;
  readonly difficulty: Difficulty;

  private readonly rng: Rng;
  /** Delay line of public views; index 0 is the most recent. */
  private readonly perception: PublicBoutView[] = [];
  private plan: FightPlan = 'establish_range';
  private planTicks = 0;
  private action: Action = { kind: 'reset' };
  private actionTicks = 0;
  /** Combination queue, consumed one punch per opening. */
  private combo: { punch: PunchId; level: TargetLevel }[] = [];
  private lastRound = 0;
  private debug: AiDebugInfo;
  /** Rolling memory of what the opponent has been doing. */
  private oppPunchMemory = 0;
  private oppGuardMemory = 0;
  private selfLandedMemory = 0;
  /** Edge-trigger bookkeeping so held inputs do not machine-gun. */
  private punchLatch = false;
  /** The last two punches thrown, so the AI does not machine-gun one move. */
  private recentPunches: PunchId[] = [];
  /**
   * Ticks before this fighter is willing to open up again. Boxers work in
   * bursts and then reset; without this the AI throws continuously, never
   * guards, and produces roughly three times a real fighter's punch output.
   */
  private punchCooldown = 0;
  private slipLatch = false;
  private recoverPhase = 0;

  constructor(corner: 0 | 1, archetype: ArchetypeId, difficulty: Difficulty, seed: number | string) {
    this.corner = corner;
    this.profile = AI_PROFILES[archetype];
    this.difficulty = difficulty;
    this.rng = new Rng(seed);
    this.debug = {
      plan: this.plan,
      targetRange: this.profile.targetRange,
      actualRange: 0,
      action: 'reset',
      confidence: 0,
      considered: [],
      reason: 'init',
      ticksToNextDecision: 0,
    };
  }

  get debugInfo(): AiDebugInfo {
    return this.debug;
  }

  /**
   * Produces this tick's command.
   *
   * `now` is the *current* public view; the controller pushes it into its
   * delay line and then reasons about an older frame, so it is genuinely
   * reacting late rather than pretending to.
   */
  decide(now: PublicBoutView): FighterCommand {
    this.perception.unshift(now);
    if (this.perception.length > 40) this.perception.pop();

    // Perception latency models *reaction time*, not blindness. A fighter
    // always knows where they and their opponent are standing — that is
    // continuous tracking. What arrives late is the news that the opponent has
    // just started something. So geometry and condition come from the live
    // view, while the reactive channel (has a punch begun?) comes from the
    // delayed one. This keeps a 5-tick jab genuinely unreactable at every
    // difficulty while removing the absurdity of punching at where someone
    // stood a fifth of a second ago.
    const idx = Math.min(this.difficulty.perceptionLatency, this.perception.length - 1);
    const delayed = this.perception[idx];
    const view = now;

    const cmd = emptyCommand();
    if (now.phase !== 'round_active' && now.phase !== 'knockdown') {
      return cmd;
    }

    // Getting up is reflex, not tactics.
    if (now.self.state === 'knockdown') {
      this.recoverPhase++;
      // A believable, non-superhuman recovery cadence.
      cmd.recover = this.recoverPhase % 5 === 0;
      return cmd;
    }
    this.recoverPhase = 0;
    if (now.phase === 'knockdown') return cmd;

    if (view.round !== this.lastRound) {
      this.lastRound = view.round;
      this.combo.length = 0;
      this.choosePlan(view, 'round start');
    }

    this.updateMemory(view);

    this.planTicks++;
    if (this.planTicks >= 150) this.choosePlan(view, 'periodic review');

    if (this.punchCooldown > 0) this.punchCooldown--;

    this.actionTicks--;
    if (this.actionTicks <= 0) {
      this.chooseAction(view, delayed);
    }

    return this.execute(view, now, cmd);
  }

  // -------------------------------------------------------------------------
  // Layer 1 — strategic plan
  // -------------------------------------------------------------------------

  private choosePlan(view: PublicBoutView, reason: string): void {
    this.planTicks = 0;
    const me = view.self;
    const them = view.opponent;
    const p = this.profile;

    const hurt = me.composureFrac < 0.32 || me.balance < 0.45;
    const theyHurt = them.composureFrac < 0.34 || them.balance < 0.45;
    const roundsLeft = view.totalRounds - view.round;
    const ahead = view.roundsWonSelf > view.roundsWonOpponent;

    let plan: FightPlan;
    if (hurt && !theyHurt) {
      plan = 'recover';
    } else if (theyHurt && this.rng.chance(0.5 + p.riskTolerance * 0.5)) {
      plan = 'hunt_finish';
    } else if (ahead && roundsLeft <= 1 && this.rng.chance(this.difficulty.tacticalDiscipline)) {
      // Late and ahead: stop taking chances. Only a disciplined AI manages it.
      plan = 'protect_lead';
    } else if (!ahead && roundsLeft === 0 && view.roundsWonSelf < view.roundsWonOpponent) {
      // Behind on the cards in the final round: must go and get it.
      plan = 'hunt_finish';
    } else {
      // Otherwise the archetype's own preference, with the body plan chosen
      // more often once the opponent's body is already sore.
      const bodyPull = p.bodyBias + them.bodyTrauma * 0.4;
      if (p.counterAppetite > 0.7 && this.rng.chance(0.6)) plan = 'counter_lead';
      else if (this.rng.chance(bodyPull)) plan = 'pressure_body';
      else plan = 'establish_range';
    }

    this.plan = plan;
    this.debug.plan = plan;
    this.debug.reason = reason;
  }

  private updateMemory(view: PublicBoutView): void {
    const a = this.difficulty.adaptation;
    const punching = view.opponent.activePunch !== null ? 1 : 0;
    const guarding = view.opponent.state === 'guard' || view.opponent.state === 'crouch' ? 1 : 0;
    this.oppPunchMemory += (punching - this.oppPunchMemory) * 0.02 * (0.3 + a);
    this.oppGuardMemory += (guarding - this.oppGuardMemory) * 0.02 * (0.3 + a);
    const landRate = view.self.punchesThrown > 0 ? view.self.punchesLanded / view.self.punchesThrown : 0.3;
    this.selfLandedMemory += (landRate - this.selfLandedMemory) * 0.01;
  }

  // -------------------------------------------------------------------------
  // Layer 2 — tactical utility
  // -------------------------------------------------------------------------

  private chooseAction(view: PublicBoutView, delayed: PublicBoutView): void {
    const me = view.self;
    const them = view.opponent;
    const p = this.profile;
    const sep = dist(them.x - me.x, them.z - me.z);

    const targetRange = this.planTargetRange();
    const rangeError = sep - targetRange;

    const candidates: { action: Action; utility: number }[] = [];
    const add = (action: Action, utility: number): void => {
      candidates.push({ action, utility: utility * this.rng.variance(0.22 * this.difficulty.noise) });
    };

    // --- Positioning -------------------------------------------------------
    // Repositioning only competes with punching when the range is actually
    // wrong. Once a fighter is where they want to be, throwing wins — otherwise
    // both corners circle each other for ten rounds.
    const depthOffset = Math.abs(them.z - me.z);
    // Getting on line matters as much as getting to the right distance: the
    // ring has depth, and a punch thrown from upstage simply passes behind.
    add({ kind: 'align' }, depthOffset > 14 ? 1.3 + depthOffset * 0.02 : depthOffset > 8 ? 0.45 : -0.6);

    const inPosition = Math.abs(rangeError) <= p.rangeTolerance && depthOffset <= 12;
    add({ kind: 'advance' }, rangeError > p.rangeTolerance ? 0.62 + p.aggression * 0.95 : -0.5);
    add({ kind: 'retreat' }, rangeError < -p.rangeTolerance ? 0.58 + (1 - p.aggression) * 0.75 : -0.5);
    const circleDir = them.z >= me.z ? -1 : 1;
    add({ kind: 'circle', dir: circleDir }, inPosition ? 0.22 + (1 - p.aggression) * 0.3 : 0.1);

    // --- Defence -----------------------------------------------------------
    // React only to a punch that has been visible long enough to see. Because
    // the view is already delayed, a fast jab is genuinely unreactable.
    const seen = delayed.opponent;
    const incoming = seen.activePunch !== null && (seen.state === 'punch_startup' || seen.state === 'punch_active');
    if (incoming && sep < RANGE.jab + 8) {
      const read = this.rng.chance(this.difficulty.readAccuracy);
      const level: TargetLevel = read ? seen.activeLevel : this.rng.chance(0.5) ? 'head' : 'body';
      // How readily a fighter covers up when something is coming is the
      // clearest behavioural line between a counterpuncher and a swarmer, so
      // discipline dominates here rather than sitting on a large flat base.
      const blockUtility = 0.3 + p.guardDiscipline * 1.5;
      if (level === 'body') add({ kind: 'crouch' }, blockUtility);
      else add({ kind: 'guard' }, blockUtility);
      add({ kind: 'slip', dir: this.rng.chance(0.5) ? 1 : -1 }, 0.6 + p.slipPreference * 0.8);
    }

    // A standing guard is the default posture inside punching range, not an
    // afterthought. How readily a fighter falls back on it is the single
    // clearest behavioural difference between a counterpuncher and a swarmer.
    const inDanger = sep < RANGE.jab + 6;
    add(
      { kind: 'guard' },
      p.guardDiscipline * (inDanger ? 0.7 : 0.25) -
        p.aggression * 0.35 +
        (me.composureFrac < 0.4 ? 0.6 : 0) +
        (me.exertion > 0.7 ? 0.3 : 0) +
        // How busy the opponent has been recently. A fighter who is being
        // worked keeps their hands up; one being circled does not.
        this.oppPunchMemory * p.guardDiscipline * 0.9,
    );
    // Covering up low, which leaves the head open — the level game cuts both ways.
    add({ kind: 'crouch' }, p.guardDiscipline * (inDanger ? 0.42 : 0.14) - p.aggression * 0.25 + them.bodyTrauma * 0.4);

    // --- Clinch ------------------------------------------------------------
    if (sep < RANGE.clinch + 4 && (me.composureFrac < 0.3 || me.exertion > 0.8)) {
      add({ kind: 'clinch' }, 0.5 + p.clinchAppetite * 0.9);
    }

    // --- Offence -----------------------------------------------------------
    // The opponent is counterable when they are inside the vulnerability
    // window of their own punch — the same explicit window a player exploits.
    const counterable = this.opponentIsCounterable(seen);
    const openGuard = 1 - them.guardIntegrity * (them.state === 'guard' || them.state === 'crouch' ? 1 : 0.25);

    // Where the opponent will be when the punch actually arrives. Throwing at
    // where someone is standing now is how you miss a retreating out-boxer.
    const closing = (them.vx - me.vx) * (them.x >= me.x ? 1 : -1);

    for (const punchId of Object.keys(p.punchWeights) as PunchId[]) {
      for (const level of ['head', 'body'] as TargetLevel[]) {
        const def = getPunch(punchId, level);
        if (depthOffset > def.depthTolerance * 0.7) continue;
        const impactSep = sep + closing * (def.startupTicks + def.activeTicks * 0.5);
        // Only throw when the punch will still be in range on arrival, with a
        // margin so a half-step does not turn every punch into air.
        if (impactSep > def.reach * 0.94 || impactSep < def.minRange + 2) continue;

        // Being in range to throw is the whole point of getting there.
        let u = p.punchWeights[punchId] * (1.35 + p.aggression * 0.65);

        // Level selection: body work when planned, or when their body is
        // already hurt; head hunting when they are ready to go.
        const wantBody = this.plan === 'pressure_body' ? 0.35 : 0;
        u *=
          level === 'body'
            ? 0.5 + p.bodyBias * 0.9 + wantBody + Math.min(them.bodyTrauma, 0.5) * 0.35
            : 1.15 + Math.min(them.headTrauma, 0.5) * 0.3;

        // Slow, heavy punches are only worth it when they will land.
        const commitment = def.startupTicks + def.recoveryTicks;
        u -= (commitment / 40) * (1 - p.riskTolerance) * 0.55;

        if (counterable) u += def.counterBonus * p.counterAppetite * 0.9;
        // Punching into a solid guard is worth less, but never worthless — a
        // guard degrades, and body work is how it gets opened.
        u *= 0.74 + openGuard * 0.26 + (def.family === 'uppercut' ? 0.14 : 0);

        // Punching at the very end of your reach is how you miss. Prefer
        // punches thrown from comfortably inside their range.
        u -= Math.max(0, impactSep / def.reach - 0.74) * 2.4;

        // Being crowded makes the long punches more attractive, not less:
        // that is how a boxer buys space back.
        if (rangeError < -p.rangeTolerance && def.reach >= 44) u += 0.55;

        // Being tired makes a fighter pick cheaper punches.
        u -= def.exertionCost * me.exertion * 22;

        // Throwing the same punch over and over is both predictable and dull.
        // A real fighter mixes; so does this one.
        const repeats = this.recentPunches.filter((r) => r === punchId).length;
        u -= repeats * 0.5;

        // Pacing. Mid-burst the fighter is still willing; once the burst is
        // spent they reset, breathe, and look again.
        if (this.punchCooldown > 0) u -= 0.9 + (this.punchCooldown / 60) * 1.4;

        if (this.plan === 'hunt_finish') u += def.composureDamage * 0.055 * (1 + p.riskTolerance);
        if (this.plan === 'protect_lead') u -= commitment * 0.02;
        if (this.plan === 'recover') u -= 0.55;

        add({ kind: 'punch', punch: punchId, level }, u);
      }
    }

    add({ kind: 'reset' }, 0.1);

    candidates.sort((a, b) => b.utility - a.utility);
    const best = candidates[0];
    this.action = best.action;
    this.actionTicks = this.actionHold(best.action);
    // A fresh decision is a fresh button press. Without this, an archetype that
    // chooses to punch twice in a row would latch itself out of throwing at all.
    this.punchLatch = false;
    this.slipLatch = false;

    this.debug = {
      plan: this.plan,
      targetRange,
      actualRange: sep,
      action: actionLabel(best.action),
      confidence: clamp01(best.utility / 2.5),
      considered: candidates.slice(0, 5).map((c) => ({ action: actionLabel(c.action), utility: Math.round(c.utility * 100) / 100 })),
      reason: this.debug.reason,
      ticksToNextDecision: this.actionTicks,
    };

    // Plan a short combination when a good punch was chosen and the AI is
    // capable of planning ahead.
    if (best.action.kind === 'punch') {
      this.recentPunches.push(best.action.punch);
      if (this.recentPunches.length > 3) this.recentPunches.shift();
      // Reset pace follows the punch: a jab is back almost immediately, a rear
      // uppercut leaves the fighter needing a beat. Aggressive fighters reset
      // faster than patient ones on top of that.
      const thrown = getPunch(best.action.punch, best.action.level);
      const weight = (thrown.startupTicks + thrown.recoveryTicks + 14) / 28;
      this.punchCooldown = Math.round(34 * (1 - p.aggression * 0.5) * weight * this.rng.range(0.7, 1.3));
    }

    if (best.action.kind === 'punch' && this.difficulty.planDepth > 1 && this.combo.length === 0) {
      const depth = this.rng.int(1, this.difficulty.planDepth) - 1;
      for (let i = 0; i < depth; i++) {
        const follow = this.pickFollowUp(best.action.punch, best.action.level);
        if (follow) this.combo.push(follow);
      }
    }
  }

  /** Classic follow-ups: the jab sets the cross, the body sets the head. */
  private pickFollowUp(prev: PunchId, level: TargetLevel): { punch: PunchId; level: TargetLevel } | null {
    const table: Partial<Record<PunchId, PunchId[]>> = {
      jab: ['cross', 'lead_hook'],
      cross: ['lead_hook', 'rear_hook'],
      lead_hook: ['cross', 'rear_upper'],
      rear_hook: ['jab', 'lead_hook'],
      lead_upper: ['lead_hook', 'cross'],
      rear_upper: ['lead_hook', 'jab'],
    };
    const options = table[prev];
    if (!options || options.length === 0) return null;
    const punch = this.rng.pick(options);
    // Going body-then-head is the point of investing in the body at all.
    const nextLevel: TargetLevel = level === 'body' ? 'head' : this.rng.chance(this.profile.bodyBias * 0.6) ? 'body' : 'head';
    return { punch, level: nextLevel };
  }

  private planTargetRange(): number {
    const p = this.profile;
    switch (this.plan) {
      case 'pressure_body':
        return Math.min(p.targetRange, RANGE.pocket);
      case 'hunt_finish':
        return Math.min(p.targetRange, RANGE.pocket + 4);
      case 'recover':
        return RANGE.outside + 6;
      case 'protect_lead':
        return Math.max(p.targetRange, RANGE.jab + 4);
      case 'counter_lead':
        return p.targetRange + 3;
      default:
        return p.targetRange;
    }
  }

  private opponentIsCounterable(them: PublicFighterView): boolean {
    if (!them.activePunch) return false;
    const def = getPunch(them.activePunch, them.activeLevel);
    // Elapsed ticks in their punch, from what is visible on screen.
    const elapsed =
      them.state === 'punch_startup'
        ? them.stateTicks
        : them.state === 'punch_active'
          ? def.startupTicks + them.stateTicks
          : def.startupTicks + def.activeTicks + them.stateTicks;
    return elapsed >= def.vulnerableFrom && elapsed <= def.vulnerableTo;
  }

  private actionHold(a: Action): number {
    switch (a.kind) {
      case 'punch':
        return this.difficulty.decisionInterval;
      case 'circle':
        return this.profile.movementHold;
      case 'slip':
        return 10;
      case 'clinch':
        return 20;
      default:
        return this.difficulty.decisionInterval;
    }
  }

  // -------------------------------------------------------------------------
  // Layer 3 — motor execution
  // -------------------------------------------------------------------------

  private execute(view: PublicBoutView, now: PublicBoutView, cmd: FighterCommand): FighterCommand {
    const me = now.self;
    const them = now.opponent;
    const a = this.action;

    // The fighter is committed; nothing to do but let the animation run. The
    // buffered-punch window is the same one a player gets.
    const busy =
      me.state === 'punch_startup' ||
      me.state === 'punch_active' ||
      me.state === 'hit_light' ||
      me.state === 'hit_heavy' ||
      me.state === 'stagger' ||
      me.state === 'slip';

    switch (a.kind) {
      case 'advance':
        cmd.moveX = 1;
        cmd.moveZ = this.alignZ(me, them);
        break;
      case 'retreat':
        cmd.moveX = -1;
        cmd.moveZ = this.alignZ(me, them);
        break;
      case 'align':
        cmd.moveZ = this.alignZ(me, them);
        cmd.moveX = 0;
        break;
      case 'circle': {
        // Circling is lateral movement, but never so far off-line that the
        // fighters lose each other in depth or back into the ring edge.
        const offLine = them.z - me.z;
        cmd.moveZ = Math.abs(offLine) > 22 || Math.abs(me.z + a.dir * 10) > 62 ? sign(offLine) : a.dir;
        cmd.moveX = sign(this.planTargetRange() - dist(them.x - me.x, them.z - me.z)) * -1;
        break;
      }
      case 'guard':
        cmd.guard = true;
        break;
      case 'crouch':
        cmd.crouch = true;
        break;
      case 'slip':
        if (!this.slipLatch) {
          cmd.slip = a.dir;
          this.slipLatch = true;
        }
        break;
      case 'clinch':
        cmd.clinch = true;
        cmd.moveX = 1;
        break;
      case 'punch': {
        cmd.crouch = a.level === 'body';
        cmd.moveZ = this.alignZ(me, them);
        // Work while repositioning. Jabbing on the retreat is the whole
        // out-boxer game; walking forward behind a hook is the pressure game.
        // The simulation already limits how much a fighter can move mid-punch
        // via each punch's movementAllowance.
        const want = this.planTargetRange();
        const gap = dist(them.x - me.x, them.z - me.z) - want;
        cmd.moveX = gap < -5 ? -1 : gap > 5 ? 1 : 0;
        // Edge-triggered exactly like a player's button press.
        if (!busy && !this.punchLatch) {
          cmd.punch = a.punch;
          this.punchLatch = true;
        } else if (!busy && this.combo.length > 0 && me.state === 'punch_recover') {
          const next = this.combo.shift()!;
          cmd.punch = next.punch;
          cmd.crouch = next.level === 'body';
        }
        break;
      }
      case 'reset':
        break;
    }

    if (a.kind !== 'punch') this.punchLatch = false;
    if (a.kind !== 'slip') this.slipLatch = false;

    // A fighter who has been pinned on the ropes tries to get off them, no
    // matter what the plan says. This is the deadlock escape.
    const nearRope = Math.abs(me.x) > 132;
    if (nearRope && me.composureFrac < 0.8) {
      cmd.moveZ = me.z >= 0 ? -1 : 1;
      if (cmd.moveX === 0) cmd.moveX = -sign(me.x) === me.facing ? 1 : -1;
    }

    // Do not walk into the ropes.
    if (Math.abs(me.x + cmd.moveX * me.facing * 2) > 148) {
      cmd.moveX = 0;
    }

    // Long stalls make the referee, and the crowd, unhappy. Force activity.
    if (view.roundTick > 0 && me.punchesThrown === 0 && view.roundTick > 240) {
      cmd.punch = cmd.punch ?? 'jab';
    }

    return cmd;
  }

  /** Steps onto the opponent's line. Returns 0 once close enough to punch. */
  private alignZ(me: PublicFighterView, them: PublicFighterView): number {
    const dz = them.z - me.z;
    if (Math.abs(dz) < 5) return 0;
    return sign(dz);
  }
}
