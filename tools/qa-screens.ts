/**
 * Browser QA capture.
 *
 * Serves the production build, drives the game with real keyboard events, and
 * captures every major screen plus a full bout flow at three viewport sizes.
 *
 * Navigation is *asserted*, not assumed: after every transition the harness
 * checks which scene is actually active and fails loudly if it is not the
 * expected one. Silently screenshotting the wrong screen is worse than no
 * screenshot at all.
 *
 *   npm run qa:screens
 */
import { chromium, type Browser, type Page, type ConsoleMessage } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = 'artifacts/qa/screens';
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;

const VIEWPORTS = [
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1024x768', width: 1024, height: 768 },
];

interface Issue {
  viewport: string;
  where: string;
  message: string;
}

const issues: Issue[] = [];
const captured: string[] = [];
const visited = new Set<string>();

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

async function focusLabel(page: Page): Promise<string> {
  return ((await page.evaluate(`window.__TEN_COUNT__.focusLabel()`)) as string | null) ?? '';
}

/**
 * Navigates to a row by its label rather than by counting keypresses, so the
 * harness does not silently drift when a menu gains a row.
 */
async function focusRow(page: Page, wanted: string, vp: string): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    const label = await focusLabel(page);
    if (label.toLowerCase().startsWith(wanted.toLowerCase())) return true;
    await tap(page, 'KeyS', 1, 70);
  }
  issues.push({ viewport: vp, where: 'navigation', message: `could not focus row "${wanted}" (saw "${await focusLabel(page)}")` });
  return false;
}

async function activeScene(page: Page): Promise<string> {
  const list = (await page.evaluate(`window.__TEN_COUNT__.activeScenes()`)) as string[];
  return list[list.length - 1] ?? '(none)';
}

/** Presses a key with a hold long enough for the fixed-step loop to see it. */
async function tap(page: Page, key: string, times = 1, gap = 120): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.down(key);
    await sleep(50);
    await page.keyboard.up(key);
    await sleep(gap);
  }
}

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await sleep(ms);
  await page.keyboard.up(key);
}

class Session {
  constructor(
    readonly page: Page,
    readonly vp: string,
  ) {}

  async shot(name: string): Promise<void> {
    const dir = `${OUT}/${this.vp}`;
    mkdirSync(dir, { recursive: true });
    const file = `${dir}/${name}.png`;
    await this.page.screenshot({ path: file });
    captured.push(file);
  }

  /** Asserts the active scene, then captures it. */
  async expect(scene: string, shotName: string): Promise<boolean> {
    const actual = await activeScene(this.page);
    if (actual !== scene) {
      issues.push({ viewport: this.vp, where: 'navigation', message: `expected scene ${scene}, found ${actual}` });
      await this.shot(`${shotName}-UNEXPECTED-${actual}`);
      return false;
    }
    visited.add(scene);
    await this.shot(shotName);
    return true;
  }

  /** Enters a main-menu item by index. The cursor is always 0 on entry. */
  async fromMenu(index: number): Promise<void> {
    await tap(this.page, 'KeyS', index, 100);
    await tap(this.page, 'Enter');
    await sleep(850);
  }

  async back(): Promise<void> {
    await tap(this.page, 'Backspace');
    await sleep(800);
  }
}

