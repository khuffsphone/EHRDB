import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function configLines(): string[] {
  return readFileSync('.npmrc', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

describe('clean-install contract', () => {
  it('includes devDependencies even when NODE_ENV is production', () => {
    const lines = configLines();
    expect(lines).toContain('include=dev');
    expect(lines).not.toContain('omit=dev');
  });

  it('keeps every required build and verification executable declared', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      devDependencies?: Record<string, string>;
    };
    const dev = pkg.devDependencies ?? {};

    for (const dependency of ['eslint', 'playwright', 'tsx', 'typescript', 'vite', 'vitest']) {
      expect(dev, `${dependency} must remain installed by npm ci`).toHaveProperty(dependency);
    }
  });

  it('makes CI state the include-dev requirement explicitly', () => {
    const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
    expect(workflow).toContain('npm ci --include=dev');
  });
});
