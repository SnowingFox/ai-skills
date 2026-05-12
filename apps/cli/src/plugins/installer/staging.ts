import { join, relative } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { cp, mkdir, rm } from 'node:fs/promises';
import type { DiscoveredPlugin } from '../types';

/**
 * Stage plugin files into a temporary workspace to avoid mutating the
 * original source during vendor preparation and env-var translation.
 *
 * Copies the entire repo to a deterministic staging directory keyed by
 * a SHA-1 hash of `repoPath` and the target id. Returns updated repo
 * path and plugin references pointing into the staged copy.
 *
 * @example
 * ```ts
 * const { repoPath, plugins } = await stageInstallWorkspace(
 *   discoveredPlugins,
 *   '/tmp/cloned-repo',
 *   'claude-code',
 * );
 * // repoPath → ~/.cache/plugins/.install-staging/<hash>/claude-code/repo
 * // Each plugin.path is remapped into the staged repo.
 * ```
 */
export const stageInstallWorkspace = async (
  plugins: DiscoveredPlugin[],
  repoPath: string,
  targetId: string,
  stagingBaseDir: string = join(
    homedir(),
    '.cache',
    'plugins',
    '.install-staging'
  )
): Promise<{ repoPath: string; plugins: DiscoveredPlugin[] }> => {
  const stageKey = createHash('sha1').update(repoPath).digest('hex');
  const stageRoot = join(stagingBaseDir, stageKey, targetId);
  const stagedRepoPath = join(stageRoot, 'repo');

  await mkdir(stageRoot, { recursive: true });
  await rm(stagedRepoPath, { recursive: true, force: true });
  await cp(repoPath, stagedRepoPath, { recursive: true });

  const stagedPlugins = plugins.map((plugin) => {
    const relPath = relative(repoPath, plugin.path);
    return {
      ...plugin,
      path: relPath === '' ? stagedRepoPath : join(stagedRepoPath, relPath),
    };
  });

  return { repoPath: stagedRepoPath, plugins: stagedPlugins };
};
