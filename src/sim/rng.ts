/**
 * Seeded, serialisable pseudo-random number generator.
 *
 * The simulation must be reproducible from (ruleset, fighters, ai profiles,
 * input stream, seed). That rules out `Math.random`. This is a 128-bit
 * xoshiro128** generator: fast, well-distributed, and its entire state is four
 * 32-bit integers, so it round-trips through the save file without loss.
 *
 * All arithmetic is integer (via `| 0` / `>>> 0`), so results are identical on
 * every JavaScript engine and CPU.
 */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Mixes an arbitrary string or number into a well-distributed 32-bit seed. */
export function hashSeed(input: string | number): number {
  const s = typeof input === 'number' ? String(input) : input;
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string) {
    // splitmix32 expansion so that adjacent integer seeds diverge immediately.
    let x = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    const next = (): number => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    // Guard against the all-zero state, which is a fixed point of xoshiro.
    if ((this.a | this.b | this.c | this.d) === 0) this.a = 0x9e3779b9;
  }

  /** Raw 32-bit unsigned draw. */
  nextUint32(): number {
    const t = (this.b << 9) >>> 0;
    // xoshiro128** scrambler: rotl(b * 5, 7) * 9
    const m = Math.imul(this.b, 5) >>> 0;
    const r = (Math.imul(((m << 7) | (m >>> 25)) >>> 0, 9) >>> 0) >>> 0;

    this.c = (this.c ^ this.a) >>> 0;
    this.d = (this.d ^ this.b) >>> 0;
    this.b = (this.b ^ this.c) >>> 0;
    this.a = (this.a ^ this.d) >>> 0;
    this.c = (this.c ^ t) >>> 0;
    this.d = ((this.d << 11) | (this.d >>> 21)) >>> 0;
    return r;
  }

  /** Uniform float in [0, 1). 24 bits of mantissa — plenty, and exact. */
  next(): number {
    return (this.nextUint32() >>> 8) / 0x01000000;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max <= min) return min;
    const span = max - min + 1;
    return min + (this.nextUint32() % span);
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Uniformly picks one element. Throws on an empty list so bugs surface loudly. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty array');
    return items[this.int(0, items.length - 1)];
  }

  /** In-place Fisher-Yates. Returns the same array for convenience. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }

  /**
   * Symmetric variance multiplier around 1.0, e.g. `variance(0.08)` returns a
   * value in [0.92, 1.08). Used for damage jitter so exchanges are not
   * perfectly repetitive while remaining fully seeded.
   */
  variance(amount: number): number {
    return 1 + (this.next() * 2 - 1) * amount;
  }

  save(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  restore(state: RngState): void {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  /**
   * Derives an independent stream. Used so that (for example) AI decision noise
   * cannot shift the damage-roll sequence — each consumer owns its own stream,
   * and both remain reproducible from the parent seed.
   */
  fork(label: string): Rng {
    const child = new Rng((this.nextUint32() ^ hashSeed(label)) >>> 0);
    return child;
  }
}
