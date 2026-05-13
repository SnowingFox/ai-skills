import type { CAC } from 'cac';
import { SilentError } from '../../errors';
import { runWorkspaceLinkCommand } from './link';
import { runWorkspaceListCommand } from './list';
import { runWorkspacePullCommand } from './pull';
import { runWorkspacePushCommand } from './push';
import { runWorkspaceRemoveCommand } from './remove';
import { runWorkspaceStatusCommand } from './status';
import type {
  WorkspaceCommandRuntime,
  WorkspaceLinkOptions,
  WorkspaceListOptions,
  WorkspacePullOptions,
  WorkspacePushOptions,
  WorkspaceRemoveOptions,
  WorkspaceStatusOptions,
} from './types';

type WorkspaceCommandOptions = WorkspaceLinkOptions &
  WorkspaceListOptions &
  WorkspacePullOptions &
  WorkspacePushOptions &
  WorkspaceRemoveOptions &
  WorkspaceStatusOptions;

/**
 * Register the `workspace` command group on the cac CLI instance.
 * Provides the `ws` alias for shorthand invocation.
 *
 * @example
 * registerWorkspaceCommand(cli, runtime);
 * // Side effects:
 * //   adds `workspace` (alias `ws`) to the cac CLI command surface
 * //   wires --local / --message / --accept-my-change / --force / --yes /
 * //         --json / --dir / --manifest flags
 */
export const registerWorkspaceCommand = (
  cli: CAC,
  runtime: WorkspaceCommandRuntime
) => {
  cli
    .command(
      'workspace [...args]',
      'Iterate on skills locally with Git push/pull'
    )
    .alias('ws')
    .usage('workspace <link|remove|push|pull|status|list> [...args] [options]')
    .option('--local <path>', 'Local skill path on disk (link)')
    .option('-m, --message <msg>', 'Commit message (push)')
    .option('--accept-my-change', 'Force push when remote has diverged (push)')
    .option('--force', 'Skip overwrite confirmation (pull)')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--json', 'Print machine-readable output (list, status)')
    .option('-C, --dir <path>', 'Project directory')
    .option('--manifest <path>', 'Path to ai-package.json')
    .action((args: string[] | undefined, options: WorkspaceCommandOptions) =>
      runWorkspaceCommand(args ?? [], options, runtime)
    );
};

/**
 * Dispatch `workspace` subcommands (`link`, `remove`, `push`, `pull`,
 * `status`, `list`) based on the first positional arg.
 *
 * @throws {SilentError} when the subcommand is missing or unknown.
 *
 * @example
 * await runWorkspaceCommand(['list'], {}, runtime); // -> 0
 * await runWorkspaceCommand([], {}, runtime);       // -> throws SilentError("Usage: ...")
 */
export const runWorkspaceCommand = async (
  args: string[],
  options: WorkspaceCommandOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  const [subcommand, ...rest] = args;

  if (subcommand === 'link') {
    return runWorkspaceLinkCommand(rest[0], options, runtime);
  }

  if (subcommand === 'list') {
    return runWorkspaceListCommand(options, runtime);
  }

  if (subcommand === 'pull') {
    return runWorkspacePullCommand(rest[0], options, runtime);
  }

  if (subcommand === 'push') {
    return runWorkspacePushCommand(rest[0], options, runtime);
  }

  if (subcommand === 'remove') {
    return runWorkspaceRemoveCommand(rest[0], options, runtime);
  }

  if (subcommand === 'status') {
    return runWorkspaceStatusCommand(rest[0], options, runtime);
  }

  throw new SilentError(
    'Usage: ai-pkgs workspace <link|remove|push|pull|status|list>'
  );
};

export * from './git-ops';
export * from './link';
export * from './list';
export * from './pull';
export * from './push';
export * from './remove';
export * from './status';
export type {
  WorkspaceCommandRuntime,
  WorkspaceLinkOptions,
  WorkspaceListOptions,
  WorkspacePullOptions,
  WorkspacePushOptions,
  WorkspaceRemoveOptions,
  WorkspaceStatusOptions,
} from './types';
