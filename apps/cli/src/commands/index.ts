import type { CAC } from 'cac';
import type { InstallCommandRuntime } from '../install-command';
import { registerCacheCommand } from './cache';
import { registerHelpCommand } from './help';
import { registerInstallCommand } from './install';
import { registerSkillsCommand } from './skills/index';

export const registerCoreCommands = (
  cli: CAC,
  runtime: InstallCommandRuntime
) => {
  registerHelpCommand(cli);
  registerCacheCommand(cli);
  registerInstallCommand(cli, runtime);
  registerSkillsCommand(cli, runtime);
};
