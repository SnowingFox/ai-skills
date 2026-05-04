import type { CAC } from 'cac';
import {
  runInstallCommand,
  type InstallCommandRuntime,
} from '../install-command';

export const registerInstallCommand = (
  cli: CAC,
  runtime: InstallCommandRuntime
) => {
  const action = (options: Record<string, unknown>) =>
    runInstallCommand(options, runtime);

  const addInstallFlags = (command: ReturnType<CAC['command']>) =>
    command
      .option('-m, --manifest <path>', 'Path to ai-package.json')
      .option('-C, --dir <path>', 'Project directory to install into')
      .option('-a, --agent <agent>', 'Target agent (repeatable)')
      .option('--copy', 'Copy skill directories (default)')
      .option('--link', 'Symlink skill directories')
      .option('--force', 'Overwrite existing skill directories')
      .option('--skip-existing', 'Skip existing skill directories')
      .option('-y, --yes', 'Skip confirmation prompts');

  addInstallFlags(cli.command('install', 'Install skills from ai-package.json'))
    .usage('install [options]')
    .example('ai-pkgs install --agent cursor --yes')
    .example('ai-pkgs install --manifest config/ai-package.json --dir .')
    .action(action);
};
