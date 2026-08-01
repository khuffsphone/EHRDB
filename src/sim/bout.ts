/**
 * The authoritative bout simulation.
 *
 * Everything the game considers *true* happens here: positions, punches,
 * damage, knockdowns, stoppages and scoring. It is a pure function of
 * (config, command stream) — no DOM, no wall clock, no unseeded randomness —
 * which is what makes replays, regression tests and the AI soak harness
 * meaningful.
 *
 * Presentation reads `state` and consumes the events returned by `tick`. It
 * never writes to either.
 */
import { getPunch } from '@data/punches';
import { approach, clamp, clamp01, dist, quantize, sign } from './fixed';
import { canThrow, isCommitted, isGrounded, isHittable, transition } from './fsm';
import {
  createFighterState,
  deriveStats,
  exertionPenalty,
  onRopes,
  type DerivedStats,
} from './fighter';
import { Rng } from './rng';
import { buildScorecards, decisionKindKey, decisionWinner, emptyRoundScore } from './scoring';
import {
  RING,
  type BoutConfig,
  type BoutEvent,
  type BoutOutcome,
  type BoutState,
  type FighterCommand,
  type FighterDefinition,
  type FighterState,
  type HitQuality,
  type PunchDefinition,
  type PunchId,
  type RoundScore,
  type Ruleset,
  type TargetLevel,
} from './types';

// --- Tuning constants shared across the loop -------------------------------

/** Ticks a light hit reaction lasts. */
const HIT_LIGHT_TICKS = 9;
const HIT_HEAVY_TICKS = 17;
const STAGGER_TICKS = 30;
/** Ticks a punch may sit in the buffer before it is discarded as stale. */
const BUFFER_MAX_AGE = 12;
/** Remaining commitment at or below which a new punch may be buffered. */
const BUFFER_WINDOW = 14;
const CLINCH_TICKS = 84;
const CLINCH_COOLDOWN = 150;
const CLINCH_RANGE = 30;
/** Separation the referee restores after breaking a clinch. */
const CLINCH_BREAK_SEP = 54;
/** Composure fraction restored on rising from a knockdown. */
const RISE_COMPOSURE = 0.42;
/** Resilience lost for having been floored at all. */
const KNOCKDOWN_RESILIENCE_COST = 0.11;

interface PendingHit {
  attacker: 0 | 1;
  defender: 0 | 1;
  punch: PunchDefinition;
  punchId: PunchId;
  level: TargetLevel;
  quality: HitQuality;
  sep: number;
}

/** Defensive posture captured before any damage resolves, so both fighters'
 * punches are judged against the same instant. Without this, corner 0 would
 * quietly win every simultaneous exchange. */
interface DefenseSnapshot {
  x: number;
  z: number;
  state: FighterState['state'];
  stateTicks: number;
  guarding: boolean;
  crouching: boolean;
  slipping: boolean;
  punchElapsed: number;
  activePunch: PunchId | null;
  activeLevel: TargetLevel;
  guardIntegrity: number;
}

export class BoutSim {
  readonly state: BoutState;
  readonly ruleset: Ruleset;
  readonly venueId: string;
  readonly definitions: [FighterDefinition, FighterDefinition];
  readonly derived: [DerivedStats, DerivedStats];

  /** Simulation stream — damage variance, judging, knockdown resolution. */
  private readonly rng: Rng;
  private events: BoutEvent[] = [];
  private currentScore: RoundScore;
  /** Ticks until either fighter may clinch again. */
  private clinchCooldown = 0;
  private clinchTimer = 0;
  /** Guards against re-emitting a rope warning every tick. */
  private ropeCue: [number, number] = [0, 0];
  private started = false;

  constructor(config: BoutConfig) {
    this.ruleset = config.ruleset;
    this.venueId = config.venueId;
    this.definitions = config.fighters;
    this.rng = new Rng(config.seed);
    this.derived = [deriveStats(config.fighters[0]), deriveStats(config.fighters[1])];

    this.currentScore = emptyRoundScore(1);
    this.state = {
      phase: 'intro',
      round: 1,
      roundTick: 0,
      totalTicks: 0,
      phaseTicks: config.ruleset.introTicks,
      fighters: [
        createFighterState(config.fighters[0], this.derived[0], 0, config.ruleset),
        createFighterState(config.fighters[1], this.derived[1], 1, config.ruleset),
      ],
      scores: [],
      outcome: null,
      groundedCorner: null,
      refereeConcern: [0, 0],
    };
  }

  get isComplete(): boolean {
    return this.state.phase === 'complete';
  }

  /** Advances the simulation by exactly one tick and returns what happened. */
  tick(commands: [FighterCommand, FighterCommand]): BoutEvent[] {
    this.events = [];

    if (!this.started) {
      this.started = true;
      this.emit({ type: 'bout_start', rounds: this.ruleset.rounds, venueId: this.venueId });
    }

    switch (this.state.phase) {
      case 'intro':
        this.tickIntro();
        break;
      case 'round_active':
        this.tickRound(commands);
        break;
      case 'knockdown':
        this.tickKnockdown(commands);
        break;
      case 'round_break':
        this.tickBreak();
        break;
      case 'stoppage':
      case 'decision':
        this.finish();
        break;
      case 'complete':
        break;
    }

    this.state.totalTicks++;
    return this.events;
  }

  private emit(e: BoutEvent): void {
    this.events.push(e);
  }

  // -------------------------------------------------------------------------
  // Phase handling
  // -------------------------------------------------------------------------

  private tickIntro(): void {
    this.state.phaseTicks--;
    if (this.state.phaseTicks <= 0) this.beginRound(1);
  }

