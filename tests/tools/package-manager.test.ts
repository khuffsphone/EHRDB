import { describe, expect, it } from 'vitest';
import {
  npmRunScript,
  resolvePackageManagerCommand,
  type PackageManagerContext,
} from '../../tools/package-manager';

const WINDOWS_CONTEXT: PackageManagerContext = {
  platform: 'win32',
  execPath: 'C:\\Program Files\\nodejs\\node.exe',
  npmExecPath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
};

describe('package-manager command resolution', () => {
  it('runs the exact npm CLI through Node when npm_execpath is available', () => {
    const command = resolvePackageManagerCommand(['run', 'typecheck'], WINDOWS_CONTEXT);

    expect(command.command).toBe(WINDOWS_CONTEXT.execPath);
    expect(command.args).toEqual([WINDOWS_CONTEXT.npmExecPath, 'run', 'typecheck']);
    expect(command.display).toContain('npm-cli.js');
  });

  it('falls back to npm.cmd for direct Windows invocations', () => {
    const command = resolvePackageManagerCommand(['run', 'lint'], {
      platform: 'win32',
      execPath: 'node.exe',
    });

    expect(command.command).toBe('npm.cmd');
    expect(command.args).toEqual(['run', 'lint']);
  });

  it('falls back to npm on non-Windows platforms', () => {
    const command = resolvePackageManagerCommand(['run', 'test'], {
      platform: 'linux',
      execPath: '/usr/bin/node',
    });

    expect(command.command).toBe('npm');
    expect(command.args).toEqual(['run', 'test']);
  });

  it('adds the npm argument separator only when script arguments exist', () => {
    expect(npmRunScript('typecheck', [], WINDOWS_CONTEXT).args).toEqual([
      WINDOWS_CONTEXT.npmExecPath,
      'run',
      'typecheck',
    ]);

    expect(npmRunScript('soak', ['--bouts', '200'], WINDOWS_CONTEXT).args).toEqual([
      WINDOWS_CONTEXT.npmExecPath,
      'run',
      'soak',
      '--',
      '--bouts',
      '200',
    ]);
  });

  it('preserves paths and arguments containing spaces without shell parsing', () => {
    const command = npmRunScript(
      'qa:smoke',
      ['--report', 'artifacts/qa/smoke report.json'],
      WINDOWS_CONTEXT,
    );

    expect(command.command).toBe('C:\\Program Files\\nodejs\\node.exe');
    expect(command.args.at(-1)).toBe('artifacts/qa/smoke report.json');
    expect(command.display).toContain('"C:\\\\Program Files\\\\nodejs\\\\node.exe"');
  });
});
