import type { CAC } from 'cac';
import { SilentError } from '../../errors';
import type { InstallCommandOptions } from '../../install-command';
import { runSkillsAddCommand } from './add';
import { runSkillsListCommand } from './list';
import { runSkillsOutdatedCommand } from './outdated';
import { runSkillsRemoveCommand } from './remove';
import { runSkillsUpdateCommand, type SkillsUpdateOptions } from './update';
import {
  runSkillsVercelMigrateCommand,
  type SkillsVercelMigrateOptions,
} from './vercel-migrate';
import type {
  SkillsAddOptions,
  SkillsCommandRuntime,
  SkillsListOptions,
} from './types';

type SkillsCommandOptions = SkillsAddOptions &
  SkillsVercelMigrateOptions &
  SkillsListOptions &
  SkillsUpdateOptions &
  InstallCommandOptions;

/**
 * Register the `skills` command group on the cac CLI instance. Wires all
 * shared flags and delegates action dispatch to {@link runSkillsCommand}.
 */
export const registerSkillsCommand = (
  cli: CAC,
  runtime: SkillsCommandRuntime
) => {
  cli
    .command('skills [...args]', 'Manage skills')
    .usage(
      'skills <add|list|remove|outdated|update|search|vercel-migrate> [...args] [options]'
    )
    .option('--registry <registry>', 'github, gitlab, marketplace, or file')
    .option('--ref <ref>', 'Git ref to pin')
    .option('--path <path>', 'Path to scan inside the source')
    .option('-s, --skill <skill>', 'Skill name to add (repeatable)')
    .option('-a, --agent <agent>', 'Target agent (repeatable)')
    .option('--copy', 'Copy skill directories (default)')
    .option('--link', 'Symlink skill directories')
    .option('--force', 'Overwrite existing skill directories')
    .option('--skip-existing', 'Skip existing skill directories')
    .option('--install-only', 'Install without writing ai-package.json')
    .option('--project', 'Install into project-local agent skill directories')
    .option('-g, --global', 'Use the global ai-pkgs manifest and agent scope')
    .option('--all', 'Select all discovered skills')
    .option('--refresh', 'Refresh Git cache before installing')
    .option('--json', 'Print machine-readable JSON for supported commands')
    .option('--lockfile <path>', 'Path to legacy skills-lock.json')
    .option('--remove-lock', 'Remove skills-lock.json after migration')
    .option('--install', 'Install migrated ai-package.json after writing')
    .option('--verbose', 'Show per-skill install progress and paths')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-C, --dir <path>', 'Project directory')
    .option('-m, --manifest <path>', 'Path to ai-package.json')
    .action((args: string[] | undefined, options: SkillsCommandOptions) =>
      runSkillsCommand(args ?? [], options, runtime)
    );
};

/**
 * Dispatch `skills` subcommands (`add`, `list`, `remove`, `outdated`,
 * `update`, `vercel-migrate`, `search`) based on the first positional arg.
 *
 * @throws {SilentError} when no subcommand or an unknown subcommand is given.
 */
export const runSkillsCommand = async (
  args: string[],
  options: SkillsCommandOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const [subcommand, ...rest] = args;

  if (subcommand === 'add') {
    const source = rest[0];
    if (!source) {
      throw new SilentError('Usage: ai-pkgs skills add <source> [options]');
    }
    return runSkillsAddCommand(source, options, runtime);
  }

  if (subcommand === 'list') {
    return runSkillsListCommand(options, runtime);
  }

  if (subcommand === 'remove') {
    return runSkillsRemoveCommand(rest, options, runtime);
  }

  if (subcommand === 'outdated') {
    return runSkillsOutdatedCommand(rest, options, runtime);
  }

  if (subcommand === 'update') {
    return runSkillsUpdateCommand(rest, options, runtime);
  }

  if (subcommand === 'vercel-migrate') {
    return runSkillsVercelMigrateCommand(options, runtime);
  }

  if (subcommand === 'search') {
    throw new SilentError('Marketplace search is not implemented yet');
  }

  throw new SilentError(
    'Usage: ai-pkgs skills <add|list|remove|outdated|update|search|vercel-migrate>'
  );
};

export * from './add';
export * from './list';
export * from './outdated';
export * from './remove';
export * from './update';
export * from './vercel-migrate';
export type { SkillsAddOptions, SkillsCommandRuntime, SkillsListOptions };