  private tickBreak(): void {
    this.state.phaseTicks--;
    if (this.state.phaseTicks <= 0) this.beginRound(this.state.round + 1);
  }

  private beginRound(round: number): void {
    this.state.round = round;
    this.state.roundTick = 0;
    this.state.phase = 'round_active';
    this.currentScore = emptyRoundScore(round);
    this.clinchCooldown = 0;
    this.clinchTimer = 0;

    for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
      const f = this.state.fighters[i];
      f.knockdownsThisRound = 0;
      f.countReached = 0;
      f.riseProgress = 0;
      f.clinchTicks = 0;
      f.idleTicks = 0;
      f.bufferedPunch = null;
      f.activePunch = null;
      f.punchResolved = false;
      f.commitTicks = 0;
      f.vx = 0;
      f.vz = 0;
      f.x = i === 0 ? -46 : 46;
      f.z = 0;
      f.state = f.state === 'intro' ? 'intro' : f.state;
      transition(f, 'idle');
    }
    this.emit({ type: 'round_start', round });
  }

  private endRound(): void {
    this.state.scores.push(this.currentScore);
    this.emit({ type: 'round_end', round: this.state.round, score: this.currentScore });

    if (this.state.round >= this.ruleset.rounds) {
      this.resolveDecision();
      return;
    }

    // Corner recovery. Losing resilience is what makes a long fight different
    // from a short one — only a fraction of it comes back.
    for (let i = 0; i < 2; i++) {
      const f = this.state.fighters[i];
      const d = this.derived[i];
      f.resilience = Math.min(f.resilienceMax, f.resilience + (f.resilienceMax - f.resilience) * d.breakRecovery);
      f.composure = f.resilience;
      f.headTrauma = Math.max(0, f.headTrauma - 0.09);
      f.bodyTrauma = Math.max(0, f.bodyTrauma - 0.07);
      f.exertion *= 0.42;
      f.guardIntegrity = 1;
      f.balance = 1;
      transition(f, 'corner');
    }
    this.state.refereeConcern = [
      Math.max(0, this.state.refereeConcern[0] - 0.2),
      Math.max(0, this.state.refereeConcern[1] - 0.2),
    ];
    this.state.phase = 'round_break';
    this.state.phaseTicks = this.ruleset.breakTicks;
  }

  // -------------------------------------------------------------------------
  // Active round
  // -------------------------------------------------------------------------

  private tickRound(commands: [FighterCommand, FighterCommand]): void {
    const [f0, f1] = this.state.fighters;

    // 1. Intent is acknowledged on the tick it is sampled.
    this.applyIntent(0, commands[0]);
    this.applyIntent(1, commands[1]);

    // 2. Timers advance and punch phases progress.
    this.advanceState(0);
    this.advanceState(1);

    // 3. Both fighters are judged against the same defensive instant.
    const snap: [DefenseSnapshot, DefenseSnapshot] = [this.snapshot(f0), this.snapshot(f1)];

    // 4. Resolve contact.
    const hits: PendingHit[] = [];
    const h0 = this.tryResolvePunch(0, snap[1]);
    if (h0) hits.push(h0);
    const h1 = this.tryResolvePunch(1, snap[0]);
    if (h1) hits.push(h1);

    // 5. Apply damage.
    for (const h of hits) this.applyHit(h);

    // 6. Movement and ring geometry.
    this.integrate(0, commands[0]);
    this.integrate(1, commands[1]);
    this.separate();
    this.updateFacing();

    // 7. Passive condition changes.
    this.tickCondition(0);
    this.tickCondition(1);
    this.tickClinch(commands);

    // 8. Stoppages take precedence over everything else.
    if (this.checkKnockdowns()) return;
    if (this.checkStoppage()) return;

    // 9. Round scoring components that accrue over time.
    this.accrueScore();

    this.state.roundTick++;
    if (this.state.roundTick >= this.ruleset.roundTicks) this.endRound();
  }

  private snapshot(f: FighterState): DefenseSnapshot {
    return {
      x: f.x,
      z: f.z,
      state: f.state,
      stateTicks: f.stateTicks,
      guarding: f.state === 'guard',
      crouching: f.state === 'crouch',
      slipping: f.state === 'slip',
      punchElapsed: this.punchElapsed(f),
      activePunch: f.activePunch,
      activeLevel: f.activeLevel,
      guardIntegrity: f.guardIntegrity,
    };
  }

  /** Ticks elapsed since the fighter's current punch began, or -1. */
  private punchElapsed(f: FighterState): number {
    if (!f.activePunch) return -1;
    const p = getPunch(f.activePunch, f.activeLevel);
    const scale = this.derived[f.corner];
    const startup = Math.round(p.startupTicks * scale.startupScale);
    switch (f.state) {
      case 'punch_startup':
        return f.stateTicks;
      case 'punch_active':
        return startup + f.stateTicks;
      case 'punch_recover':
        return startup + p.activeTicks + f.stateTicks;
      default:
        return -1;
    }
  }

  // --- Intent --------------------------------------------------------------

  private applyIntent(corner: 0 | 1, cmd: FighterCommand): void {
    const f = this.state.fighters[corner];
    if (isGrounded(f.state) || f.state === 'corner' || f.state === 'intro') return;

    // Buffering: a punch asked for during the tail of commitment is remembered
    // rather than dropped, but only inside a short, learnable window.
    if (isCommitted(f.state)) {
      if (cmd.punch && f.commitTicks <= BUFFER_WINDOW && !f.bufferedPunch) {
        f.bufferedPunch = cmd.punch;
        f.bufferedLevel = cmd.crouch ? 'body' : 'head';
        f.bufferedAge = 0;
      }
      return;
    }
    if (f.state === 'clinch') return;

    // Consume a buffered punch first so chained input feels honoured.
    let punch = cmd.punch;
    let level: TargetLevel = cmd.crouch ? 'body' : 'head';
    if (!punch && f.bufferedPunch) {
      punch = f.bufferedPunch;
      level = f.bufferedLevel;
      f.bufferedPunch = null;
    }

    if (punch && canThrow(f.state)) {
      this.startPunch(corner, punch, level);
      return;
    }

    if (cmd.slip !== 0 && (f.state === 'idle' || f.state === 'move' || f.state === 'guard')) {
      transition(f, 'slip');
      f.commitTicks = this.derived[corner].slipTicks + 4;
      f.exertion = clamp01(f.exertion + 0.006 * this.derived[corner].exertionRate);
      return;
    }

    if (cmd.guard && !cmd.crouch) {
      transition(f, 'guard');
      return;
    }
    if (cmd.crouch) {
      transition(f, 'crouch');
      return;
    }
    if (cmd.moveX !== 0 || cmd.moveZ !== 0) {
      transition(f, 'move');
      return;
    }
    transition(f, 'idle');
  }

  private startPunch(corner: 0 | 1, id: PunchId, level: TargetLevel): void {
    const f = this.state.fighters[corner];
    const d = this.derived[corner];
    const p = getPunch(id, level);

    // Exertion slows a tired fighter's hands but never freezes them.
    const fatigue = 1 / Math.max(0.5, exertionPenalty(f));
    const startup = Math.max(2, Math.round(p.startupTicks * d.startupScale * fatigue));

    transition(f, 'punch_startup');
    f.activePunch = id;
    f.activeLevel = level;
    f.punchResolved = false;
    f.commitTicks = startup + p.activeTicks + Math.round(p.recoveryTicks * d.recoveryScale * fatigue);
    f.punchesThrown++;
    f.idleTicks = 0;
    f.exertion = clamp01(f.exertion + p.exertionCost * d.exertionRate);
    this.emit({ type: 'punch_thrown', corner, punch: id, level });
  }

  // --- State advancement ---------------------------------------------------

  private advanceState(corner: 0 | 1): void {
    const f = this.state.fighters[corner];
    const d = this.derived[corner];
    f.stateTicks++;
    if (f.commitTicks > 0) f.commitTicks--;
    if (f.bufferedPunch) {
      f.bufferedAge++;
      if (f.bufferedAge > BUFFER_MAX_AGE) f.bufferedPunch = null;
    }
    f.idleTicks++;

    const fatigue = 1 / Math.max(0.5, exertionPenalty(f));

    switch (f.state) {
      case 'punch_startup': {
        const p = getPunch(f.activePunch!, f.activeLevel);
        const startup = Math.max(2, Math.round(p.startupTicks * d.startupScale * fatigue));
        if (f.stateTicks >= startup) transition(f, 'punch_active');
        break;
      }
      case 'punch_active': {
        const p = getPunch(f.activePunch!, f.activeLevel);
        if (f.stateTicks >= p.activeTicks) {
          // A punch that never found anything costs extra recovery.
          if (!f.punchResolved) {
            f.commitTicks += p.whiffExtraTicks;
            this.emit({
              type: 'punch_result',
              corner,
              punch: f.activePunch!,
              level: f.activeLevel,
              quality: 'miss',
              severity: 0,
              x: f.x,
              z: f.z,
            });
            this.currentScore.defense[corner === 0 ? 1 : 0] += 0.15;
            f.punchResolved = true;
          }
          transition(f, 'punch_recover');
        }
        break;
      }
      case 'punch_recover': {
        if (f.commitTicks <= 0) {
          f.activePunch = null;
          transition(f, 'idle');
        }
        break;
      }
      case 'slip':
        if (f.commitTicks <= 0) transition(f, 'idle');
        break;
      case 'hit_light':
        if (f.stateTicks >= HIT_LIGHT_TICKS) transition(f, 'idle');
        break;
      case 'hit_heavy':
        if (f.stateTicks >= HIT_HEAVY_TICKS) transition(f, 'idle');
        break;
      case 'stagger':
        if (f.stateTicks >= STAGGER_TICKS) transition(f, 'idle');
        break;
      default:
        break;
    }
  }

  // --- Contact resolution --------------------------------------------------

  private tryResolvePunch(corner: 0 | 1, def: DefenseSnapshot): PendingHit | null {
    const f = this.state.fighters[corner];
    if (f.state !== 'punch_active' || f.punchResolved || !f.activePunch) return null;

    const other: 0 | 1 = corner === 0 ? 1 : 0;
    const defender = this.state.fighters[other];
    if (!isHittable(defender.state)) return null;

    const p = getPunch(f.activePunch, f.activeLevel);
    const d = this.derived[corner];
    const reach = p.reach * d.reachScale;

    const dx = def.x - f.x;
    const dz = def.z - f.z;
    const sep = dist(dx, dz);

    // Positional gate. Out of reach, smothered, or misaligned in depth means
    // the punch simply keeps travelling this tick.
    if (sep > reach) return null;
    if (sep < p.minRange) return null;
    if (Math.abs(dz) > p.depthTolerance) return null;
    // A punch cannot land behind the attacker.
    if (sign(dx) !== 0 && sign(dx) !== f.facing) return null;

    f.punchResolved = true;

    const quality = this.classifyContact(corner, p, f.activeLevel, def, sep, reach);
    return {
      attacker: corner,
      defender: other,
      punch: p,
      punchId: f.activePunch,
      level: f.activeLevel,
      quality,
      sep,
    };
  }

  private classifyContact(
    corner: 0 | 1,
    p: PunchDefinition,
    level: TargetLevel,
    def: DefenseSnapshot,
    sep: number,
    reach: number,
  ): HitQuality {
    const other: 0 | 1 = corner === 0 ? 1 : 0;
    const dDef = this.derived[other];

    // Evasion beats everything: a slip inside the window makes the punch miss.
    if (def.slipping && def.stateTicks <= dDef.slipTicks) return 'slipped';

    // A guard at the right level absorbs. A guard at the wrong level does not
    // protect the exposed target, which is what makes level-switching matter.
    const guardsHead = def.guarding;
    const guardsBody = def.crouching;
    const correctlyGuarded = (level === 'head' && guardsHead) || (level === 'body' && guardsBody);
    if (correctlyGuarded && def.guardIntegrity > 0) return 'blocked';

    // Counter: the defender is inside the explicit vulnerability window of
    // their own punch. This is a state check, never a damage-bonus coin flip.
    if (def.activePunch !== null && def.punchElapsed >= 0) {
      const dp = getPunch(def.activePunch, def.activeLevel);
      if (def.punchElapsed >= dp.vulnerableFrom && def.punchElapsed <= dp.vulnerableTo) {
        return 'counter';
      }
    }

    // Evasion. Between "blocked it" and "ate it" sits the largest part of real
    // boxing: the punch that simply does not find its man. This is where the
    // defence and footwork ratings earn their keep, and it is what gives an
    // out-boxer an identity beyond standing further away.
    const atk = this.definitions[corner].secondary;
    const dfn = this.definitions[other];
    const defender = this.state.fighters[other];

    let land = 0.52 + (atk.accuracy - 50) / 220;
    land -= (dfn.secondary.footwork - 50) / 180;
    land -= (dfn.ratings.defense - 50) / 260;
    // A fighter who is on the move is harder to catch cleanly.
    if (def.state === 'move') {
      const awayFromAttacker = defender.vx * (def.x >= this.state.fighters[corner].x ? 1 : -1);
      land -= awayFromAttacker > 0.1 ? 0.2 : 0.09;
    }
    // Reaching for someone at the end of your range costs precision.
    land -= (sep / reach) * 0.2;
    // Exhaustion makes a fighter stand still and get hit.
    land += defender.exertion * 0.14;
    // Someone already badly hurt stops evading well.
    land += (1 - defender.balance) * 0.12;

    if (!this.rng.chance(clamp(land, 0.22, 0.94))) return 'miss';

    // At the very edge of reach the punch arrives without leverage. Straight
    // punches have a wide fringe; a short uppercut either lands or it does not.
    const fringe = p.family === 'uppercut' ? 0.97 : p.family === 'hook' ? 0.93 : 0.9;
    if (sep > reach * fringe) return 'glancing';

    // A guard at the wrong level still deflects a little.
    if ((guardsHead || guardsBody) && !correctlyGuarded) {
      const atk = this.definitions[corner].secondary.accuracy;
      return atk >= 62 ? 'clean' : 'glancing';
    }

    return 'clean';
  }

  private applyHit(h: PendingHit): void {
    const atk = this.state.fighters[h.attacker];
    const def = this.state.fighters[h.defender];
    const dAtk = this.derived[h.attacker];
    const dDef = this.derived[h.defender];
    const p = h.punch;

    if (h.quality === 'miss') {
      this.emit({ type: 'punch_result', corner: h.attacker, punch: h.punchId, level: h.level, quality: 'miss', severity: 0, x: def.x, z: def.z });
      this.currentScore.defense[h.defender] += 0.3;
      atk.commitTicks += p.whiffExtraTicks;
      return;
    }

    if (h.quality === 'slipped') {
      this.emit({ type: 'punch_result', corner: h.attacker, punch: h.punchId, level: h.level, quality: 'slipped', severity: 0, x: def.x, z: def.z });
      this.currentScore.defense[h.defender] += 0.8;
      atk.commitTicks += p.whiffExtraTicks;
      return;
    }

    const variance = this.rng.variance(0.08);
    const resist = h.level === 'head' ? dDef.headResist : dDef.bodyResist;
    // Punches carry less when there is nothing left in the tank.
    const gas = 0.8 + 0.2 * (1 - clamp01(atk.exertion));

    // Combo scaling. Each punch landed on a fighter who is still reeling from
    // the last one does progressively less. Without it, a slugger chains hit
    // reactions together and the defender never gets a tick to answer, which
    // made ten landed heavy punches worth more than a hundred clean jabs.
    const reeling = def.state === 'hit_light' || def.state === 'hit_heavy' || def.state === 'stagger';
    def.chainHits = reeling ? def.chainHits + 1 : 0;
    const chain = 1 / (1 + def.chainHits * 0.55);

    if (h.quality === 'blocked') {
      def.guardIntegrity = clamp01(def.guardIntegrity - p.guardDamage / Math.max(0.4, dDef.guardAbsorb + 0.35));
      // A guard leaks. It never makes a fighter immune.
      const leak = 1 - dDef.guardAbsorb * def.guardIntegrity;
      const chip = (p.composureDamage * dAtk.powerScale * gas * variance * leak * 0.5) / dDef.chinResist;
      def.composure = Math.max(0, def.composure - chip);
      def.exertion = clamp01(def.exertion + p.exertionCost * 0.45 * dDef.exertionRate);
      def.balance = clamp01(def.balance - p.staggerPower * 0.18);
      atk.punchesBlocked++;
      this.currentScore.defense[h.defender] += 0.45;
      this.currentScore.clean[h.attacker] += p.scoreValue * 0.12;

      this.emit({ type: 'punch_result', corner: h.attacker, punch: h.punchId, level: h.level, quality: 'blocked', severity: 0.2, x: def.x, z: def.z });

      if (def.guardIntegrity <= 0) {
        this.emit({ type: 'guard_break', corner: h.defender });
        if (transition(def, 'stagger')) def.commitTicks = STAGGER_TICKS;
        def.balance = clamp01(def.balance - 0.3);
      }
      return;
    }

    const qualityMult =
      h.quality === 'counter' ? p.counterBonus : h.quality === 'glancing' ? 0.5 : 1.0;

    const composureDmg = (p.composureDamage * dAtk.powerScale * gas * chain * qualityMult * variance) / dDef.chinResist;
    const resilienceDmg = (p.resilienceDamage * dAtk.powerScale * gas * chain * qualityMult * variance) / resist;
    const traumaDmg = (p.traumaDamage * dAtk.powerScale * chain * qualityMult * variance) / resist;

    def.composure = Math.max(0, def.composure - composureDmg);
    def.resilience = Math.max(this.derived[h.defender].resilienceMax * 0.32, def.resilience - resilienceDmg);
    if (def.composure > def.resilience) def.composure = def.resilience;

    if (h.level === 'head') def.headTrauma = clamp01(def.headTrauma + traumaDmg);
    else def.bodyTrauma = clamp01(def.bodyTrauma + traumaDmg);

    // Body work is what makes a fighter tired; head work is what drops them.
    def.exertion = clamp01(def.exertion + (h.level === 'body' ? 0.019 : 0.006) * qualityMult * dDef.exertionRate);
    // A fresh fighter absorbs a big shot; a worn one loses their legs to the
    // same punch. Scaling balance loss by how depleted composure already is
    // makes the layered damage model do its job: volume wears a fighter down,
    // and power finishes what the volume started. Without this, three clean
    // hooks flatten anyone regardless of what came before.
    const wornFrac = 1 - clamp01(def.composure / Math.max(1, def.resilienceMax));
    def.balance = clamp01(
      def.balance - p.staggerPower * chain * qualityMult * (2 - dDef.chinResist) * (0.32 + 0.95 * wornFrac),
    );

    atk.punchesLanded++;
    if (h.level === 'body') atk.bodyLanded++;
    else atk.headLanded++;

    const severity = clamp01(composureDmg / 14);
    this.currentScore.clean[h.attacker] += p.scoreValue * (h.quality === 'glancing' ? 0.45 : h.quality === 'counter' ? 1.3 : 1);

    this.emit({
      type: 'punch_result',
      corner: h.attacker,
      punch: h.punchId,
      level: h.level,
      quality: h.quality,
      severity,
      x: def.x,
      z: def.z,
    });

    // Referee concern grows when a fighter keeps absorbing clean punishment in
    // a region that is already critical.
    const criticalRegion = h.level === 'head' ? def.headTrauma : def.bodyTrauma;
    if (this.ruleset.refereeStoppage && criticalRegion > 0.86 && h.quality !== 'glancing') {
      this.state.refereeConcern[h.defender] = clamp01(
        this.state.refereeConcern[h.defender] + 0.020 + (criticalRegion - 0.86) * 0.30,
      );
    }

    // Reaction severity picks the animation and the lockout.
    if (def.composure <= 0 || def.balance <= 0.12) {
      // Knockdown is detected in checkKnockdowns so both fighters resolve in
      // a single, consistent place.
      return;
    }
    if (severity > 0.55 || def.balance < 0.34) {
      if (transition(def, 'stagger')) def.commitTicks = STAGGER_TICKS;
    } else if (severity > 0.28) {
      if (transition(def, 'hit_heavy')) def.commitTicks = HIT_HEAVY_TICKS;
    } else {
      if (transition(def, 'hit_light')) def.commitTicks = HIT_LIGHT_TICKS;
    }
  }

  // --- Movement ------------------------------------------------------------

  private integrate(corner: 0 | 1, cmd: FighterCommand): void {
    const f = this.state.fighters[corner];
    const d = this.derived[corner];
    if (isGrounded(f.state) || f.state === 'corner' || f.state === 'intro' || f.state === 'clinch') {
      f.vx = 0;
      f.vz = 0;
      return;
    }

    let allowance = 1;
    if (f.state === 'punch_startup' || f.state === 'punch_active' || f.state === 'punch_recover') {
      allowance = f.activePunch ? getPunch(f.activePunch, f.activeLevel).movementAllowance : 0.3;
    } else if (f.state === 'guard' || f.state === 'crouch') {
      allowance = 0.62;
    } else if (f.state === 'hit_light') {
      allowance = 0.3;
    } else if (f.state === 'hit_heavy' || f.state === 'stagger') {
      allowance = 0.12;
    } else if (f.state === 'slip') {
      allowance = 0.85;
    }

    const speed = d.moveSpeed * exertionPenalty(f) * allowance;
    // moveX is relative to facing, so "forward" always means "at the opponent".
    let targetVx = cmd.moveX * f.facing * speed;

    // A punch steps in behind itself. Without this the whole game is decided by
    // whoever walks backwards fastest.
    if (f.state === 'punch_startup' && f.activePunch) {
      const lunge = d.moveSpeed * 0.5 * exertionPenalty(f);
      targetVx = f.facing * Math.max(Math.abs(targetVx), lunge) * (cmd.moveX < 0 ? -1 : 1);
    }
    const targetVz = cmd.moveZ * speed * 0.8;

    f.vx = approach(f.vx, targetVx, d.accel);
    f.vz = approach(f.vz, targetVz, d.accel);
    f.x += f.vx;
    f.z += f.vz;

    // The ropes are a hard boundary; there is no leaving the ring.
    const limX = RING.halfWidth - RING.bodyRadius;
    const limZ = RING.halfDepth - RING.bodyRadius;
    if (f.x < -limX) { f.x = -limX; f.vx = 0; }
    if (f.x > limX) { f.x = limX; f.vx = 0; }
    if (f.z < -limZ) { f.z = -limZ; f.vz = 0; }
    if (f.z > limZ) { f.z = limZ; f.vz = 0; }

    if (cmd.moveX !== 0 || cmd.moveZ !== 0) {
      f.exertion = clamp01(f.exertion + 0.00028 * d.exertionRate);
    }
  }

  /** Fighters occupy space; they cannot stand inside one another. */
  private separate(): void {
    const [a, b] = this.state.fighters;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const sep = dist(dx, dz);
    const min = RING.bodyRadius * 2;
    if (sep >= min || sep === 0) return;
    const push = (min - sep) * 0.5;
    const ux = dx / Math.max(0.001, sep);
    const uz = dz / Math.max(0.001, sep);
    a.x -= ux * push;
    a.z -= uz * push * 0.6;
    b.x += ux * push;
    b.z += uz * push * 0.6;
    const limX = RING.halfWidth - RING.bodyRadius;
    const limZ = RING.halfDepth - RING.bodyRadius;
    a.x = clamp(a.x, -limX, limX);
    b.x = clamp(b.x, -limX, limX);
    a.z = clamp(a.z, -limZ, limZ);
    b.z = clamp(b.z, -limZ, limZ);
  }

  /** Facing always points at the opponent, so a punch can never fire backwards. */
  private updateFacing(): void {
    const [a, b] = this.state.fighters;
    if (isGrounded(a.state) || isGrounded(b.state)) return;
    const s = sign(b.x - a.x);
    if (s !== 0) {
      a.facing = s;
      b.facing = -s;
    }
  }

  // --- Passive condition ---------------------------------------------------

  private tickCondition(corner: 0 | 1): void {
    const f = this.state.fighters[corner];
    const d = this.derived[corner];
    const other = this.state.fighters[corner === 0 ? 1 : 0];

    // Composure returns when a fighter is not being hit, but only up to the
    // resilience they have left. Distance buys recovery — that is the whole
    // reason to move away when hurt.
    const sep = dist(other.x - f.x, other.z - f.z);
    const spacing = sep > 70 ? 2.0 : sep > 46 ? 1.0 : 0.25;
    const notReacting = f.state !== 'hit_light' && f.state !== 'hit_heavy' && f.state !== 'stagger';
    if (notReacting) {
      f.composure = Math.min(f.resilience, f.composure + d.composureRegen * spacing);
    }

    f.balance = clamp01(f.balance + d.balanceRegen * (notReacting ? 1 : 0.35));
    if (notReacting) f.chainHits = 0;

    if (f.state === 'guard' || f.state === 'crouch') {
      f.guardIntegrity = clamp01(f.guardIntegrity + d.guardRegen);
      f.exertion = clamp01(f.exertion + 0.00016 * d.exertionRate);
    } else {
      f.guardIntegrity = clamp01(f.guardIntegrity + d.guardRegen * 0.55);
    }

    const resting = f.state === 'idle' || f.state === 'guard' || f.state === 'clinch';
    f.exertion = clamp01(f.exertion - d.exertionRecovery * (resting ? 1.5 : 0.7));

    if (this.state.refereeConcern[corner] > 0 && notReacting) {
      this.state.refereeConcern[corner] = Math.max(0, this.state.refereeConcern[corner] - 0.00035);
    }

    if (onRopes(f)) {
      f.ropeTicks++;
      this.ropeCue[corner]++;
      if (this.ropeCue[corner] % 45 === 1) this.emit({ type: 'rope_pressure', corner });
    } else {
      this.ropeCue[corner] = 0;
    }
  }

  private tickClinch(commands: [FighterCommand, FighterCommand]): void {
    const [a, b] = this.state.fighters;
    if (this.clinchCooldown > 0) this.clinchCooldown--;

    if (a.state === 'clinch' || b.state === 'clinch') {
      this.clinchTimer++;
      a.clinchTicks++;
      b.clinchTicks++;
      // Clinching is a rest, but a shallow one.
      for (let i = 0; i < 2; i++) {
        const f = this.state.fighters[i];
        f.composure = Math.min(f.resilience, f.composure + this.derived[i].composureRegen * 0.9);
        f.exertion = clamp01(f.exertion - this.derived[i].exertionRecovery * 0.8);
      }
      if (this.clinchTimer >= CLINCH_TICKS) {
        transition(a, 'idle');
        transition(b, 'idle');
        this.clinchTimer = 0;
        this.clinchCooldown = CLINCH_COOLDOWN;
        // The referee restores a clean, deterministic distance.
        const mid = (a.x + b.x) * 0.5;
        const half = CLINCH_BREAK_SEP * 0.5;
        const limX = RING.halfWidth - RING.bodyRadius;
        a.x = clamp(mid - half * (a.x <= b.x ? 1 : -1), -limX, limX);
        b.x = clamp(mid + half * (a.x <= b.x ? 1 : -1), -limX, limX);
        a.z = 0;
        b.z = 0;
        this.emit({ type: 'clinch_break' });
      }
      return;
    }

    if (this.clinchCooldown > 0) return;
    const sep = dist(b.x - a.x, b.z - a.z);
    if (sep > CLINCH_RANGE) return;

    for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
      const f = this.state.fighters[i];
      if (!commands[i].clinch) continue;
      if (isCommitted(f.state) || isGrounded(f.state)) continue;
      const opp = this.state.fighters[i === 0 ? 1 : 0];
      // You cannot tie up someone who is mid-punch — they have to be there to
      // be held. Both fighters must be in a clinchable state.
      if (isCommitted(opp.state) || isGrounded(opp.state)) continue;
      transition(a, 'clinch');
      transition(b, 'clinch');
      this.clinchTimer = 0;
      this.emit({ type: 'clinch_start', corner: i });

      // Stalling is legal but the referee notices, and the judges do too.
      if (f.clinchTicks > this.ruleset.roundTicks * 0.22) {
        this.emit({ type: 'referee_warning', corner: i, reasonKey: 'referee.holding' });
        this.currentScore.ringControl[i === 0 ? 1 : 0] += 2;
      }
      return;
    }
  }

  // --- Knockdowns and stoppages -------------------------------------------

  private checkKnockdowns(): boolean {
    const candidates: (0 | 1)[] = [];
    for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
      const f = this.state.fighters[i];
      if (!isHittable(f.state)) continue;
      if (f.composure <= 0 || f.balance <= 0.12) candidates.push(i);
    }
    if (candidates.length === 0) return false;

    // Simultaneous knockdowns: the fighter in worse condition goes down and the
    // other is left badly hurt but standing. Documented in docs/DECISIONS.md.
    let downCorner = candidates[0];
    if (candidates.length === 2) {
      const a = this.state.fighters[0];
      const b = this.state.fighters[1];
      downCorner = a.composure <= b.composure ? 0 : 1;
      const standing = this.state.fighters[downCorner === 0 ? 1 : 0];
      standing.composure = Math.max(standing.composure, standing.resilience * 0.14);
      standing.balance = Math.max(standing.balance, 0.2);
      if (transition(standing, 'stagger')) standing.commitTicks = STAGGER_TICKS;
    }

    this.knockDown(downCorner);
    return true;
  }

  private knockDown(corner: 0 | 1): void {
    const f = this.state.fighters[corner];
    f.knockdownsThisRound++;
    f.knockdownsTotal++;
    f.countReached = 0;
    f.riseProgress = 0;
    // How hard this particular knockdown is to get up from. Fixed now so the
    // player can be shown it, and so it cannot drift while they are counting.
    f.riseDifficulty =
      1 +
      f.knockdownsTotal * 0.6 +
      Math.max(f.headTrauma, f.bodyTrauma) * 1.6 +
      f.exertion * 0.9 +
      (1 - f.resilience / Math.max(1, f.resilienceMax)) * 1.2;
    f.riseTapCooldown = 0;
    f.composure = 0;
    f.balance = 0;
    f.vx = 0;
    f.vz = 0;
    f.resilience = Math.max(f.resilienceMax * 0.32, f.resilience - f.resilienceMax * KNOCKDOWN_RESILIENCE_COST);
    transition(f, 'knockdown');

    this.currentScore.knockdowns[corner === 0 ? 1 : 0] += 1;
    this.state.refereeConcern[corner] = clamp01(this.state.refereeConcern[corner] + 0.18);
    this.emit({ type: 'knockdown', corner, round: this.state.round, count: f.knockdownsThisRound });

    // Three knockdowns in a round ends it, if the ruleset says so.
    if (this.ruleset.threeKnockdownRule && f.knockdownsThisRound >= this.ruleset.knockdownsForTko) {
      this.stop('tko', corner === 0 ? 1 : 0, 'outcome.tko.threeKnockdown');
      return;
    }

    this.state.phase = 'knockdown';
    this.state.groundedCorner = corner;
    this.state.phaseTicks = 0;
  }

  private tickKnockdown(commands: [FighterCommand, FighterCommand]): void {
    const corner = this.state.groundedCorner!;
    const f = this.state.fighters[corner];
    const d = this.derived[corner];
    const opp = this.state.fighters[corner === 0 ? 1 : 0];

    // The standing fighter walks to a neutral corner; nothing else happens.
    opp.vx = 0;
    opp.vz = 0;

    this.state.phaseTicks++;

    // The count.
    const nextCount = Math.floor(this.state.phaseTicks / this.ruleset.countTicks) + 1;
    if (nextCount > f.countReached && nextCount <= this.ruleset.countLimit) {
      f.countReached = nextCount;
      this.emit({ type: 'count', corner, n: nextCount });
    }

    if (f.state === 'rising') {
      if (f.stateTicks >= 24) {
        transition(f, 'idle');
        f.composure = Math.max(f.composure, f.resilience * RISE_COMPOSURE);
        f.balance = 0.62;
        f.guardIntegrity = 1;
        f.commitTicks = 0;
        this.state.phase = 'round_active';
        this.state.groundedCorner = null;
        // Restore a fair restart distance.
        const limX = RING.halfWidth - RING.bodyRadius;
        f.x = clamp(f.x, -limX, limX);
        opp.x = clamp(f.x + (opp.x >= f.x ? 60 : -60), -limX, limX);
        opp.z = 0;
        f.z = 0;
      }
      f.stateTicks++;
      return;
    }

    // Recovery: taps accelerate a rise that also progresses on its own, so a
    // player who cannot mash is slower but never locked out. See
    // docs/ACCESSIBILITY.md.
    const cmd = commands[corner];
    // Recovery is always progressing, so a player who cannot mash still gets
    // up — just later, and not always in time. Taps accelerate it.
    const ease = 1 / Math.max(1, f.riseDifficulty);
    f.riseProgress = clamp01(f.riseProgress + d.risePassive * ease);
    if (f.riseTapCooldown > 0) f.riseTapCooldown--;
    if (cmd.recover && f.riseTapCooldown === 0) {
      // Mashing faster than a person can usefully move does not help. The cap
      // is what stops recovery from being a test of finger speed.
      f.riseTapCooldown = 6;
      f.riseProgress = clamp01(f.riseProgress + d.riseRate * ease);
    }
    f.stateTicks++;

    if (f.riseProgress >= 1) {
      transition(f, 'rising');
      this.emit({ type: 'rise', corner });
      return;
    }

    if (f.countReached >= this.ruleset.countLimit) {
      transition(f, 'knocked_out');
      this.stop('ko', corner === 0 ? 1 : 0, 'outcome.ko.count');
    }
  }

  private checkStoppage(): boolean {
    if (!this.ruleset.refereeStoppage) return false;
    for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
      if (this.state.refereeConcern[i] >= 1) {
        const f = this.state.fighters[i];
        const key = f.headTrauma >= f.bodyTrauma ? 'outcome.tko.head' : 'outcome.tko.body';
        this.stop('tko', i === 0 ? 1 : 0, key);
        return true;
      }
    }
    return false;
  }

  private stop(kind: 'ko' | 'tko', winner: 0 | 1, reasonKey: string): void {
    // A stopped bout still banks the round in progress for the record.
    this.state.scores.push(this.currentScore);
    const scorecards = buildScorecards(this.state.scores, this.rng);
    this.state.outcome = {
      kind,
      winner,
      round: this.state.round,
      tick: this.state.roundTick,
      reasonKey,
      scorecards,
    };
    const loser: 0 | 1 = winner === 0 ? 1 : 0;
    transition(this.state.fighters[winner], 'celebrate');
    if (this.state.fighters[loser].state !== 'knocked_out') {
      transition(this.state.fighters[loser], 'defeated');
    }
    this.state.phase = 'stoppage';
    this.state.groundedCorner = null;
  }

  private resolveDecision(): void {
    const scorecards = buildScorecards(this.state.scores, this.rng);
    const winner = decisionWinner(scorecards);
    const outcome: BoutOutcome = {
      kind: winner === null ? 'draw' : 'decision',
      winner,
      round: this.state.round,
      tick: this.state.roundTick,
      reasonKey: decisionKindKey(scorecards, winner),
      scorecards,
    };
    this.state.outcome = outcome;
    if (winner !== null) {
      transition(this.state.fighters[winner], 'celebrate');
      transition(this.state.fighters[winner === 0 ? 1 : 0], 'defeated');
    }
    this.state.phase = 'decision';
  }

  private finish(): void {
    this.state.phase = 'complete';
    this.emit({ type: 'bout_end', outcome: this.state.outcome! });
  }

  // --- Scoring -------------------------------------------------------------

  private accrueScore(): void {
    const [a, b] = this.state.fighters;
    const sep = dist(b.x - a.x, b.z - a.z);

    for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
      const f = this.state.fighters[i];
      const opp = this.state.fighters[i === 0 ? 1 : 0];

      // Effective aggression: coming forward inside punching range, not just
      // walking around.
      if (sep < 62 && f.vx * f.facing > 0.15) this.currentScore.aggression[i] += 0.0022;

      // Ring control: putting the other fighter on the ropes, and owning the
      // centre of the ring.
      if (onRopes(opp) && !onRopes(f)) this.currentScore.ringControl[i] += 0.0035;
      if (Math.abs(f.x) < Math.abs(opp.x) - 20) this.currentScore.ringControl[i] += 0.001;
    }
  }

  // -------------------------------------------------------------------------
  // Determinism support
  // -------------------------------------------------------------------------

  /**
   * A stable hash of every value that can influence future simulation steps.
   * Identical seeds plus identical inputs must produce identical hashes; the
   * determinism tests assert exactly that.
   */
  hashState(): string {
    const parts: (number | string)[] = [
      this.state.phase,
      this.state.round,
      this.state.roundTick,
      this.state.phaseTicks,
      this.state.groundedCorner ?? -1,
      quantize(this.state.refereeConcern[0]),
      quantize(this.state.refereeConcern[1]),
    ];
    for (const f of this.state.fighters) {
      parts.push(
        f.state,
        f.stateTicks,
        f.commitTicks,
        f.activePunch ?? '-',
        f.activeLevel,
        f.punchResolved ? 1 : 0,
        quantize(f.x),
        quantize(f.z),
        quantize(f.vx),
        quantize(f.vz),
        f.facing,
        quantize(f.composure),
        quantize(f.resilience),
        quantize(f.headTrauma),
        quantize(f.bodyTrauma),
        quantize(f.exertion),
        quantize(f.guardIntegrity),
        quantize(f.balance),
        f.knockdownsThisRound,
        f.knockdownsTotal,
        f.countReached,
        quantize(f.riseProgress),
        quantize(f.riseDifficulty),
        f.riseTapCooldown,
        f.punchesThrown,
        f.punchesLanded,
        f.punchesBlocked,
        f.chainHits,
        f.bufferedPunch ?? '-',
      );
    }
    const s = parts.join('|');
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  /** Live punch statistics for the HUD and the post-fight report. */
  stats(corner: 0 | 1): { thrown: number; landed: number; percent: number; head: number; body: number } {
    const f = this.state.fighters[corner];
    return {
      thrown: f.punchesThrown,
      landed: f.punchesLanded,
      percent: f.punchesThrown === 0 ? 0 : Math.round((f.punchesLanded / f.punchesThrown) * 100),
      head: f.headLanded,
      body: f.bodyLanded,
    };
  }
}
