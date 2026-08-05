/**
 * Cross-platform package-manager command resolution.
 *
 * `spawn('npx', ...)` is not portable on Windows because npm installs `npx` as
 * a command shim. When a tool is itself started by `npm run`, `npm_execpath`
 * identifies the exact package-manager CLI that launched it. Running that CLI
 * through the current Node executable avoids shell parsing, PATH ambiguity and
 * `.cmd` handling entirely. Direct invocations fall back to `npm.cmd` on
 * Windows and `npm` elsewhere.
 */

export interface PackageManagerContext {
  platform: NodeJS.Platform;
  execPath: string;
  npmExecPath?: string;
}

export interface CommandLine {
  command: string;
  args: string[];
  display: string;
}

function quote(value: string): string {
  return /\s|"/.test(value) ? JSON.stringify(value) : value;
}

export function resolvePackageManagerCommand(
  args: readonly string[],
  context: PackageManagerContext = {
    platform: process.platform,
    execPath: process.execPath,
    npmExecPath: process.env.npm_execpath,
  },
): CommandLine {
  const npmExecPath = context.npmExecPath?.trim();
  const forwarded = [...args];

  if (npmExecPath) {
    const commandArgs = [npmExecPath, ...forwarded];
    return {
      command: context.execPath,
      args: commandArgs,
      display: [context.execPath, ...commandArgs].map(quote).join(' '),
    };
  }

  const command = context.platform === 'win32' ? 'npm.cmd' : 'npm';
  return {
    command,
    args: forwarded,
    display: [command, ...forwarded].map(quote).join(' '),
  };
}

export function npmRunScript(
  script: string,
  scriptArgs: readonly string[] = [],
  context?: PackageManagerContext,
): CommandLine {
  const args = ['run', script];
  if (scriptArgs.length > 0) args.push('--', ...scriptArgs);
  return resolvePackageManagerCommand(args, context);
}
