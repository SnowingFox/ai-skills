import type { CAC } from 'cac';
import type { InstallCommandRuntime } from '../install-command';
import { registerHelpCommand } from './help';
import { registerInstallCommand } from './install';
import { registerSkillsCommand } from './skills';

export const registerCoreCommands = (
  cli: CAC,
  runtime: InstallCommandRuntime
) => {
  registerHelpCommand(cli);
  registerInstallCommand(cli, runtime);
  registerSkillsCommand(cli, runtime);
};
