/**
 * Derived-data contamination rules.
 *
 * A ROM is a file. Derived data is not — it is a list of numbers, and numbers
 * have no extension, no size signature and no hash to match. Every ROM check
 * this audit had keyed on the artefact being a *file*, so the most likely
 * contamination route by far — somebody being helpful and pasting a measured
 * table into a source array — passed every gate, and the resulting build would
 * have looked clean while carrying extracted content into a release that calls
 * itself clean-room.
 *
 * The gap was named by the Cowork lane's boundary work, verified here, and is
 * the third instance in this file's history of a header claiming a check the
 * code did not perform. (The audit's own header has always said "ROM-derived
 * data".)
 *
 * Design constraint, adopted from the same source and worth restating because
 * it governs every threshold below: *a rule that cries wolf gets switched off,
 * and a switched-off rule protects nothing.* Every rule here is deliberately
 * narrow, keys on a shape this project's own code cannot produce, and has a
 * control proving both that it fires on contamination and that it stays silent
 * across every real shipping file.
 *
 * This module intentionally has no dependency on anything else in this
 * repository, so it can be ported wholesale if the canonical repository turns
 * out to be a different one.
 */

export interface ContaminationRule {
  id: string;
  label: string;
  /** Why this shape cannot occur in this project's own code. */
  rationale: string;
  scan(text: string): number;
}

export interface ContaminationHit {
  rule: string;
  label: string;
  count: number;
}

/**
 * Reference-hardware colour words.
 *
 * The reference console packs colour into nine bits as 0x0BGR, one even nibble
 * per channel — so a palette dump is a run of four-digit literals whose top
 * nibble is zero and whose remaining three nibbles are all even. This project
 * stores colour as 24-bit hex (`0x1a2b3c`), so the two shapes cannot be
 * confused. Eight is the threshold because eight is half a hardware palette
 * line; fewer than that is not a dump.
 */
const CRAM_WORD = /\b0x0([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])\b/g;

function isEvenNibble(c: string): boolean {
  return '02468aceACE'.includes(c);
}

/**
 * Exception-vector addresses on the reference processor, written as 24-bit
 * literals. `0x000000` is exempt: colour black is legitimately that literal,
 * and it is the only one that is.
 */
const VECTOR_LITERAL = /\b0x0000([0-9a-fA-F]{2})\b/g;

/** Hardware vocabulary that travels with a paste. */
const HARDWARE_TERMS: { label: string; pattern: RegExp }[] = [
  { label: 'CRAM', pattern: /(?:\b|_)cram(?:\b|_)/i },
  { label: 'VRAM', pattern: /(?:\b|_)vram(?:\b|_)/i },
  { label: 'VSRAM', pattern: /(?:\b|_)vsram(?:\b|_)/i },
  { label: 'VDP', pattern: /(?:\b|_)vdp(?:\b|_)/i },
  { label: 'M68K', pattern: /(?:\b|_)m68k(?:\b|_)|\bmc68000\b/i },
  { label: 'Z80', pattern: /(?:\b|_)z80(?:\b|_)/i },
  { label: 'metasprite', pattern: /(?:\b|_)meta[\s_-]?sprite(?:\b|_)/i },
  { label: 'EEPROM', pattern: /(?:\b|_)eeprom(?:\b|_)/i },
  { label: 'interrupt vector', pattern: /\b(?:reset|interrupt|vblank|hblank)\s+vector\b/i },
  { label: 'factory roster', pattern: /\bfactory\s+roster\b/i },
];

/**
 * A flat array of byte-ranged integers is the shape of a record table or a
 * tile dump. This project's data is objects with named fields, validated by
 * schema; it has no reason to hold a bare run of 64 numbers.
 */
const FLAT_BYTE_RUN = /\[\s*(?:\d{1,3}\s*,\s*){63,}\d{1,3}\s*,?\s*\]/g;

export const CONTAMINATION_RULES: ContaminationRule[] = [
  {
    id: 'cram-palette',
    label: 'reference-hardware colour words (packed 0x0BGR)',
    rationale: 'this project stores colour as 24-bit hex, never as 9-bit packed words',
    scan(text) {
      let n = 0;
      for (const m of text.matchAll(CRAM_WORD)) {
        if (isEvenNibble(m[1]) && isEvenNibble(m[2]) && isEvenNibble(m[3])) n++;
      }
      return n >= 8 ? n : 0;
    },
  },
  {
    id: 'vector-literal',
    label: 'reference-processor exception-vector addresses',
    rationale: 'colour black (0x000000) is the only legitimate literal of this shape here',
    scan(text) {
      let n = 0;
      for (const m of text.matchAll(VECTOR_LITERAL)) {
        if (m[1] !== '00') n++;
      }
      return n >= 2 ? n : 0;
    },
  },
  {
    id: 'hardware-vocabulary',
    label: 'reference-hardware vocabulary',
    rationale: 'the shipping game models boxing, not a console',
    scan(text) {
      let n = 0;
      for (const t of HARDWARE_TERMS) if (t.pattern.test(text)) n++;
      return n;
    },
  },
  {
    id: 'flat-byte-run',
    label: 'flat array of 64+ byte-ranged values (record or tile dump)',
    rationale: 'content here is named fields validated by schema, never a bare byte run',
    scan(text) {
      let n = 0;
      for (const m of text.matchAll(FLAT_BYTE_RUN)) {
        const values = m[0].slice(1, -1).split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
        if (values.length >= 64 && values.every((v) => v >= 0 && v <= 255)) n++;
      }
      return n;
    },
  },
];

/** Run every rule over one file's text. */
export function scanForDerivedData(text: string): ContaminationHit[] {
  const hits: ContaminationHit[] = [];
  for (const rule of CONTAMINATION_RULES) {
    const count = rule.scan(text);
    if (count > 0) hits.push({ rule: rule.id, label: rule.label, count });
  }
  return hits;
}
