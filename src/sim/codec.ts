/**
 * Command stream codec.
 *
 * A replay fixture has to carry the normalised commands that actually reached
 * the simulation, not a recipe for regenerating them. A recipe couples the
 * fixture to the generator: edit the generator and the fixture silently starts
 * testing a different input stream while still appearing to pass.
 *
 * A `FighterCommand` has a small, fully enumerable domain, so each one packs
 * into a single 12-bit value and prints as three hex characters. A tick is two
 * commands, six characters; a 7200-tick fixture is about 43 kB of text, which
 * is small enough to commit and diff and large enough to be worth encoding
 * rather than storing as JSON objects.
 */
import { emptyCommand, PUNCH_IDS, type FighterCommand, type PunchId } from './types';

/** Encoding version. Bump if the field order or radix changes. */
export const COMMAND_CODEC_VERSION = 1;

const TRI = (v: number): number => (v < 0 ? 0 : v > 0 ? 2 : 1);
const UNTRI = (v: number): number => v - 1;

/** Packs one command into 0..3023. */
export function packCommand(c: FighterCommand): number {
  const punch = c.punch === null ? 0 : PUNCH_IDS.indexOf(c.punch) + 1;
  let v = 0;
  v = v * 3 + TRI(c.moveX);
  v = v * 3 + TRI(c.moveZ);
  v = v * 3 + TRI(c.slip);
  v = v * 7 + punch;
  v = v * 2 + (c.guard ? 1 : 0);
  v = v * 2 + (c.crouch ? 1 : 0);
  v = v * 2 + (c.clinch ? 1 : 0);
  v = v * 2 + (c.recover ? 1 : 0);
  return v;
}

export function unpackCommand(v: number): FighterCommand {
  const c = emptyCommand();
  let n = v;
  c.recover = n % 2 === 1;
  n = Math.floor(n / 2);
  c.clinch = n % 2 === 1;
  n = Math.floor(n / 2);
  c.crouch = n % 2 === 1;
  n = Math.floor(n / 2);
  c.guard = n % 2 === 1;
  n = Math.floor(n / 2);
  const punch = n % 7;
  n = Math.floor(n / 7);
  c.punch = punch === 0 ? null : (PUNCH_IDS[punch - 1] as PunchId);
  c.slip = UNTRI(n % 3);
  n = Math.floor(n / 3);
  c.moveZ = UNTRI(n % 3);
  n = Math.floor(n / 3);
  c.moveX = UNTRI(n % 3);
  return c;
}

/** Encodes a two-corner command stream as hex, three characters per command. */
export function encodeCommands(stream: readonly (readonly [FighterCommand, FighterCommand])[]): string {
  let out = '';
  for (const [a, b] of stream) {
    out += packCommand(a).toString(16).padStart(3, '0');
    out += packCommand(b).toString(16).padStart(3, '0');
  }
  return out;
}

export function decodeCommands(text: string): [FighterCommand, FighterCommand][] {
  if (text.length % 6 !== 0) {
    throw new Error(`command stream length ${text.length} is not a whole number of ticks`);
  }
  const out: [FighterCommand, FighterCommand][] = [];
  for (let i = 0; i < text.length; i += 6) {
    out.push([
      unpackCommand(parseInt(text.slice(i, i + 3), 16)),
      unpackCommand(parseInt(text.slice(i + 3, i + 6), 16)),
    ]);
  }
  return out;
}

/**
 * A stable 64-bit hash of arbitrary text.
 *
 * Same construction as `BoutSim.hashState` — two FNV-style accumulators — so
 * content and state digests are the same shape and neither pulls in a crypto
 * dependency the browser bundle would have to carry.
 */
export function digest(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
