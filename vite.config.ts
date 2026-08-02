import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

interface BuildIdentity {
  commit: string;
  commitShort: string;
  dirty: boolean;
  /** What `dirty` was computed over, so nobody assumes it is broader. */
  dirtyScope: string;
  lockfileHash: string;
  builtAt: string;
  version: string;
  ci: string;
}

/**
 * Paths excluded from the dirty check.
 *
 * `dirty` answers one question: does the source that produced this build differ
 * from the recorded commit? `artifacts/` is committed QA evidence — verify
 * logs, soak results, screenshots — and `npm run verify` rewrites it as a
 * side effect of running. Nothing under it is imported by `src/`, read by the
 * build, or copied into `dist/`, so it cannot change the artifact.
 *
 * Without this exclusion the flag was not merely noisy, it was inverted: any
 * pipeline that runs the full gate before building — which is the only
 * ordering that makes sense — would mark every build dirty, including the
 * clean-checkout CI build the flag exists to distinguish.
 *
 * Everything else stays in scope: src, tools, tests, docs, index.html,
 * package.json, package-lock.json and this file.
 */
const DIRT_EXCLUDED = ['artifacts'];

/**
 * Build identity.
 *
 * Baked into the bundle and written next to it as `dist/build-manifest.json`,
 * so an artifact can be traced back to the source that produced it rather than
 * being taken on trust. `npm run release:audit` checks the manifest is present
 * and internally consistent; CI is what makes `ci` say something other than
 * `local`.
 *
 * Every lookup degrades to a truthful `unknown` rather than a plausible
 * guess — a manifest that invents a commit is worse than one that admits it
 * does not have one.
 */
function buildIdentity(): BuildIdentity {
  const git = (cmd: string, fallback: string): string => {
    try {
      return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return fallback;
    }
  };

  /*
   * `BUILD_COMMIT` wins over `GITHUB_SHA` because on a `pull_request` event
   * GITHUB_SHA is the *merge* commit — a synthetic object on `refs/pull/N/merge`
   * that no ordinary clone can resolve and that GitHub eventually collects. An
   * artifact stamped with it names a commit nobody can check out, which is
   * provenance that looks solid and is not. The workflow sets BUILD_COMMIT to
   * the real head commit; see .github/workflows/verify.yml.
   */
  const commit = process.env.BUILD_COMMIT ?? process.env.GITHUB_SHA ?? git('git rev-parse HEAD', 'unknown');
  const pkg = JSON.parse(readFileSync(r('./package.json'), 'utf8')) as { version?: string };

  let lockfileHash = 'unknown';
  try {
    lockfileHash = createHash('sha256').update(readFileSync(r('./package-lock.json'))).digest('hex').slice(0, 16);
  } catch {
    // A missing lockfile is itself a provenance problem; the audit reports it.
  }

  const excludes = DIRT_EXCLUDED.map((p) => `':(exclude)${p}'`).join(' ');
  const dirtyScope = `tracked files excluding ${DIRT_EXCLUDED.join(', ')}`;

  const runId = process.env.GITHUB_RUN_ID;
  return {
    commit,
    commitShort: commit === 'unknown' ? 'unknown' : commit.slice(0, 8),
    dirty: git(`git status --porcelain -- . ${excludes}`, '') !== '',
    dirtyScope,
    lockfileHash,
    builtAt: new Date().toISOString(),
    version: pkg.version ?? '0.0.0',
    ci: runId === undefined ? 'local' : `gh-${runId}`,
  };
}

const identity = buildIdentity();

/**
 * Writes the manifest once the bundle is on disk.
 *
 * `artifactHash` is a SHA-256 over every emitted file — path and content, in
 * sorted order — so it identifies the release as a whole rather than one file
 * of it. The build is multi-file (Phaser is code-split so it can be cached
 * separately), so a single-file hash would silently ignore most of what ships.
 * The manifest excludes itself, or it would have to contain its own digest.
 */
function buildManifest(): Plugin {
  return {
    name: 'ten-count-build-manifest',
    apply: 'build',
    closeBundle() {
      const dist = r('./dist');
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
        );

      const files = walk(dist)
        .filter((f) => basename(f) !== 'build-manifest.json')
        .map((f) => relative(dist, f).split(sep).join('/'))
        .sort();

      const whole = createHash('sha256');
      for (const rel of files) {
        whole.update(rel);
        whole.update('\0');
        whole.update(readFileSync(join(dist, rel)));
        whole.update('\0');
      }

      writeFileSync(
        join(dist, 'build-manifest.json'),
        `${JSON.stringify(
          {
            name: 'ten-count',
            ...identity,
            files,
            artifactHash: `sha256:${whole.digest('hex')}`,
          },
          null,
          2,
        )}\n`,
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [buildManifest()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(identity.commit),
    __BUILD_COMMIT_SHORT__: JSON.stringify(identity.commitShort),
    __BUILD_DIRTY__: JSON.stringify(identity.dirty),
    __BUILD_LOCKFILE_HASH__: JSON.stringify(identity.lockfileHash),
    __BUILD_TIME__: JSON.stringify(identity.builtAt),
    __BUILD_VERSION__: JSON.stringify(identity.version),
    __BUILD_CI__: JSON.stringify(identity.ci),
  },
  resolve: {
    alias: {
      '@sim': r('./src/sim'),
      '@ai': r('./src/ai'),
      '@career': r('./src/career'),
      '@data': r('./src/data'),
      '@save': r('./src/save'),
      '@art': r('./src/art'),
      '@audio': r('./src/audio'),
      '@input': r('./src/input'),
      '@ui': r('./src/ui'),
      '@util': r('./src/util'),
      '@scenes': r('./src/scenes'),
      '@game': r('./src/game'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
