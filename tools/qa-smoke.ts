/**
 * Browser smoke test.
 *
 * Drives the production build through menu → bout → result → save → reload and
 * asserts that the career actually persisted. Fails on any console error or
 * uncaught exception.
 *
 * This is the end-to-end gate; `qa:screens` is the visual evidence pass.
 */
import { chromium, type ConsoleMessage, type Page } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 4174;
const URL = `http://localhost:${PORT}/`;

const errors: string[] = [];
const steps: { step: string; ok: boolean; detail: string }[] = [];

function record(step: string, ok: boolean, detail = ''): void {
  steps.push({ step, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

async function startServer(): Promise<ChildProcess> {
  if (!existsSync('dist/index.html')) throw new Error('dist/ is missing — run `npm run build` first.');
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(URL)).ok) return proc;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('preview server did not start');
}

const scene = (p: Page) =>
  p.evaluate(`window.__TEN_COUNT__.activeScenes().slice(-1)[0]`) as Promise<string>;
const focus = (p: Page) =>
  p.evaluate(`window.__TEN_COUNT__.focusLabel() || ''`) as Promise<string>;

async function tap(p: Page, key: string, times = 1, gap = 110): Promise<void> {
  for (let i = 0; i < times; i++) {
    await p.keyboard.down(key);
    await sleep(50);
    await p.keyboard.up(key);
    await sleep(gap);
  }
}

async function focusRow(p: Page, wanted: string): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    if ((await focus(p)).toLowerCase().startsWith(wanted.toLowerCase())) return true;
    await tap(p, 'KeyS', 1, 70);
  }
  return false;
}

async function waitForScene(p: Page, wanted: string, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if ((await scene(p)) === wanted) return true;
    await sleep(200);
  }
  return false;
}

async function main(): Promise<void> {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`));

  try {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(`Boolean(window.__TEN_COUNT__)`, undefined, { timeout: 20000 });
    await sleep(1200);
    record('boots to the title screen', (await scene(page)) === 'Title');

    await tap(page, 'Enter');
    await sleep(800);
    record('reaches the main menu', (await scene(page)) === 'MainMenu');

    // New career.
    await focusRow(page, 'New Career');
    await tap(page, 'Enter');
    await sleep(900);
    record('opens boxer creation', (await scene(page)) === 'Creation');

    await focusRow(page, 'Name');
    await tap(page, 'Enter');
    await sleep(250);
    await page.keyboard.type('Smoke Tester', { delay: 40 });
    await tap(page, 'Enter');
    await sleep(300);

    await focusRow(page, 'Begin Career');
    await tap(page, 'Enter');
    await sleep(1300);
    record('creates a career', (await scene(page)) === 'CareerHub');

    // Take a fight.
    await focusRow(page, 'Choose Your Next Fight');
    await tap(page, 'Enter');
    await sleep(900);
    record('reaches opponent selection', (await scene(page)) === 'OpponentSelect');
    await tap(page, 'Enter');
    await sleep(900);
    record('reaches the tale of the tape', (await scene(page)) === 'PreFight');
    await tap(page, 'Enter');
    await sleep(2600);
    record('enters the ring', (await scene(page)) === 'Bout');

    // Fight it out.
    for (let i = 0; i < 400 && (await scene(page)) === 'Bout'; i++) {
      await page.keyboard.down('KeyD');
      await sleep(90);
      await page.keyboard.up('KeyD');
      await tap(page, 'KeyJ', 2, 55);
      if (i % 3 === 0) await tap(page, 'KeyK', 1, 65);
      if (i % 5 === 0) {
        await page.keyboard.down('Space');
        await sleep(170);
        await page.keyboard.up('Space');
      }
      // Recovery input, in case we are on the canvas.
      if (i % 2 === 0) await tap(page, 'Enter', 1, 40);
    }
    const resolved = await waitForScene(page, 'Result', 8000);
    record('the bout resolves to a result', resolved, `scene ${await scene(page)}`);

    await tap(page, 'Enter');
    await sleep(1200);
    record('advances to training camp', (await scene(page)) === 'Training');

    // The career must be on disk by now.
    const saved = (await page.evaluate(`localStorage.getItem('tencount.save.v1')`)) as string | null;
    const hasCareer = typeof saved === 'string' && saved.includes('Smoke Tester');
    record('persists the career to storage', hasCareer, saved ? `${saved.length} bytes` : 'nothing written');

    // Reload and confirm it comes back.
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(`Boolean(window.__TEN_COUNT__)`, undefined, { timeout: 20000 });
    await sleep(1400);
    await tap(page, 'Enter');
    await sleep(900);
    const label = await focus(page);
    record('offers to continue the saved career after reload', label.toLowerCase().includes('continue'), `focus "${label}"`);

    await tap(page, 'Enter');
    await sleep(1400);
    const back = await scene(page);
    record('reloads straight back into the career', back === 'CareerHub' || back === 'Training', `scene ${back}`);
  } finally {
    await ctx.close();
    await browser.close();
    server.kill('SIGTERM');
  }

  mkdirSync('artifacts/qa', { recursive: true });
  writeFileSync(
    'artifacts/qa/smoke-report.json',
    JSON.stringify({ ranAt: new Date().toISOString(), steps, consoleErrors: errors }, null, 2),
  );

  const failed = steps.filter((s) => !s.ok);
  if (errors.length > 0) {
    console.error(`\n  console/page errors (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.error(`    ${e}`);
  }
  if (failed.length > 0 || errors.length > 0) {
    console.error(`\nsmoke test FAILED (${failed.length} step(s), ${errors.length} error(s))`);
    process.exit(1);
  }
  console.log(`\nsmoke test passed: ${steps.length} steps, zero console errors`);
}

void main();
