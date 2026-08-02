/**
 * Release audit.
 *
 * Scans every tracked source file and the production bundle for anything that
 * would make the build unshippable under the SAFE_RELEASE profile:
 *
 *   - ROM files, ROM-derived data, or the verified research ROM's hash
 *   - references to private research paths
 *   - the original work's names, marks or asset identifiers in shipping code
 *   - binary media with no row in the asset ledger
 *   - unfinished work markers on a production path
 *
 * Failure blocks release. Run by `npm run verify`.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { extname, join, sep } from 'node:path';
import { createHash } from 'node:crypto';

interface Finding {
  severity: 'block' | 'warn';
  file: string;
  message: string;
}

const findings: Finding[] = [];

/** The research ROM's identity. Nothing with this hash may ever be tracked. */
const FORBIDDEN_HASHES = new Set([
  'b13f1e31bf6ba739e4cffd98374263b3421b3a61c4873e30dbc866198736e880',
]);

const ROM_EXTENSIONS = new Set(['.bin', '.md5', '.gen', '.smd', '.sms', '.gg', '.rom', '.srm', '.sav', '.eep', '.state', '.z64', '.nes', '.iso']);

/**
 * Terms from the historical reference that must not appear in shipping code,
 * content or player-facing text. Documentation is allowed to discuss the
 * reference material; the game itself is not.
 */
/*
 * Matched on word boundaries, not as raw substrings: minified third-party code
 * is full of accidental matches ("createSVGPathSegArcAbs" contains "sega"), and
 * an audit that cries wolf is an audit people switch off.
 */
const FORBIDDEN_TERMS: { label: string; pattern: RegExp }[] = [
  { label: 'holyfield', pattern: /\bholyfield\b/i },
  { label: 'evander', pattern: /\bevander\b/i },
  { label: 'real deal', pattern: /\breal[\s-]deal\b/i },
  { label: 'sega', pattern: /\bsega\b/i },
  { label: 'mega drive', pattern: /\bmega[\s-]?drive\b/i },
  { label: 'genesis rom', pattern: /\bgenesis\s+rom\b/i },
  { label: 'acme interactive', pattern: /\bacme\s+interactive\b/i },
  { label: 'greatest heavyweights', pattern: /\bgreatest\s+heavyweights\b/i },
];

/** Paths that hold private research material and must never be imported. */
const PRIVATE_PATHS = ['references/private-rom', 'artifacts/private-repro', 'references/drive'];

/** Directories whose contents ship to the player. */
const RELEASE_SOURCE_GLOBS = ['src/', 'index.html'];

/** Markers that must not survive on a production path. */
const UNFINISHED = [/\bTODO\b/, /\bFIXME\b/, /\bXXX\b/, /\bHACK\b/, /coming soon/i, /not implemented/i, /placeholder/i];

function tracked(): string[] {
  return execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
}

function isText(file: string): boolean {
  return ['.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.css', '.md', '.yml', '.yaml'].includes(extname(file));
}

function isRelease(file: string): boolean {
  return RELEASE_SOURCE_GLOBS.some((g) => file === g || file.startsWith(g));
}

// --- 1. No ROM or emulator artefacts are tracked ---------------------------

for (const file of tracked()) {
  const ext = extname(file).toLowerCase();
  if (ROM_EXTENSIONS.has(ext)) {
    findings.push({ severity: 'block', file, message: `prohibited file type ${ext}` });
    continue;
  }
  if (!existsSync(file)) continue;
  const stat = statSync(file);
  // Anything large and binary is worth flagging by hash.
  if (!isText(file) && stat.size > 4096) {
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (FORBIDDEN_HASHES.has(hash)) {
      findings.push({ severity: 'block', file, message: 'matches the verified research ROM hash' });
    }
  }
}

// --- 2. Release code carries no reference to the historical work ------------

for (const file of tracked()) {
  if (!isRelease(file) || !isText(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const term of FORBIDDEN_TERMS) {
    if (term.pattern.test(text)) {
      findings.push({ severity: 'block', file, message: `shipping source mentions "${term.label}"` });
    }
  }
  const lowered = text.toLowerCase();
  for (const p of PRIVATE_PATHS) {
    if (lowered.includes(p)) {
      findings.push({ severity: 'block', file, message: `shipping source references the private path "${p}"` });
    }
  }
}

// --- 3. No unfinished-work markers on a production path --------------------

for (const file of tracked()) {
  if (!isRelease(file) || !isText(file)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const pattern of UNFINISHED) {
      if (pattern.test(line)) {
        findings.push({ severity: 'block', file: `${file}:${i + 1}`, message: `unfinished marker: ${line.trim().slice(0, 80)}` });
      }
    }
  });
}

