/**
 * Ring presentation.
 *
 * Draws a venue, the ring, both fighters, the referee and the impact effects,
 * all procedurally. Nothing here influences the simulation: this module reads
 * `BoutState` and never writes to it, so turning every effect off changes how
 * the fight looks and not how it turns out.
 *
 * The view is a side-on 2.5D projection with a depth-scaled floor, which is
 * what lets a fighter circle upstage and downstage while staying readable.
 */
import Phaser from 'phaser';
import { RING, type BoutState, type FighterState } from '@sim/types';
import { getVenue, type VenueDefinition } from '@data/venues';
import { drawBoxer, resolvePose, type BoxerAppearance } from '@art/boxer';
import { getPunch } from '@data/punches';
import { UI } from '@art/palettes';
import { VIEW } from '@ui/kit';

/** Screen-space anchor for the ring floor. */
const FLOOR_Y = 240;
/** Ring units to pixels across the ring's width. */
const RING_SCALE = 1.7;
/** Vertical pixels per ring unit of depth. */
const DEPTH_Y = 0.42;
/** Corner-post height in ring units. Ropes are strung below this. */
const POST_H = 40;
/** Rope heights in ring units, bottom to top. All below POST_H. */
const ROPE_H = [11, 22, 33];

export interface RenderOptions {
  screenShake: boolean;
  hitFlash: boolean;
  reducedMotion: boolean;
  colorSafe: boolean;
  showHitboxes: boolean;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
}

/**
 * Maps ring coordinates to screen coordinates.
 *
 * The ring fills the frame: a fighter stands roughly 95 px tall at mid-depth on
 * the 640x360 canvas, which is what makes guard level, punch level and hit
 * reactions readable at a glance.
 */
export function project(x: number, z: number): ProjectedPoint {
  // Depth runs from -halfDepth (upstage, further away) to +halfDepth.
  const t = (z + RING.halfDepth) / (RING.halfDepth * 2);
  // Perspective: the far edge of the ring is narrower than the near edge.
  const perspective = 0.9 + 0.14 * t;
  return {
    x: VIEW.width / 2 + x * RING_SCALE * perspective * 0.52,
    y: FLOOR_Y + (z - RING.halfDepth * 0.15) * DEPTH_Y,
    scale: 1.5 + 0.34 * t,
  };
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  colour: number;
  size: number;
}

export class RingRenderer {
  private readonly scene: Phaser.Scene;
  private readonly venue: VenueDefinition;
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly ringBack: Phaser.GameObjects.Graphics;
  private readonly fighters: Phaser.GameObjects.Graphics;
  private readonly ringFront: Phaser.GameObjects.Graphics;
  private readonly fx: Phaser.GameObjects.Graphics;
  private sparks: Spark[] = [];
  private shake = 0;
  private flash = 0;
  private hitstop = 0;
  private clock = 0;
  private crowdEnergy = 0;
  private readonly looks: [BoxerAppearance, BoxerAppearance];
  private hurtFlash: [number, number] = [0, 0];
  private opts: RenderOptions;

  constructor(
    scene: Phaser.Scene,
    venueId: string,
    looks: [BoxerAppearance, BoxerAppearance],
    opts: RenderOptions,
    depth = 0,
  ) {
    this.scene = scene;
    this.venue = getVenue(venueId);
    this.looks = looks;
    this.opts = opts;

    this.backdrop = scene.add.graphics().setDepth(depth);
    this.ringBack = scene.add.graphics().setDepth(depth + 1);
    this.fighters = scene.add.graphics().setDepth(depth + 2);
    this.ringFront = scene.add.graphics().setDepth(depth + 3);
    this.fx = scene.add.graphics().setDepth(depth + 4);

    this.paintBackdrop();
  }

  setOptions(o: RenderOptions): void {
    this.opts = o;
  }

  /** The venue and crowd never change during a bout, so they are painted once. */
  private paintBackdrop(): void {
    const g = this.backdrop;
    const p = this.venue.palette;
    g.clear();
    g.fillStyle(p.backdrop, 1);
    g.fillRect(0, 0, VIEW.width, VIEW.height);

    // Crowd: banded silhouettes with deterministic head positions, so the
    // arena looks populated without a single imported pixel.
    let seed = 0x9e3779b9;
    const rnd = (): number => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      seed |= 0;
      return ((seed >>> 0) % 10000) / 10000;
    };

