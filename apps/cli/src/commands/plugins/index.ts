import type { CAC } from 'cac';
import { SilentError } from '../../errors';
import type { InstallCommandOptions } from '../../install-command';
import { runPluginsAddCommand } from './add';
import { runPluginsInitCommand } from './init';
import { runPluginsListCommand } from './list';
import { runPluginsOutdatedCommand } from './outdated';
import { runPluginsRemoveCommand } from './remove';
import {
  runPluginsTargetsAddCommand,
  runPluginsTargetsRemoveCommand,
  runPluginsTargetsListCommand,
  type PluginsTargetsOptions,
} from './targets';
import { runPluginsUpdateCommand } from './update';
import type {
  PluginsAddOptions,
  PluginsCommandRuntime,
  PluginsInitOptions,
  PluginsListOptions,
  PluginsRemoveOptions,
  PluginsUpdateOptions,
} from './types';

type PluginsCommandOptions = PluginsAddOptions &
  PluginsInitOptions &
  PluginsListOptions &
  PluginsRemoveOptions &
  PluginsUpdateOptions &
  PluginsTargetsOptions &
  InstallCommandOptions & {
    force?: boolean;
    verbose?: boolean;
  };

/**
 * Register the `plugins` command group on the cac CLI instance.
 */
export const registerPluginsCommand = (
  cli: CAC,
  runtime: PluginsCommandRuntime
) => {
  cli
    .command('plugins [...args]', 'Manage plugins')
    .usage(
      'plugins <init|add|list|remove|outdated|update|targets> [...args] [options]'
    )
    .option('--registry <registry>', 'github, gitlab, marketplace, or file')
    .option('--ref <ref>', 'Git ref to pin')
    .option('--path <path>', 'Path to scan inside the source')
    .option('-p, --plugin <plugin>', 'Plugin name to add (repeatable)')
    .option('-a, --agent <agent>', 'Target agent (repeatable)')
    .option('--install-only', 'Install without writing ai-package.json')
    .option('-g, --global', 'Use the global ai-pkgs manifest')
    .option('--refresh', 'Refresh Git cache before installing')
    .option('--json', 'Print machine-readable JSON')
    .option('--scope <scope>', 'Install scope: user, project, local')
    .option('--uninstall', 'Also clean agent directories on remove')
    .option('--no-install', 'Skip install/uninstall when managing targets')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-C, --dir <path>', 'Project directory')
    .option('-m, --manifest <path>', 'Path to ai-package.json')
    .option('--force', 'Force overwrite on init, force remove, etc.')
    .option('--verbose', 'Show verbose install progress')
    .action((args: string[] | undefined, options: PluginsCommandOptions) =>
      runPluginsCommand(args ?? [], options, runtime)
    );
};

/**
 * Dispatch `plugins` subcommands based on the first positional arg.
 *
 * @throws {SilentError} when no subcommand or an unknown subcommand is given.
 */
export const runPluginsCommand = async (
  args: string[],
  options: PluginsCommandOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const [subcommand, ...rest] = args;

  if (subcommand === 'init') {
    return runPluginsInitCommand(rest[0], options);
  }

  if (subcommand === 'add') {
    const source = rest[0];
    if (!source) {
      throw new SilentError('Usage: ai-pkgs plugins add <source> [options]');
    }
    return runPluginsAddCommand(source, options, runtime);
  }

  if (subcommand === 'list') {
    return runPluginsListCommand(options, runtime);
  }

  if (subcommand === 'remove') {
    return runPluginsRemoveCommand(rest, options, runtime);
  }

  if (subcommand === 'outdated') {
    return runPluginsOutdatedCommand(rest, options, runtime);
  }

  if (subcommand === 'update') {
    return runPluginsUpdateCommand(rest, options, runtime);
  }

  if (subcommand === 'targets') {
    const [targetsAction, ...targetsRest] = rest;
    if (targetsAction === 'add') {
      return runPluginsTargetsAddCommand(targetsRest, options, runtime);
    }
    if (targetsAction === 'remove') {
      return runPluginsTargetsRemoveCommand(targetsRest, options, runtime);
    }
    if (targetsAction === 'list') {
      return runPluginsTargetsListCommand(targetsRest, options, runtime);
    }
    throw new SilentError(
      'Usage: ai-pkgs plugins targets <add|remove|list> <plugin> [agent...]'
    );
  }

  throw new SilentError(
    'Usage: ai-pkgs plugins <init|add|list|remove|outdated|update|targets>'
  );
};

export * from './add';
export * from './init';
export * from './list';
export * from './outdated';
export * from './remove';
export * from './targets';
export * from './update';
export type {
  PluginsAddOptions,
  PluginsCommandRuntime,
  PluginsInitOptions,
  PluginsListOptions,
  PluginsRemoveOptions,
  PluginsTargetsOptions,
  PluginsUpdateOptions,
};
