import type { CAC } from 'cac';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  clearGitCache,
  getGitCacheRoot,
  isGitCacheProvider,
  type GitCacheProvider,
} from '../git-cache';
import { SilentError } from '../errors';

type CacheCommandOptions = {
  provider?: string;
  source?: string;
};

/**
 * Register cache maintenance commands.
 *
 * The cache command is intentionally top-level instead of nested under
 * `skills`: the cache is shared by both `skills add` and manifest restore.
 *
 * @example
 * ```ts
 * registerCacheCommand(cli);
 * // adds: ai-pkgs cache clear --provider github --source acme/skills
 * ```
 */
export const registerCacheCommand = (cli: CAC) => {
  cli
    .command('cache [...args]', 'Manage ai-pkgs cache')
    .usage('cache <clear> [options]')
    .option('--provider <provider>', 'Filter cache by provider')
    .option('--source <source>', 'Filter cache by package source')
    .action((args: string[] | undefined, options: CacheCommandOptions) =>
      runCacheCommand(args ?? [], options)
    );
};

/**
 * Execute `ai-pkgs cache clear`.
 *
 * @example
 * ```ts
 * await runCacheCommand(['clear'], {
 *   provider: 'github',
 *   source: 'acme/skills',
 * });
 * // clears only GitHub cache entries for acme/skills and prints the cache root
 * ```
 */
export const runCacheCommand = async (
  args: string[],
  options: CacheCommandOptions
): Promise<number> => {
  const [subcommand] = args;
  if (subcommand !== 'clear') {
    throw new SilentError('Usage: ai-pkgs cache clear [options]');
  }

  const provider = resolveCacheProvider(options.provider);
  const removed = await clearGitCache({
    provider,
    source: options.source,
  });
  p.log.success(
    `Cleared ${removed} Git cache entr${removed === 1 ? 'y' : 'ies'}`
  );
  p.log.info(`${pc.dim('Cache root:')} ${getGitCacheRoot()}`);
  return 0;
};

const resolveCacheProvider = (
  provider: string | undefined
): GitCacheProvider | undefined => {
  if (!provider) {
    return undefined;
  }
  if (!isGitCacheProvider(provider)) {
    throw new SilentError('--provider must be one of: github, gitlab');
  }
  return provider;
};