    for (let row = 0; row < this.venue.crowdRows; row++) {
      const t = row / Math.max(1, this.venue.crowdRows - 1);
      const y = 44 + row * 16;
      const colour = p.crowd[Math.min(p.crowd.length - 1, Math.floor(t * p.crowd.length))];
      g.fillStyle(colour, 1);
      g.fillRect(0, y, VIEW.width, 18);
      const headR = 3.4 + row * 0.5;
      const spacing = 11 + row * 1.4;
      for (let x = -6; x < VIEW.width + 6; x += spacing) {
        const jitter = (rnd() - 0.5) * 4;
        g.fillStyle(shade(colour, 0.55 + rnd() * 0.3), 1);
        g.fillCircle(x + jitter, y + 6 + rnd() * 2, headR);
        g.fillRect(x + jitter - headR, y + 8, headR * 2, 10);
      }
    }

    // Hanging lights.
    g.fillStyle(p.light, 0.1);
    for (let i = 0; i < 4; i++) {
      const lx = 80 + i * 160;
      g.fillTriangle(lx, 0, lx - 78, VIEW.height, lx + 78, VIEW.height);
    }
    if (this.venue.haze) {
      g.fillStyle(p.light, 0.045);
      g.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    // Apron and floor beyond the ring.
    g.fillStyle(shade(p.apron, 0.55), 1);
    g.fillRect(0, FLOOR_Y - 40, VIEW.width, VIEW.height - FLOOR_Y + 40);

    // Foreground ringside: the nearest row of heads, cropped by the frame.
    // It closes the composition and sells the camera position.
    const fgY = VIEW.height;
    const fgBase = shade(p.crowd[p.crowd.length - 1], 0.34);
    for (let x = -12; x < VIEW.width + 24; x += 27) {
      const j = (rnd() - 0.5) * 8;
      const h = 20 + rnd() * 8;
      g.fillStyle(shade(fgBase, 0.75 + rnd() * 0.5), 1);
      g.fillCircle(x + j, fgY - h, 8);
      g.fillRect(x + j - 10, fgY - h + 4, 20, h);
    }
  }

  /** Corner posts and the ring floor, drawn behind the fighters. */
  private paintRingBack(): void {
    const g = this.ringBack;
    const p = this.venue.palette;
    g.clear();

    const bl = project(-RING.halfWidth, RING.halfDepth);
    const br = project(RING.halfWidth, RING.halfDepth);
    const tl = project(-RING.halfWidth, -RING.halfDepth);
    const tr = project(RING.halfWidth, -RING.halfDepth);

    // Canvas.
    g.fillStyle(p.canvas, 1);
    g.fillPoints(
      [
        new Phaser.Geom.Point(tl.x, tl.y),
        new Phaser.Geom.Point(tr.x, tr.y),
        new Phaser.Geom.Point(br.x, br.y),
        new Phaser.Geom.Point(bl.x, bl.y),
      ],
      true,
    );
    // Centre marking gives the eye a reference for ring position.
    g.fillStyle(p.canvasShade, 0.5);
    const c = project(0, 0);
    g.fillEllipse(c.x, c.y, 150, 22);
    g.lineStyle(1, p.canvasShade, 0.6);
    g.strokeEllipse(c.x, c.y, 150, 22);

    // Apron edge.
    g.fillStyle(p.apron, 1);
    g.fillRect(bl.x, bl.y, br.x - bl.x, 14);

    // Far ropes and the two far posts. Both use the projected scale at that
    // depth so the ropes always meet the posts.
    this.ropes(g, tl, tr, -1);
    this.post(g, tl.x, tl.y, tl.scale);
    this.post(g, tr.x, tr.y, tr.scale);
  }

  /** Near ropes and posts, drawn over the fighters. */
  private paintRingFront(): void {
    const g = this.ringFront;
    g.clear();
    const bl = project(-RING.halfWidth, RING.halfDepth);
    const br = project(RING.halfWidth, RING.halfDepth);
    // Near ropes are drawn thin and semi-transparent so they never hide the
    // action — readability beats realism here.
    this.ropes(g, bl, br, 1, 0.55);
    this.post(g, bl.x, bl.y, bl.scale);
    this.post(g, br.x, br.y, br.scale);
  }

