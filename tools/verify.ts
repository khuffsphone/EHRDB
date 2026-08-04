/**
 * The aggregate gate.
 *
 * One command that runs every required check and fails on any of them. Each
 * stage's exact output is written to artifacts/qa/verify/ so the evidence is
 * the real thing rather than a summary of it.
 *
 *   npm run verify
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { npmRunScript } from './package-manager';

interface Stage {
  name: string;
  script: string;
  args: string[];
  /** Required stages fail the run; optional ones only warn. */
  required: boolean;
  description: string;
}

const STAGES: Stage[] = [
  { name: 'typecheck', script: 'typecheck', args: [], required: true, description: 'TypeScript, strict, zero errors' },
  { name: 'lint', script: 'lint', args: [], required: true, description: 'ESLint, zero warnings' },
  { name: 'content', script: 'assets:validate', args: [], required: true, description: 'content and generated-asset definitions' },
  { name: 'tests', script: 'test', args: ['--reporter=verbose'], required: true, description: 'unit, determinism, combat, AI, career, save and soak suites' },
  { name: 'build', script: 'build', args: [], required: true, description: 'production build' },
  { name: 'release-audit', script: 'release:audit', args: [], required: true, description: 'legal and provenance audit of source and bundle' },
  { name: 'soak', script: 'soak', args: ['--bouts', '200', '--json', 'artifacts/qa/soak.json'], required: true, description: '200 seeded AI-versus-AI bouts' },
  { name: 'soak-mirror', script: 'soak', args: ['--mirror', '--bouts', '200', '--json', 'artifacts/qa/soak-mirror.json'], required: true, description: '200 control bouts, ratings held equal' },
  // The balance claim itself, at the sample size where the claim is testable.
  // The 200-bout batch above is for iteration; its sampling error is wider
  // than half the documented band, so it cannot certify anything.
  { name: 'balance-certify', script: 'balance:certify', args: ['--seed', '63000', '--json', 'artifacts/qa/balance-certify.json'], required: true, description: 'documented balance targets, 1200 control bouts' },
  { name: 'career-sim', script: 'career:sim', args: ['--careers', '12', '--json', 'artifacts/qa/career.json'], required: true, description: '12 complete careers played through the real simulation' },
  { name: 'smoke', script: 'qa:smoke', args: [], required: true, description: 'browser end-to-end: menu, bout, result, save, reload' },
];

const OUT = 'artifacts/qa/verify';

function run(stage: Stage): { ok: boolean; ms: number; output: string; command: string } {
  const started = Date.now();
  const launch = npmRunScript(stage.script, stage.args);
  const result = spawnSync(launch.command, launch.args, {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
    maxBuffer: 64 * 1024 * 1024,
  });
  const ms = Date.now() - started;
  const output = [
    result.stdout ?? '',
    result.stderr ?? '',
    result.error ? `spawn error: ${result.error.stack ?? result.error.message}` : '',
  ]
    .filter(Boolean)
    .join('');
  return { ok: result.status === 0 && result.error === undefined, ms, output, command: launch.display };
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const results: { stage: string; ok: boolean; seconds: number; required: boolean }[] = [];
  let failed = 0;

  console.log('\nTEN COUNT — verify\n');

  for (const stage of STAGES) {
    process.stdout.write(`  ${stage.name.padEnd(14)} ${stage.description} … `);
    const { ok, ms, output, command } = run(stage);
    writeFileSync(`${OUT}/${stage.name}.txt`, `$ ${command}\n\n${output}`);
    results.push({ stage: stage.name, ok, seconds: Math.round(ms / 100) / 10, required: stage.required });
    console.log(`${ok ? 'PASS' : 'FAIL'} (${(ms / 1000).toFixed(1)}s)`);
    if (!ok) {
      failed++;
      // Show enough of the failure to act on without scrolling a log file.
      const tail = output.trim().split('\n').slice(-25).join('\n');
      console.error(`\n--- ${stage.name} output (tail) ---\n${tail}\n---\n`);
      // A broken toolchain makes every later stage meaningless.
      if (stage.name === 'typecheck' || stage.name === 'build') break;
    }
  }

  const summary = {
    ranAt: new Date().toISOString(),
    node: process.version,
    results,
    passed: failed === 0,
  };
  writeFileSync('artifacts/qa/verify-summary.json', JSON.stringify(summary, null, 2));

  console.log('');
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.stage.padEnd(14)} ${r.seconds}s`);
  console.log(`\n  full output: ${OUT}/`);

  if (failed > 0) {
    console.error(`\nVERIFY FAILED — ${failed} stage(s)`);
    process.exit(1);
  }
  console.log('\nVERIFY PASSED — every required gate is green.');
}

main();
