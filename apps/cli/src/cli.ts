import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { updateSettings } from '@clack/core';
import cac, { type CAC } from 'cac';
import {
  createInstallCommandRuntime,
  type InstallCommandRuntime,
  type InstallCommandRuntimeOverrides,
} from './install-command';
import { setupHelpOverride } from './cli/help';
import { registerCoreCommands } from './commands';
import { formatCliError, resolveCliResult, runParsedCli } from './cli/runtime';

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

if (isCliEntryPoint()) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}

function isCliEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return pathToFileURL(resolve(entry)).href === import.meta.url;
}