async function runViewport(browser: Browser, vp: (typeof VIEWPORTS)[number]): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const s = new Session(page, vp.name);

  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') issues.push({ viewport: vp.name, where: 'console', message: m.text() });
  });
  page.on('pageerror', (e) => issues.push({ viewport: vp.name, where: 'pageerror', message: String(e) }));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(`Boolean(window.__TEN_COUNT__)`, undefined, { timeout: 20000 });
  await sleep(1400);

  await s.expect('Title', '01-title');
  await tap(page, 'Enter');
  await sleep(900);
  await s.expect('MainMenu', '02-main-menu');

  // On a fresh save the main menu is:
  // 0 New Career, 1 Exhibition, 2 Training Lab, 3 Hall, 4 Settings, 5 Controls, 6 Credits
  await s.fromMenu(4);
  await s.expect('Settings', '03-settings');
  await s.back();

  await s.fromMenu(5);
  await s.expect('Controls', '04-controls');
  // Show the gamepad page too, so the remap screen is evidenced in both modes.
  await tap(page, 'KeyD');
  await sleep(400);
  await s.shot('05-controls-gamepad');
  await s.back();

  await s.fromMenu(6);
  await s.expect('Credits', '06-credits');
  await s.back();

  await s.fromMenu(3);
  await s.expect('Legacy', '07-hall-of-careers');
  await s.back();

  await s.fromMenu(1);
  await s.expect('Exhibition', '08-exhibition');
  await s.back();

  await s.fromMenu(2);
  await s.expect('Lab', '09-training-lab');
  // Throw punches so the frame readout and hitboxes are populated.
  await tap(page, 'KeyJ', 3, 160);
  await tap(page, 'KeyK', 1, 260);
  await hold(page, 'KeyD', 300);
  await tap(page, 'KeyU', 1, 200);
  await sleep(300);
  await s.shot('10-training-lab-active');
  await s.back();

  // --- Career ------------------------------------------------------------
  await s.fromMenu(0);
  if (!(await s.expect('Creation', '11-creation'))) {
    await ctx.close();
    return;
  }

  // Name the boxer with real typing.
  await focusRow(page, 'Name', vp.name);
  await tap(page, 'Enter');
  await sleep(300);
  await page.keyboard.type('Ada Vance', { delay: 55 });
  await sleep(200);
  await tap(page, 'Enter');
  await sleep(400);
  await s.shot('12-creation-named');

  await focusRow(page, 'Style', vp.name);
  await tap(page, 'KeyD', 2, 140);
  await sleep(200);
  await s.shot('13-creation-style');

  await focusRow(page, 'Power', vp.name);
  await tap(page, 'KeyD', 4, 110);
  await sleep(200);
  await s.shot('14-creation-ratings');

  await focusRow(page, 'Trunks', vp.name);
  await tap(page, 'KeyD', 3, 110);
  await sleep(200);
  await s.shot('15-creation-appearance');

  await focusRow(page, 'Randomise', vp.name);
  await tap(page, 'Enter');
  await sleep(400);
  await s.shot('15b-creation-randomised');

  await focusRow(page, 'Begin Career', vp.name);
  await tap(page, 'Enter');
  await sleep(1400);

  if (!(await s.expect('CareerHub', '16-career-hub'))) {
    await ctx.close();
    return;
  }

  await focusRow(page, 'Rankings', vp.name);
  await tap(page, 'Enter');
  await sleep(900);
  await s.expect('Rankings', '17-rankings');
  await s.back();

  await focusRow(page, 'Choose Your Next Fight', vp.name);
  await tap(page, 'Enter');
  await sleep(900);
  await s.expect('OpponentSelect', '18-opponent-select');
  await tap(page, 'KeyS', 1, 140);
  await sleep(300);
  await s.shot('19-opponent-select-scouting');
  await tap(page, 'KeyW', 1, 140);
  await tap(page, 'Enter');
  await sleep(900);
  await s.expect('PreFight', '20-prefight');

  await tap(page, 'Enter');
  await sleep(2800);
  if (!(await s.expect('Bout', '21-bout-round1'))) {
    await ctx.close();
    return;
  }

  // Fight, with a genuine mix of movement, punches and guard.
  for (let i = 0; i < 30; i++) {
    await hold(page, 'KeyD', 110);
    await tap(page, 'KeyJ', 2, 70);
    if (i % 3 === 0) await tap(page, 'KeyK', 1, 90);
    if (i % 4 === 0) await hold(page, 'Space', 220);
    if (i % 5 === 0) await tap(page, 'KeyU', 1, 90);
    if (i % 7 === 0) await hold(page, 'KeyA', 130);
    if (i === 14) await s.shot('22-bout-exchange');
  }
  await s.shot('23-bout-later');

  await tap(page, 'Escape');
  await sleep(600);
  await s.shot('24-bout-pause');
  await tap(page, 'Escape');
  await sleep(500);

  // Play on until the bout resolves, so the result screen is reached.
  for (let i = 0; i < 320 && (await activeScene(page)) === 'Bout'; i++) {
    await hold(page, 'KeyD', 90);
    await tap(page, 'KeyJ', 2, 60);
    if (i % 3 === 0) await tap(page, 'KeyK', 1, 70);
    if (i % 6 === 0) await hold(page, 'Space', 180);
  }

  const after = await activeScene(page);
  if (after === 'Result') {
    await s.expect('Result', '25-result');
    await tap(page, 'Enter');
    await sleep(1200);
    const next = await activeScene(page);
    if (next === 'Training') {
      await s.expect('Training', '26-training-camp');
      await tap(page, 'Enter');
      await sleep(500);
      await s.shot('27-training-picked');
    } else {
      issues.push({ viewport: vp.name, where: 'flow', message: `after Result expected Training, found ${next}` });
    }
  } else {
    issues.push({ viewport: vp.name, where: 'flow', message: `bout did not resolve within the drive loop (scene ${after})` });
    await s.shot('25-bout-unresolved');
  }

  await ctx.close();
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const vp of VIEWPORTS) {
      console.log(`  capturing ${vp.name}…`);
      await runViewport(browser, vp);
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  const report = {
    capturedAt: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.name),
    scenesVisited: [...visited].sort(),
    screenshots: captured,
    issues,
  };
  mkdirSync('artifacts/qa', { recursive: true });
  writeFileSync('artifacts/qa/screens-report.json', JSON.stringify(report, null, 2));

  console.log(`\n  ${captured.length} screenshots across ${VIEWPORTS.length} viewports.`);
  console.log(`  scenes verified: ${[...visited].sort().join(', ')}`);
  if (issues.length > 0) {
    console.error(`\n  ISSUES (${issues.length}):`);
    for (const i of issues.slice(0, 40)) console.error(`    [${i.viewport}] ${i.where}: ${i.message}`);
    process.exit(1);
  }
  console.log('  no console errors, no uncaught exceptions, no navigation drift.');
}

void main();
