import { updateSettings } from '@clack/core';
import cac, { type CAC } from 'cac';
import { registerCoreCommands } from '../commands';
import {
  createInstallCommandRuntime,
  type InstallCommandRuntime,
  type InstallCommandRuntimeOverrides,
} from '../install-command';
import { setupHelpOverride } from './help';
import { formatCliError, resolveCliResult, runParsedCli } from './runtime';

/**
 * CLI application entrypoint. Applies Clack settings, builds the command
 * parser, and runs the matched command with unified error handling.
 *
 * @example
 * const exitCode = await runCli(process.argv);
 * process.exitCode = exitCode;
 */
export const runCli = async (
  argv = process.argv,
  cwd = process.cwd(),
  runtime: InstallCommandRuntimeOverrides = {}
): Promise<number> => {
  updateSettings({
    messages: {
      cancel: 'Install cancelled',
      error: 'Install failed',
    },
  });

  const cli = buildCli(createInstallCommandRuntime(cwd, runtime));
  return runParsedCli(cli, argv);
};

/**
 * Build the command parser. A bare `ai-pkgs` invocation renders help; only the
 * explicit `install` command restores skills from `ai-package.json`.
 */
export const buildCli = (runtime: InstallCommandRuntime): CAC => {
  const cli = cac('ai-pkgs');

  cli.usage('<command> [...args]');
  setupHelpOverride(cli);
  registerCoreCommands(cli, runtime);

  return cli;
};

export { formatCliError, resolveCliResult };
