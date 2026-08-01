/**
 * Audio.
 *
 * Every sound in the game is synthesised at runtime with the Web Audio API.
 * There are no audio files, which means there is nothing to license and
 * nothing to ship: the whole soundtrack and effects set is code.
 *
 * Four buses (music, sfx, crowd, all under master) are exposed to the settings
 * screen. The context is created suspended and only resumed on a real user
 * gesture, per browser autoplay policy.
 */
import type { AudioSettings } from '@save/schema';

type Ctx = AudioContext;

export type SfxId =
  | 'menu_move'
  | 'menu_confirm'
  | 'menu_back'
  | 'menu_error'
  | 'bell_single'
  | 'bell_triple'
  | 'count'
  | 'whiff'
  | 'block'
  | 'guard_break'
  | 'hit_head_light'
  | 'hit_head_heavy'
  | 'hit_body_light'
  | 'hit_body_heavy'
  | 'counter'
  | 'footwork'
  | 'knockdown'
  | 'rise'
  | 'crowd_pop'
  | 'crowd_ooh'
  | 'victory'
  | 'defeat'
  | 'rope';

export type MusicId = 'gym' | 'arena' | 'coliseum' | 'menu' | 'none';

export class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private crowdBus: GainNode | null = null;
  private crowdSource: { stop(): void } | null = null;
  private musicTimer: number | null = null;
  private musicId: MusicId = 'none';
  private settings: AudioSettings;
  /** Prevents a wall of simultaneous impacts from clipping the master bus. */
  private recentImpacts: number[] = [];
  private started = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(settings: AudioSettings) {
    this.settings = settings;
  }

  get isRunning(): boolean {
    return this.started && this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx === null) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      // A gentle limiter keeps stacked glove impacts from clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.crowdBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.crowdBus.connect(this.master);

      this.noiseBuffer = this.makeNoise();
      this.applySettings(this.settings);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.started = true;
  }

  applySettings(s: AudioSettings): void {
    this.settings = s;
    if (!this.ctx || !this.master) return;
    const m = s.muted ? 0 : s.master;
    this.master.gain.value = m;
    if (this.musicBus) this.musicBus.gain.value = s.music;
    if (this.sfxBus) this.sfxBus.gain.value = s.sfx;
    if (this.crowdBus) this.crowdBus.gain.value = s.crowd;
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Deterministic noise so the sound is identical every run.
    let x = 0x2f6e2b1;
    for (let i = 0; i < len; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      x |= 0;
      data[i] = ((x >>> 0) / 0xffffffff) * 2 - 1;
    }
    return buf;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private tone(
    bus: GainNode,
    opts: {
      freq: number;
      type?: OscillatorType;
      dur: number;
      gain: number;
      attack?: number;
      sweepTo?: number;
      delay?: number;
      detune?: number;
    },
  ): void {
    if (!this.ctx) return;
    const t = this.now() + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.sweepTo), t + opts.dur);
    }
    if (opts.detune) osc.detune.value = opts.detune;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + opts.dur + 0.05);
  }

  private noise(
    bus: GainNode,
    opts: { dur: number; gain: number; filter: number; q?: number; type?: BiquadFilterType; delay?: number; sweepTo?: number },
  ): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.now() + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.setValueAtTime(opts.filter, t);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweepTo), t + opts.dur);
    filter.Q.value = opts.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + opts.dur + 0.05);
  }

  /**
   * Impact density limiter. A flurry produces many events in a few frames; this
   * ducks the later ones so the mix stays readable instead of turning to mush.
   */
  private impactGain(base: number): number {
    const t = this.now();
    this.recentImpacts = this.recentImpacts.filter((x) => t - x < 0.35);
    const n = this.recentImpacts.length;
    this.recentImpacts.push(t);
    return base / (1 + n * 0.55);
  }

  play(id: SfxId, intensity = 1): void {
    if (!this.ctx || !this.sfxBus || !this.crowdBus) return;
    const sfx = this.sfxBus;
    const crowd = this.crowdBus;
    const i = Math.max(0.1, Math.min(1.4, intensity));

    switch (id) {
      case 'menu_move':
        this.tone(sfx, { freq: 520, type: 'square', dur: 0.05, gain: 0.05 });
        break;
      case 'menu_confirm':
        this.tone(sfx, { freq: 480, type: 'square', dur: 0.07, gain: 0.07 });
        this.tone(sfx, { freq: 720, type: 'square', dur: 0.09, gain: 0.06, delay: 0.05 });
        break;
      case 'menu_back':
        this.tone(sfx, { freq: 360, type: 'square', dur: 0.08, gain: 0.06, sweepTo: 240 });
        break;
      case 'menu_error':
        this.tone(sfx, { freq: 180, type: 'sawtooth', dur: 0.16, gain: 0.07 });
        break;

      // The bell is a struck metal body: two inharmonic partials with a long tail.
      case 'bell_single':
      case 'bell_triple': {
        const strikes = id === 'bell_triple' ? 3 : 1;
        for (let k = 0; k < strikes; k++) {
          const d = k * 0.34;
          this.tone(sfx, { freq: 848, type: 'sine', dur: 1.5, gain: 0.24, delay: d, attack: 0.002 });
          this.tone(sfx, { freq: 1279, type: 'sine', dur: 1.2, gain: 0.14, delay: d, attack: 0.002 });
          this.tone(sfx, { freq: 2310, type: 'sine', dur: 0.7, gain: 0.07, delay: d, attack: 0.001 });
          this.noise(sfx, { dur: 0.06, gain: 0.09, filter: 3600, q: 0.8, delay: d });
        }
        break;
      }
      case 'count':
        this.tone(sfx, { freq: 300, type: 'triangle', dur: 0.16, gain: 0.13, sweepTo: 250 });
        this.noise(sfx, { dur: 0.14, gain: 0.05, filter: 900, q: 1.4 });
        break;

      case 'whiff':
        this.noise(sfx, { dur: 0.13, gain: 0.055 * i, filter: 1500, sweepTo: 480, q: 0.7 });
        break;

      case 'block':
        this.noise(sfx, { dur: 0.09, gain: this.impactGain(0.1) * i, filter: 900, q: 1.1 });
        this.tone(sfx, { freq: 150, type: 'triangle', dur: 0.08, gain: 0.05 * i });
        break;
      case 'guard_break':
        this.noise(sfx, { dur: 0.22, gain: 0.14, filter: 1300, sweepTo: 400, q: 1.2 });
        this.tone(sfx, { freq: 110, type: 'sawtooth', dur: 0.2, gain: 0.09, sweepTo: 60 });
        break;

      // Head shots are sharp and high; body shots are dull and low. The two
      // must be distinguishable with the screen turned off.
      case 'hit_head_light':
        this.noise(sfx, { dur: 0.07, gain: this.impactGain(0.16) * i, filter: 2200, q: 0.9 });
        this.tone(sfx, { freq: 220, type: 'triangle', dur: 0.07, gain: 0.06 * i, sweepTo: 150 });
        break;
      case 'hit_head_heavy':
        this.noise(sfx, { dur: 0.13, gain: this.impactGain(0.26) * i, filter: 1700, sweepTo: 700, q: 0.8 });
        this.tone(sfx, { freq: 180, type: 'triangle', dur: 0.16, gain: 0.13 * i, sweepTo: 80 });
        break;
      case 'hit_body_light':
        this.noise(sfx, { dur: 0.09, gain: this.impactGain(0.14) * i, filter: 700, q: 0.8 });
        this.tone(sfx, { freq: 120, type: 'sine', dur: 0.1, gain: 0.08 * i, sweepTo: 70 });
        break;
      case 'hit_body_heavy':
        this.noise(sfx, { dur: 0.16, gain: this.impactGain(0.2) * i, filter: 520, q: 0.7 });
        this.tone(sfx, { freq: 92, type: 'sine', dur: 0.22, gain: 0.16 * i, sweepTo: 48 });
        break;
      case 'counter':
        // A counter gets its own bright transient so it is audibly special.
        this.noise(sfx, { dur: 0.1, gain: this.impactGain(0.24) * i, filter: 3000, q: 1.4 });
        this.tone(sfx, { freq: 660, type: 'square', dur: 0.09, gain: 0.07 * i, sweepTo: 330 });
        this.tone(sfx, { freq: 165, type: 'triangle', dur: 0.18, gain: 0.12 * i, sweepTo: 82 });
        break;

      case 'footwork':
        this.noise(sfx, { dur: 0.05, gain: 0.028, filter: 2600, q: 0.6 });
        break;
      case 'rope':
        this.tone(sfx, { freq: 70, type: 'sine', dur: 0.24, gain: 0.07, sweepTo: 45 });
        break;

      case 'knockdown':
        this.tone(sfx, { freq: 140, type: 'sine', dur: 0.42, gain: 0.2, sweepTo: 42 });
        this.noise(sfx, { dur: 0.3, gain: 0.16, filter: 420, sweepTo: 140, q: 0.6 });
        this.crowdSwell(crowd, 1.3, 1.6);
        break;
      case 'rise':
        this.tone(sfx, { freq: 200, type: 'triangle', dur: 0.28, gain: 0.1, sweepTo: 420 });
        this.crowdSwell(crowd, 0.8, 1.0);
        break;

      case 'crowd_pop':
        this.crowdSwell(crowd, 0.55 * i, 0.9);
        break;
      case 'crowd_ooh':
        this.crowdSwell(crowd, 0.4 * i, 1.4);
        break;

      case 'victory':
        [523, 659, 784, 1047].forEach((f, k) =>
          this.tone(sfx, { freq: f, type: 'triangle', dur: 0.5, gain: 0.11, delay: k * 0.11 }),
        );
        this.crowdSwell(crowd, 1.2, 2.4);
        break;
      case 'defeat':
        [392, 349, 294, 233].forEach((f, k) =>
          this.tone(sfx, { freq: f, type: 'triangle', dur: 0.6, gain: 0.1, delay: k * 0.15 }),
        );
        break;
    }
  }

  /** A burst of filtered noise shaped like a crowd reacting. */
  private crowdSwell(bus: GainNode, gain: number, dur: number): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(1500, t + dur * 0.25);
    filter.frequency.linearRampToValueAtTime(600, t + dur);
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain * 0.22, t + dur * 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  /** Continuous crowd bed for a venue. */
  startCrowdBed(level: number): void {
    if (!this.ctx || !this.crowdBus || !this.noiseBuffer) return;
    this.stopCrowdBed();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.value = level * 0.08;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.crowdBus);
    src.start();
    this.crowdSource = { stop: () => { try { src.stop(); } catch { /* already stopped */ } } };
  }

  stopCrowdBed(): void {
    if (this.crowdSource) {
      this.crowdSource.stop();
      this.crowdSource = null;
    }
  }

  // -------------------------------------------------------------------------
  // Music
  // -------------------------------------------------------------------------

  /**
   * Three venue treatments plus a menu theme, sequenced from a step table.
   * Deliberately sparse: nothing may mask the bell or the referee's count.
   */
  playMusic(id: MusicId): void {
    if (this.musicId === id) return;
    this.stopMusic();
    this.musicId = id;
    if (id === 'none' || !this.ctx || !this.musicBus) return;

    const themes: Record<Exclude<MusicId, 'none'>, { root: number; steps: number[]; bpm: number; wave: OscillatorType }> = {
      menu: { root: 110, steps: [0, 3, 7, 10, 7, 3, 5, 3], bpm: 84, wave: 'triangle' },
      gym: { root: 98, steps: [0, 0, 5, 0, 7, 5, 3, 0], bpm: 96, wave: 'square' },
      arena: { root: 123, steps: [0, 7, 5, 7, 10, 7, 5, 3], bpm: 112, wave: 'sawtooth' },
      coliseum: { root: 87, steps: [0, 5, 7, 12, 10, 7, 5, 2], bpm: 128, wave: 'square' },
    };
    const theme = themes[id];
    const stepMs = 60000 / theme.bpm / 2;
    let step = 0;

    const tick = (): void => {
      if (!this.ctx || !this.musicBus || this.musicId !== id) return;
      const semi = theme.steps[step % theme.steps.length];
      const freq = theme.root * Math.pow(2, semi / 12);
      this.tone(this.musicBus, { freq, type: theme.wave, dur: stepMs / 1000 * 0.9, gain: 0.035 });
      if (step % 4 === 0) {
        this.tone(this.musicBus, { freq: theme.root * 0.5, type: 'sine', dur: 0.22, gain: 0.05, sweepTo: theme.root * 0.35 });
      }
      if (step % 8 === 4) {
        this.noise(this.musicBus, { dur: 0.08, gain: 0.025, filter: 2400, q: 0.8 });
      }
      step++;
    };

    tick();
    this.musicTimer = setInterval(tick, stepMs) as unknown as number;
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicId = 'none';
  }

  dispose(): void {
    this.stopMusic();
    this.stopCrowdBed();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.started = false;
  }
}