  private ropes(
    g: Phaser.GameObjects.Graphics,
    a: ProjectedPoint,
    b: ProjectedPoint,
    dir: number,
    alpha = 1,
  ): void {
    const cols = this.venue.palette.rope;
    for (let i = 0; i < ROPE_H.length; i++) {
      const h = ROPE_H[i];
      g.lineStyle(1.6, cols[i % cols.length], alpha);
      g.beginPath();
      g.moveTo(a.x, a.y - h * a.scale);
      // A little slack in the middle reads as rope rather than wire.
      g.lineTo((a.x + b.x) / 2, (a.y + b.y) / 2 - h * ((a.scale + b.scale) / 2) + 1.5 * dir);
      g.lineTo(b.x, b.y - h * b.scale);
      g.strokePath();
    }
  }

  private post(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number): void {
    const p = this.venue.palette;
    g.fillStyle(p.post, 1);
    g.fillRect(x - 2.0 * scale, y - POST_H * scale, 4 * scale, POST_H * scale);
    g.fillStyle(p.accent, 1);
    g.fillRect(x - 3.2 * scale, y - (POST_H + 3) * scale, 6.4 * scale, 4.5 * scale);
  }

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  /** Registers an impact. Purely cosmetic — the damage already happened. */
  impact(x: number, z: number, severity: number, quality: 'clean' | 'counter' | 'glancing' | 'blocked'): void {
    const p = project(x, z);
    const n = quality === 'blocked' ? 3 : Math.round(3 + severity * 9);
    const colour = quality === 'counter' ? 0xffe08a : quality === 'blocked' ? 0x9fb0c8 : 0xffd0a0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + severity;
      const speed = 0.6 + severity * 2.4;
      this.sparks.push({
        x: p.x,
        y: p.y - 38 * p.scale,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 0.4,
        life: 10 + severity * 14,
        maxLife: 10 + severity * 14,
        colour,
        size: 1 + severity * 2,
      });
    }

