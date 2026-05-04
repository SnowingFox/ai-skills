import type { CAC, Command } from 'cac';
import pc from 'picocolors';
import { DETAILED_HELP, TAGLINE } from './help-data/root';
import { SKILLS_COMMANDS, SKILLS_GROUP_COMMAND } from './help-data/skills';
import type { HelpCommand } from './help-data/types';
import { renderLogo } from '../ui/banner';

const INDENT = '  ';

/**
 * Install AI-PKGS' custom help renderer on a cac instance.
 *
 * This mirrors Story's help boundary: command registration stays in
 * `commands/*`, while the CLI shell owns the visual help contract for
 * `--help`, `help`, and hidden tree output.
 */
export const setupHelpOverride = (cli: CAC): void => {
  cli.option('--ai', 'Run in strict non-interactive mode for AI/automation');
  cli.option('-t, --tree', 'Print the full command tree (hidden)');
  cli.help(() => {
    const cmdName = cli.matchedCommandName ?? undefined;
    if (cli.options.tree === true) {
      return [{ body: renderTree(cli).trimEnd() }];
    }

    return [{ body: renderHelp(cli, cmdName).trimEnd() }];
  });
};

/**
 * Render root help or a single command's help block.
 *
 * @example
 * renderHelp(cli);
 * // ┌
 * // │   █████╗ ██╗      ██████╗ ██╗  ██╗ ██████╗ ███████╗
 * // │
 * // │  Composable skills for AI agents.
 * // │
 * // │  Usage:
 * // │    ai-pkgs <command> [...args]
 * // └
 */
export const renderHelp = (cli: CAC, cmd?: string): string => {
  if (cmd !== undefined) {
    const match = findCommand(cli, cmd);
    if (match) {
      return renderCommandHelp(cli, match);
    }
  }

  return renderRootHelp(cli);
};

/**
 * Render all visible commands as a compact tree. This is intentionally hidden
 * behind `--tree`; it is useful for tests and future command grouping work.
 */
export const renderTree = (cli: CAC): string => {
  const visible = visibleCommands(cli);
  const lines = boxHeader('ai-pkgs');

  for (let index = 0; index < visible.length; index += 1) {
    const command = visible[index];
    if (!command) {
      continue;
    }

    const branch = index === visible.length - 1 ? '└──' : '├──';
    lines.push(
      `${pc.gray('│')}  ${pc.gray(branch)} ${pc.cyan(
        command.name.padEnd(16)
      )} ${command.description}`
    );
  }

  lines.push(pc.gray('└'));
  return `${lines.join('\n')}\n`;
};

const renderRootHelp = (cli: CAC): string => {
  const visible = visibleCommands(cli);
  const commandWidth = Math.max(8, ...visible.map((cmd) => cmd.name.length));
  const globalFlags = visibleGlobalFlags(cli);
  const lines = [pc.gray('┌')];

  for (const line of renderLogo().split('\n')) {
    lines.push(`${pc.gray('│')}  ${line}`);
  }
  lines.push(`${pc.gray('│')}  ${pc.dim(TAGLINE)}`);
  lines.push(pc.gray('│'));
  lines.push(`${pc.gray('│')}  ${pc.bold('Usage:')}`);
  lines.push(
    `${pc.gray('│')}  ${INDENT}${pc.magenta('ai-pkgs')} <command> [...args]`
  );
  lines.push(pc.gray('│'));
  lines.push(`${pc.gray('│')}  ${pc.bold('Commands:')}`);
  for (const command of visible) {
    lines.push(
      `${pc.gray('│')}  ${INDENT}${pc.cyan(
        command.name.padEnd(commandWidth)
      )}  ${command.description}`
    );
  }

  if (globalFlags.length > 0) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Global flags:')}`);
    lines.push(...renderFlagRows(globalFlags));
  }

  lines.push(pc.gray('│'));
  lines.push(`${pc.gray('│')}  ${pc.bold('Detailed help:')}`);
  lines.push(...renderCommandRows(DETAILED_HELP));
  lines.push(pc.gray('│'));
  lines.push(
    `${pc.gray('│')}  ${pc.dim("Run 'ai-pkgs help <command>' for details.")}`
  );
  lines.push(pc.gray('└'));
  return `${lines.join('\n')}\n`;
};

