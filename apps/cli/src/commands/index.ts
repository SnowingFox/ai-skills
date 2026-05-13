import type { CAC } from 'cac';
import type { InstallCommandRuntime } from '../install-command';
import { registerCacheCommand } from './cache';
import { registerHelpCommand } from './help';
import { registerInstallCommand } from './install';
import { registerPluginsCommand } from './plugins/index';
import { registerSkillsCommand } from './skills/index';
import { registerWorkspaceCommand } from './workspace/index';

/**
 * Register all top-level commands (`help`, `cache`, `install`, `skills`,
 * `plugins`, `workspace`) on the cac CLI instance. Called once from
 * {@link buildCli}.
 */
export const registerCoreCommands = (
  cli: CAC,
  runtime: InstallCommandRuntime
) => {
  registerHelpCommand(cli);
  registerCacheCommand(cli);
  registerInstallCommand(cli, runtime);
  registerSkillsCommand(cli, runtime);
  registerPluginsCommand(cli, runtime);
  registerWorkspaceCommand(cli, runtime);
};