    if (quality !== 'blocked' && !this.opts.reducedMotion) {
      // Hitstop makes a clean punch land. It never delays input: the
      // simulation keeps ticking, only rendering pauses.
      this.hitstop = Math.min(6, Math.round(severity * 7));
    }
    if (this.opts.screenShake && !this.opts.reducedMotion) {
      this.shake = Math.min(5, severity * 6);
    }
    if (this.opts.hitFlash && quality !== 'blocked') {
      // Deliberately gentle and short: never a full-screen strobe.
      this.flash = Math.min(0.22, severity * 0.28);
    }
    this.crowdEnergy = Math.min(1, this.crowdEnergy + severity * 0.5);
  }

  flashFighter(corner: 0 | 1, amount: number): void {
    this.hurtFlash[corner] = Math.max(this.hurtFlash[corner], amount);
  }

  get hitstopTicks(): number {
    return this.hitstop;
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  render(state: BoutState, startups: [number, number], recoveries: [number, number]): void {
    this.clock++;
    if (this.hitstop > 0) this.hitstop--;
    this.crowdEnergy = Math.max(0, this.crowdEnergy - 0.012);

    this.paintRingBack();

    const g = this.fighters;
    g.clear();

    // Draw the upstage fighter first so depth reads correctly.
    const order: (0 | 1)[] = state.fighters[0].z <= state.fighters[1].z ? [0, 1] : [1, 0];

    for (const corner of order) {
      const f = state.fighters[corner];
      const p = project(f.x, f.z);
      const pose = resolvePose({
        state: f.state,
        stateTicks: f.stateTicks,
        activePunch: f.activePunch,
        activeLevel: f.activeLevel,
        startup: startups[corner],
        active: f.activePunch ? getPunch(f.activePunch, f.activeLevel).activeTicks : 3,
        recovery: recoveries[corner],
        speed: Math.abs(f.vx) + Math.abs(f.vz),
        exertion: f.exertion,
        riseProgress: f.riseProgress,
        clock: this.clock + corner * 37,
      });

      // Contact shadow anchors the fighter to the canvas.
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(p.x, p.y + 1, 22 * p.scale, 6 * p.scale);

      g.save();
      g.translateCanvas(p.x, p.y);
      g.scaleCanvas(p.scale * f.facing, p.scale);
      drawBoxer(g, pose, this.looks[corner], {
        hurtFlash: this.hurtFlash[corner],
        colorSafe: this.opts.colorSafe,
      });
      g.restore();

      this.hurtFlash[corner] = Math.max(0, this.hurtFlash[corner] - 0.12);

      if (this.opts.showHitboxes) this.drawHitboxes(g, f, p);
    }

    this.drawReferee(g, state);
    this.paintRingFront();
    this.renderFx();
    this.applyCamera();
  }

  /** Training-lab overlay: reach arcs and the active hurt regions. */
  private drawHitboxes(g: Phaser.GameObjects.Graphics, f: FighterState, p: ProjectedPoint): void {
    g.lineStyle(1, 0x4fd1ff, 0.55);
    // Hurt regions: head and body, matching what the guard actually protects.
    g.strokeRect(p.x - 7 * p.scale, p.y - 50 * p.scale, 14 * p.scale, 13 * p.scale);
    g.strokeRect(p.x - 9 * p.scale, p.y - 36 * p.scale, 18 * p.scale, 17 * p.scale);
    if (f.activePunch && f.state === 'punch_active') {
      const def = getPunch(f.activePunch, f.activeLevel);
      g.lineStyle(1, 0xff5f5f, 0.9);
      const reach = def.reach * RING_SCALE * p.scale;
      const y = p.y - (f.activeLevel === 'head' ? 44 : 30) * p.scale;
      g.strokeRect(p.x, y - 4, reach * f.facing, 8);
    }
  }

  /** The referee is present and reacts, without ever blocking the action. */
  private drawReferee(g: Phaser.GameObjects.Graphics, state: BoutState): void {
    const grounded = state.groundedCorner;
    let rx: number;
    let rz: number;
    if (grounded !== null) {
      const f = state.fighters[grounded];
      rx = f.x + (f.x > 0 ? -34 : 34);
      rz = f.z - 18;
    } else {
      const mid = (state.fighters[0].x + state.fighters[1].x) / 2;
      rx = mid + 62 * (mid > 0 ? -1 : 1);
      rz = -RING.halfDepth * 0.55;
    }
    const p = project(rx, rz);
    const s = p.scale * 0.86;
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(p.x, p.y + 1, 18 * s, 5 * s);
    // Striped shirt keeps the referee legible against every venue palette.
    g.fillStyle(0xf2f2f2, 1);
    g.fillRect(p.x - 5 * s, p.y - 32 * s, 10 * s, 16 * s);
    g.fillStyle(0x1a1a1a, 1);
    for (let i = 0; i < 3; i++) g.fillRect(p.x - 5 * s + i * 3.4 * s, p.y - 32 * s, 1.5 * s, 16 * s);
    g.fillStyle(0x22262e, 1);
    g.fillRect(p.x - 4 * s, p.y - 16 * s, 8 * s, 16 * s);
    g.fillStyle(0xc98f5f, 1);
    g.fillCircle(p.x, p.y - 35 * s, 4.6 * s);
    // Counting arm.
    if (grounded !== null) {
      const swing = Math.sin(this.clock * 0.24) * 6 * s;
      g.lineStyle(2.4 * s, 0xc98f5f, 1);
      g.beginPath();
      g.moveTo(p.x + 4 * s, p.y - 30 * s);
      g.lineTo(p.x + 10 * s, p.y - 40 * s + swing);
      g.strokePath();
    }
  }

  private renderFx(): void {
    const g = this.fx;
    g.clear();
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const s of this.sparks) {
      s.life--;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.12;
      const a = s.life / s.maxLife;
      g.fillStyle(s.colour, a);
      g.fillRect(s.x, s.y, s.size, s.size);
    }
    if (this.flash > 0) {
      g.fillStyle(0xffffff, this.flash);
      g.fillRect(0, 0, VIEW.width, VIEW.height);
      this.flash = Math.max(0, this.flash - 0.045);
    }
  }

  private applyCamera(): void {
    const cam = this.scene.cameras.main;
    if (this.shake > 0.05) {
      cam.setScroll((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.6);
      this.shake *= 0.78;
    } else if (cam.scrollX !== 0 || cam.scrollY !== 0) {
      cam.setScroll(0, 0);
      this.shake = 0;
    }
  }

  /** Crowd loudness, 0..1, for the audio bed. */
  get energy(): number {
    return Math.min(1, this.venue.crowdBase + this.crowdEnergy * this.venue.crowdVolatility);
  }

  destroy(): void {
    this.backdrop.destroy();
    this.ringBack.destroy();
    this.fighters.destroy();
    this.ringFront.destroy();
    this.fx.destroy();
    this.scene.cameras.main.setScroll(0, 0);
  }
}

function shade(c: number, t: number): number {
  const r = Math.round(((c >> 16) & 0xff) * t);
  const g = Math.round(((c >> 8) & 0xff) * t);
  const b = Math.round((c & 0xff) * t);
  return (r << 16) | (g << 8) | b;
}

export const RING_UI = UI;
