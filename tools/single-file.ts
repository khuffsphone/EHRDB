/**
 * Single-file playtest build.
 *
 * Produces one self-contained HTML file a tester can open from a download, a
 * link, or a USB stick, with no server, no install and no network. The five
 * human acceptance items are the only gates left open, and every one of them
 * needs a person in front of the game; the friction of "clone it and run npm"
 * is not a thing testers should have to absorb.
 *
 * What this is not: a release candidate. The release artifact stays code-split
 * and is described by `dist/build-manifest.json`, which `npm run release:audit`
 * recomputes. This variant is built to `dist-single/`, is not tracked, and is
 * stamped with the same commit so a tester's bug report can be tied to a
 * revision. If a file like this ever needs to be the artifact of record, it
 * needs its own manifest — see `docs/HWC_INSPECTION.md` for what happens when a
 * single-file build cannot say which release it is.
 *
 * Emits two forms of the same bundle:
 *   - `<name>.html`      standalone, opens from file:// or any static host
 *   - `<name>.body.html` the same content without the document skeleton, for
 *                        hosts that supply their own
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const OUT_DIR = 'artifacts/playtest';
const BUILD_DIR = 'dist-single';

function git(cmd: string[], fallback: string): string {
  try {
    return execFileSync('git', cmd, { encoding: 'utf8' }).trim();
  } catch {
    return fallback;
  }
}

const commit = git(['rev-parse', 'HEAD'], 'unknown');
const short = commit.slice(0, 8);

console.log('TEN COUNT — single-file playtest build\n');

console.log('  building one chunk …');
execFileSync('npx', ['vite', 'build'], {
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, SINGLE_FILE: '1' },
});

const html = readFileSync(join(BUILD_DIR, 'index.html'), 'utf8');

/*
 * Rollup emits exactly one script when `inlineDynamicImports` is set. If that
 * ever stops being true the inlined file would silently lose code, so this
 * fails loudly rather than producing a bundle that boots to a blank screen.
 */
const scripts = [...html.matchAll(/<script[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)];
if (scripts.length !== 1) {
  throw new Error(`expected exactly one script tag in the single-file build, found ${scripts.length}`);
}
const [scriptTag, scriptPath] = [scripts[0][0], scripts[0][1]];
const js = readFileSync(join(BUILD_DIR, scriptPath), 'utf8');

/*
 * A bundle that contains the literal sequence `</script` would close the tag
 * early and leave the rest of the game as page text. Escaping it inside the
 * script is safe: `<\/` is just `</` to a JavaScript parser.
 */
const inlined = js.replaceAll('</script', '<\\/script');

// Drop the modulepreload for the chunk that no longer exists separately.
const withoutPreload = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, '');

/*
 * The replacement is passed as a function, not a string. `String.replace`
 * expands `$&`, `` $` ``, `$'` and `$1` inside a string replacement, and a
 * minified bundle is full of `$` sequences — the first version of this line
 * spliced the original `<script src=...>` tag back into the middle of the
 * inlined code via `$&`, which the external-asset guard below then caught.
 */
const standalone = withoutPreload.replace(scriptTag, () => `<script type="module">\n${inlined}\n</script>`);

if (standalone.includes('src="./assets/')) {
  throw new Error('single-file build still references an external asset');
}

/*
 * The body-only form, for a host that supplies its own document skeleton.
 * Everything the game needs — the style block, the mount point and the script —
 * survives; only <!doctype>, <html>, <head> and <body> are removed.
 */
const head = standalone.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
const body = standalone.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';
const title = standalone.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? 'TEN COUNT';
const headKeep = head
  .replace(/<meta[^>]*>/g, '')
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .trim();
/*
 * The game commits to one visual world — a dark arena — so the page does not
 * follow a host's light theme. Without this, a light-themed host paints white
 * bars around the letterboxed canvas and the ring floats in a blank page.
 * `color-scheme` also stops the browser theming scrollbars and form controls
 * against it.
 */
const commitToDark = `<style>
  :root, :root[data-theme="light"], :root[data-theme="dark"] {
    color-scheme: dark;
    background: #05070b;
  }
  html, body { background: #05070b !important; overflow: hidden; }
</style>`;

const bodyForm = `<title>${title}</title>\n${commitToDark}\n${headKeep}\n${body.trim()}\n`;

mkdirSync(OUT_DIR, { recursive: true });
const name = `ten-count-${short}`;
const standalonePath = join(OUT_DIR, `${name}.html`);
const bodyPath = join(OUT_DIR, `${name}.body.html`);
writeFileSync(standalonePath, standalone);
writeFileSync(bodyPath, bodyForm);

const digest = createHash('sha256').update(readFileSync(standalonePath)).digest('hex');
const size = statSync(standalonePath).size;

console.log(`\n  commit    ${short}`);
console.log(`  standalone ${standalonePath}`);
console.log(`  body-only  ${bodyPath}`);
console.log(`  size      ${size.toLocaleString()} bytes`);
console.log(`  sha256    ${digest}`);

if (!existsSync(standalonePath)) process.exit(1);
console.log('\n  playtest build written. Not a release artifact — see the header of this file.');
