/**
 * Controls for the derived-data contamination rules.
 *
 * A guard nobody has watched fail is indistinguishable from one that cannot
 * fail. This project has now shipped two gates that looked like gates and were
 * not: the media-ledger check matched by ancestor substring and cheerfully
 * passed a planted file, and the audit header claimed a ROM-derived-data scan
 * that did not exist. Both were found by testing the gate rather than trusting
 * it. So every rule here gets a positive control proving it fires on
 * contamination, and the whole set gets a negative control proving it stays
 * silent across every real shipping file.
 *
 * Every value below is synthetic. Nothing in this file was measured from any
 * protected work, and nothing in it should be.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { CONTAMINATION_RULES, scanForDerivedData } from '../../tools/contamination-rules';

/** Synthetic packed colour words: top nibble zero, remaining nibbles even. */
const FAKE_PALETTE = `
const swatches = [
  0x0000, 0x0222, 0x0444, 0x0666, 0x0888, 0x0aaa, 0x0ccc, 0x0eee,
  0x0246, 0x0468, 0x068a, 0x08ac,
];
`;

/** Synthetic exception-vector addresses. */
const FAKE_VECTORS = `
const entries = { onReset: 0x000004, onVBlank: 0x000070, onHBlank: 0x000078 };
`;

/** A bare run of byte-ranged values — the shape of a record or tile dump. */
const FAKE_BYTE_RUN = `const table = [${Array.from({ length: 72 }, (_, i) => (i * 7) % 256).join(', ')}];`;

const FAKE_VOCABULARY = `// palette copied out of CRAM via the VDP, roster read by the M68K\n`;

describe('derived-data contamination rules', () => {
  describe('positive controls — every rule fires on contamination', () => {
    it('detects packed reference-hardware colour words', () => {
      const hits = scanForDerivedData(FAKE_PALETTE);
      expect(hits.map((h) => h.rule)).toContain('cram-palette');
    });

    it('detects reference-processor exception-vector addresses', () => {
      const hits = scanForDerivedData(FAKE_VECTORS);
      expect(hits.map((h) => h.rule)).toContain('vector-literal');
    });

    it('detects a flat run of byte-ranged values', () => {
      const hits = scanForDerivedData(FAKE_BYTE_RUN);
      expect(hits.map((h) => h.rule)).toContain('flat-byte-run');
    });

    it('detects reference-hardware vocabulary', () => {
      const hits = scanForDerivedData(FAKE_VOCABULARY);
      expect(hits.map((h) => h.rule)).toContain('hardware-vocabulary');
    });

    it('catches vocabulary joined by underscores, not only bare words', () => {
      // A paste arrives as identifiers as often as it arrives as prose.
      const hits = scanForDerivedData('const CRAM_DUMP_0 = 1; const vdp_write = 2;');
      expect(hits.map((h) => h.rule)).toContain('hardware-vocabulary');
    });

    it('has a control for every rule', () => {
      // If a rule is added without a control, this fails rather than the rule
      // silently shipping unproven.
      const proven = new Set(['cram-palette', 'vector-literal', 'flat-byte-run', 'hardware-vocabulary']);
      for (const rule of CONTAMINATION_RULES) expect(proven.has(rule.id)).toBe(true);
      expect(CONTAMINATION_RULES.length).toBe(proven.size);
    });
  });

  describe('negative controls — the rules do not cry wolf', () => {
    it('ignores this project\'s own 24-bit colour notation', () => {
      const ours = `const palette = ['#1a2b3c', '#f0e4d0', 0x1a2b3c, 0x0d1117, 0xffffff, 0x2a2118];`;
      expect(scanForDerivedData(ours)).toEqual([]);
    });

    it('ignores colour black, the one legitimate literal of the vector shape', () => {
      expect(scanForDerivedData('const BLACK = 0x000000;')).toEqual([]);
    });

    it('ignores a short run of small numbers', () => {
      expect(scanForDerivedData('const weights = [1, 2, 3, 4, 5, 6, 7, 8];')).toEqual([]);
    });

    it('ignores an ordinary large number that could be a purse', () => {
      expect(scanForDerivedData('const titlePurse = 68000;')).toEqual([]);
    });

    it('stays silent across every tracked shipping file', () => {
      const TEXT = ['.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.css'];
      const files = execSync('git ls-files src index.html', { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
        .filter((f) => TEXT.includes(extname(f)));

      expect(files.length).toBeGreaterThan(20);
      const offenders = files
        .map((f) => ({ file: f, hits: scanForDerivedData(readFileSync(f, 'utf8')) }))
        .filter((r) => r.hits.length > 0);

      expect(offenders).toEqual([]);
    });
  });
});
