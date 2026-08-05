/**
 * Build identity.
 *
 * A release artifact should be able to answer "which source produced you?"
 * without anyone having to take a person's word for it. These values are
 * substituted at build time by `vite.config.ts` and written alongside the
 * bundle as `dist/build-manifest.json`, so a downloaded build can be traced
 * back to a commit and a dependency set.
 *
 * Deliberately not available to `src/sim`, `src/ai` or `src/career`: build
 * identity is wall-clock and environment data, and the simulation is not
 * allowed to see either. It is display and provenance information only.
 */

declare const __BUILD_COMMIT__: string;
declare const __BUILD_COMMIT_SHORT__: string;
declare const __BUILD_DIRTY__: boolean;
declare const __BUILD_LOCKFILE_HASH__: string;
declare const __BUILD_TIME__: string;
declare const __BUILD_VERSION__: string;
declare const __BUILD_CI__: string;

export interface BuildInfo {
  /** Full commit SHA, or `unknown` outside a git checkout. */
  commit: string;
  commitShort: string;
  /** True when the working tree had uncommitted changes at build time. */
  dirty: boolean;
  /** First 16 hex characters of the SHA-256 of package-lock.json. */
  lockfileHash: string;
  /** ISO timestamp. Provenance only — never read by the simulation. */
  builtAt: string;
  version: string;
  /**
   * Which CI run produced this, or `local`. A release should say a run id;
   * `local` on a published artifact means it was not built by the pipeline.
   */
  ci: string;
}

export const BUILD: BuildInfo = {
  commit: typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'unknown',
  commitShort: typeof __BUILD_COMMIT_SHORT__ === 'string' ? __BUILD_COMMIT_SHORT__ : 'unknown',
  dirty: typeof __BUILD_DIRTY__ === 'boolean' ? __BUILD_DIRTY__ : false,
  lockfileHash: typeof __BUILD_LOCKFILE_HASH__ === 'string' ? __BUILD_LOCKFILE_HASH__ : 'unknown',
  builtAt: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '',
  version: typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : '0.0.0',
  ci: typeof __BUILD_CI__ === 'string' ? __BUILD_CI__ : 'local',
};

/** One short line for the title screen and the settings About panel. */
export function buildLabel(): string {
  const dirty = BUILD.dirty ? '+' : '';
  return `v${BUILD.version} · ${BUILD.commitShort}${dirty} · ${BUILD.ci}`;
}
