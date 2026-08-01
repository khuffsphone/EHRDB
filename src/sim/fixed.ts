/**
 * Deterministic scalar helpers for the simulation core.
 *
 * IEEE-754 `+ - * /` and `sqrt` are exactly specified and therefore identical
 * on every engine and CPU. `Math.sin`, `Math.cos`, `Math.pow` and `Math.hypot`
 * are *not* — implementations may differ in the last ulp. The simulation
 * therefore uses only the operations below, and eslint blocks the rest inside
 * `src/sim`, `src/ai` and `src/career`.
 */

/** Depth is compressed relative to lateral distance: the ring reads side-on. */
export const DEPTH_WEIGHT = 0.6;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linear remap of `v` from [inLo, inHi] onto [outLo, outHi], clamped. */
export function remap(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  if (inHi === inLo) return outLo;
  return lerp(outLo, outHi, clamp01((v - inLo) / (inHi - inLo)));
}

export function sign(v: number): number {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

export function abs(v: number): number {
  return v < 0 ? -v : v;
}

/**
 * Ring separation between two fighters. Depth counts for less than lateral
 * distance so that the side-on camera stays honest about reach.
 * Uses only multiply and sqrt, both bit-exact.
 */
export function dist(dx: number, dz: number): number {
  const wz = dz * DEPTH_WEIGHT;
  return Math.sqrt(dx * dx + wz * wz);
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (d > maxDelta) return current + maxDelta;
  if (d < -maxDelta) return current - maxDelta;
  return target;
}

/**
 * Rounds to a fixed number of decimals using only exact operations. Used when
 * hashing state so that accumulated floating drift below the display threshold
 * cannot produce spurious hash mismatches.
 */
export function quantize(v: number, decimals = 4): number {
  const scale = decimals === 4 ? 10000 : decimals === 2 ? 100 : decimals === 3 ? 1000 : 1000000;
  return Math.round(v * scale) / scale;
}
