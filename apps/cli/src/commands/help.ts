import type { CAC } from 'cac';
import { renderHelp, renderTree } from '../cli/help';

/**
 * Register explicit `ai-pkgs help [command]` output.
 *
 * The root `--help` path is handled by `setupHelpOverride`; this command gives
 * users a Story-style discoverable path for command-specific help such as
 * `ai-pkgs help skills add`.
 */
export const registerHelpCommand = (cli: CAC) => {
  cli
    .command('help [...command]', 'Show help for a command')
    .option('-t, --tree', 'Print the full command tree')
    .action((command: string[] | undefined, options: { tree?: boolean }) => {
      if (options.tree === true) {
        process.stdout.write(renderTree(cli));
        return;
      }

      const commandName = Array.isArray(command)
        ? command.join(' ')
        : undefined;
      process.stdout.write(renderHelp(cli, commandName));
    });
};