// --- 4. The built bundle is clean too --------------------------------------

const DIST = 'dist';
if (existsSync(DIST)) {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const bundleFiles = walk(DIST);
  let mediaCount = 0;

  for (const file of bundleFiles) {
    const ext = extname(file).toLowerCase();
    if (ROM_EXTENSIONS.has(ext)) {
      findings.push({ severity: 'block', file, message: `prohibited file type in the bundle: ${ext}` });
    }
    // Any binary media in the bundle needs a ledger row. The generated build
    // should contain none at all.
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp3', '.ogg', '.wav', '.m4a', '.woff', '.woff2', '.ttf'].includes(ext)) {
      mediaCount++;
      findings.push({ severity: 'warn', file, message: 'binary media in the bundle — confirm it has a ledger row' });
    }
    if (['.js', '.html', '.css'].includes(ext)) {
      const text = readFileSync(file, 'utf8');
      for (const term of FORBIDDEN_TERMS) {
        if (term.pattern.test(text)) {
          findings.push({ severity: 'block', file, message: `bundle mentions "${term.label}"` });
        }
      }
    }
  }
  console.log(`  · bundle scanned: ${bundleFiles.length} files, ${mediaCount} binary media`);

  // --- 4b. The bundle can say which source produced it ---------------------
  //
  // An artifact nobody can trace to a commit is an artifact nobody can audit.
  // The manifest is written by the Vite build; see vite.config.ts.
  const MANIFEST = join(DIST, 'build-manifest.json');
  if (!existsSync(MANIFEST)) {
    findings.push({ severity: 'block', file: MANIFEST, message: 'build manifest is missing — the artifact has no provenance' });
  } else {
    let manifest: Record<string, unknown> = {};
    try {
      manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, unknown>;
    } catch {
      findings.push({ severity: 'block', file: MANIFEST, message: 'build manifest is not readable JSON' });
    }
    for (const field of ['commit', 'lockfileHash', 'builtAt', 'version', 'ci', 'artifactHash'] as const) {
      if (typeof manifest[field] !== 'string' || manifest[field] === '') {
        findings.push({ severity: 'block', file: MANIFEST, message: `build manifest is missing "${field}"` });
      }
    }

    // Recompute the artifact hash. A manifest that merely *claims* a digest
    // proves nothing; the point of the field is that anyone can check it, so
    // the audit checks it. Same construction as vite.config.ts.
    const manifestFiles = Array.isArray(manifest.files) ? (manifest.files as string[]) : [];
    const onDisk = bundleFiles
      .map((f) => f.slice(DIST.length + 1).split(sep).join('/'))
      .filter((f) => f !== 'build-manifest.json')
      .sort();
    if (manifestFiles.join('|') !== onDisk.join('|')) {
      findings.push({
        severity: 'block',
        file: MANIFEST,
        message: `manifest lists ${manifestFiles.length} file(s) but the bundle has ${onDisk.length}`,
      });
    } else {
      const whole = createHash('sha256');
      for (const rel of onDisk) {
        whole.update(rel);
        whole.update('\0');
        whole.update(readFileSync(join(DIST, rel)));
        whole.update('\0');
      }
      const recomputed = `sha256:${whole.digest('hex')}`;
      if (manifest.artifactHash !== recomputed) {
        findings.push({
          severity: 'block',
          file: MANIFEST,
          message: `artifact hash does not match the bundle on disk (manifest ${String(manifest.artifactHash).slice(0, 23)}…, actual ${recomputed.slice(0, 23)}…)`,
        });
      }
    }
    // `unknown` is honest, but it is not shippable: it means the build could
    // not determine what it was built from.
    if (manifest.commit === 'unknown') {
      findings.push({ severity: 'block', file: MANIFEST, message: 'build manifest has no commit — built outside a git checkout' });
    }
    if (manifest.lockfileHash === 'unknown') {
      findings.push({ severity: 'block', file: MANIFEST, message: 'build manifest has no lockfile hash — the dependency set is unpinned' });
    }
    /*
     * A release candidate must be clean and CI-built; a development build need
     * not be. Both are reported either way — the only thing RELEASE=1 changes
     * is whether they stop the run, so a developer is never blocked and a
     * release can never quietly ship from someone's laptop.
     */
    const releaseMode = process.env.RELEASE === '1';
    const severity: Finding['severity'] = releaseMode ? 'block' : 'warn';
    if (manifest.dirty === true) {
      findings.push({
        severity,
        file: MANIFEST,
        message: `built from a dirty working tree (${String(manifest.dirtyScope ?? 'scope unrecorded')}) — not reproducible from the recorded commit`,
      });
    }
    if (typeof manifest.dirtyScope !== 'string') {
      // A dirty flag whose scope is unrecorded cannot be interpreted: nobody
      // can tell whether "clean" means the source or merely some of it.
      findings.push({ severity: 'block', file: MANIFEST, message: 'build manifest does not record what "dirty" was computed over' });
    }
    if (manifest.ci === 'local') {
      findings.push({ severity, file: MANIFEST, message: 'built locally — a release artifact must come from CI' });
    }
    // The commit in the manifest must be the one compiled into the bundle,
    // or the manifest is describing a different build than the one shipped.
    const commit = String(manifest.commit ?? '');
    const inBundle = bundleFiles
      .filter((f) => extname(f).toLowerCase() === '.js')
      .some((f) => readFileSync(f, 'utf8').includes(commit));
    if (commit !== '' && commit !== 'unknown' && !inBundle) {
      findings.push({ severity: 'block', file: MANIFEST, message: 'manifest commit does not appear in the bundle — mismatched artifacts' });
    }
    console.log(
      `  · build identity: ${commit.slice(0, 8)} lockfile ${String(manifest.lockfileHash).slice(0, 8)} ` +
        `ci ${String(manifest.ci)} artifact ${String(manifest.artifactHash ?? '').slice(7, 19)}`,
    );
  }
} else {
  findings.push({ severity: 'warn', file: DIST, message: 'no build present — run `npm run build` before auditing a release' });
}