const renderCommandHelp = (cli: CAC, command: HelpCommand): string => {
  const lines = boxHeader(`ai-pkgs ${command.name}`);
  lines.push(`${pc.gray('│')}  ${command.description}`);

  if (command.usageText) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Usage:')}  ${command.usageText}`);
  }

  if (command.subcommands && command.subcommands.length > 0) {
    const commandWidth = Math.max(
      24,
      ...command.subcommands.map(([usage]) => usage.length)
    );
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Commands:')}`);
    for (const [usage, description] of command.subcommands) {
      lines.push(
        `${pc.gray('│')}  ${INDENT}${pc.cyan(
          usage.padEnd(commandWidth)
        )}  ${description}`
      );
    }
  }

  if (command.options.length > 0) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Flags:')}`);
    lines.push(...renderFlagRows(command.options));
  }

  if (command.optionGroups && command.optionGroups.length > 0) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Flags:')}`);
    for (const group of command.optionGroups) {
      lines.push(`${pc.gray('│')}  ${INDENT}${pc.bold(group.title)}`);
      lines.push(...renderFlagRows(group.options, INDENT.length * 2));
    }
  }

  if (command.exampleGroups && command.exampleGroups.length > 0) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Examples:')}`);
    for (const group of command.exampleGroups) {
      lines.push(`${pc.gray('│')}  ${INDENT}${pc.bold(group.title)}`);
      for (const [example, description] of group.examples) {
        lines.push(`${pc.gray('│')}  ${INDENT}${INDENT}${pc.dim(example)}`);
        lines.push(
          `${pc.gray('│')}  ${INDENT}${INDENT}${INDENT}${description}`
        );
      }
    }
  }

  if (command.notes && command.notes.length > 0) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Notes:')}`);
    for (const note of command.notes) {
      lines.push(`${pc.gray('│')}  ${INDENT}${pc.dim(note)}`);
    }
  }

  const globalFlags = visibleGlobalFlags(cli);
  if (globalFlags.length > 0) {
    lines.push(pc.gray('│'));
    lines.push(`${pc.gray('│')}  ${pc.bold('Global flags:')}`);
    lines.push(...renderFlagRows(globalFlags));
  }

  lines.push(pc.gray('└'));
  return `${lines.join('\n')}\n`;
};

const boxHeader = (title: string): string[] => [
  `${pc.gray('┌')}  ${pc.cyan(pc.bold(title))}`,
  pc.gray('│'),
];

const renderFlagRows = (
  flags: [rawName: string, description: string][],
  extraIndent = 0
): string[] => {
  const flagWidth = Math.max(18, ...flags.map(([rawName]) => rawName.length));
  const indent = INDENT.repeat(1 + extraIndent / INDENT.length);
  return flags.map(
    ([rawName, description]) =>
      `${pc.gray('│')}  ${indent}${pc.dim(
        rawName.padEnd(flagWidth)
      )}  ${description}`
  );
};

const renderCommandRows = (
  rows: [command: string, description: string][]
): string[] => {
  const commandWidth = Math.max(18, ...rows.map(([command]) => command.length));
  return rows.map(
    ([command, description]) =>
      `${pc.gray('│')}  ${INDENT}${pc.cyan(
        command.padEnd(commandWidth)
      )}  ${description}`
  );
};

const visibleGlobalFlags = (
  cli: CAC
): [rawName: string, description: string][] =>
  cli.globalCommand.options
    .filter((option) => !option.names.includes('tree'))
    .map((option) => [option.rawName, option.description ?? '']);

const visibleCommands = (cli: CAC): HelpCommand[] => [
  ...cli.commands
    .filter(
      (command) =>
        command.description !== '' &&
        command.name !== '' &&
        command.name !== '@@global@@' &&
        command.name !== 'skills'
    )
    .map(toHelpCommand),
  ...SKILLS_COMMANDS,
];

const findCommand = (cli: CAC, name: string): HelpCommand | undefined => {
  if (name === 'skills') {
    return SKILLS_GROUP_COMMAND;
  }

  const command = cli.commands.find(
    (command) => command.name === name || command.aliasNames.includes(name)
  );
  if (command) {
    return toHelpCommand(command);
  }

  return SKILLS_COMMANDS.find((command) => command.name === name);
};

const toHelpCommand = (command: Command): HelpCommand => ({
  name: command.name,
  description: command.description,
  usageText: command.usageText,
  options: command.options.map((option) => [
    option.rawName,
    option.description ?? '',
  ]),
});
