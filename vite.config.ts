import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

interface BuildIdentity {
  commit: string;
  commitShort: string;
  dirty: boolean;
  lockfileHash: string;
  builtAt: string;
  version: string;
  ci: string;
}

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

  const commit = process.env.GITHUB_SHA ?? git('git rev-parse HEAD', 'unknown');
  const pkg = JSON.parse(readFileSync(r('./package.json'), 'utf8')) as { version?: string };

  let lockfileHash = 'unknown';
  try {
    lockfileHash = createHash('sha256').update(readFileSync(r('./package-lock.json'))).digest('hex').slice(0, 16);
  } catch {
    // A missing lockfile is itself a provenance problem; the audit reports it.
  }

  const runId = process.env.GITHUB_RUN_ID;
  return {
    commit,
    commitShort: commit === 'unknown' ? 'unknown' : commit.slice(0, 8),
    dirty: git('git status --porcelain', '') !== '',
    lockfileHash,
    builtAt: new Date().toISOString(),
    version: pkg.version ?? '0.0.0',
    ci: runId === undefined ? 'local' : `gh-${runId}`,
  };
}

const identity = buildIdentity();

/** Writes the manifest once the bundle is on disk. */
function buildManifest(): Plugin {
  return {
    name: 'ten-count-build-manifest',
    apply: 'build',
    closeBundle() {
      writeFileSync(
        r('./dist/build-manifest.json'),
        `${JSON.stringify({ name: 'ten-count', ...identity }, null, 2)}\n`,
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