// --- 5. The ledger exists, names the profile, and is complete --------------

const LEDGER = 'docs/LEGAL_AND_ASSET_LEDGER.md';
if (!existsSync(LEDGER)) {
  findings.push({ severity: 'block', file: LEDGER, message: 'asset ledger is missing' });
} else {
  const text = readFileSync(LEDGER, 'utf8');
  if (!/SAFE_RELEASE/.test(text)) {
    findings.push({ severity: 'block', file: LEDGER, message: 'ledger does not state the build profile' });
  }
  // Only a table row may be flagged — the surrounding prose describes this
  // very rule and must not trip it.
  const unknownRows = text
    .split('\n')
    .filter((line) => line.trimStart().startsWith('|') && /\b(unknown|unclear|tbd|\?\?\?)\b/i.test(line));
  for (const row of unknownRows) {
    findings.push({ severity: 'block', file: LEDGER, message: `ledger row with unresolved provenance: ${row.trim().slice(0, 90)}` });
  }
}

// --- 6. The ignore rules keep private material out of the repository -------

if (existsSync('.gitignore')) {
  const ignore = readFileSync('.gitignore', 'utf8');
  for (const p of ['references/private-rom', 'artifacts/private-repro', 'references/drive']) {
    if (!ignore.includes(p)) {
      findings.push({ severity: 'block', file: '.gitignore', message: `does not ignore ${p}` });
    }
  }
}

// --- Report ----------------------------------------------------------------

const blocking = findings.filter((f) => f.severity === 'block');
const warnings = findings.filter((f) => f.severity === 'warn');

for (const w of warnings) console.warn(`  warn  ${w.file}: ${w.message}`);
if (blocking.length > 0) {
  console.error(`\nRELEASE AUDIT FAILED (${blocking.length} blocking):`);
  for (const f of blocking) console.error(`  BLOCK ${f.file}: ${f.message}`);
  process.exit(1);
}
console.log(`  · no ROM data, no reference-work terms, no private paths, no unfinished markers on a release path`);
console.log(`release audit passed${warnings.length > 0 ? ` (${warnings.length} warning(s))` : ''}`);
