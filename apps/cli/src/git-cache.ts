import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { cloneRepository } from './git';
import type { GitProgressEvent } from './git';
import type { MaterializedSource } from './types';

export type GitCacheProvider = 'github' | 'gitlab';

export type GitCacheRequest = {
  provider: GitCacheProvider;
  packageId: string;
  cloneUrl: string;
  ref: string;
  commitSha: string;
  refresh?: boolean;
  onProgress?: (event: GitProgressEvent) => void;
};

export type ClearGitCacheOptions = {
  provider?: GitCacheProvider;
  source?: string;
};

type GitCacheMetadata = {
  provider: GitCacheProvider;
  packageId: string;
  cloneUrl: string;
  ref: string;
  commitSha: string;
};

const METADATA_FILE = '.ai-pkgs-cache.json';

/**
 * Resolve the global ai-pkgs Git cache directory.
 *
 * `AI_PKGS_CACHE_HOME` exists for tests and local smoke runs; normal users
 * follow XDG cache conventions and then fall back to `~/.cache`.
 *
 * @example
 * ```ts
 * process.env.AI_PKGS_CACHE_HOME = '/tmp/cache';
 * getGitCacheRoot(); // '/tmp/cache/ai-pkgs/git'
 * ```
 */
export const getGitCacheRoot = (): string => {
  const cacheHome =
    process.env.AI_PKGS_CACHE_HOME ||
    process.env.XDG_CACHE_HOME ||
    join(homedir(), '.cache');
  return join(cacheHome, 'ai-pkgs/git');
};

/**
 * Convert a package source into a stable path segment for cache storage.
 *
 * @example
 * ```ts
 * gitCacheSourceKey('vercel-labs/skills'); // 'vercel-labs/skills'
 * gitCacheSourceKey('https://github.com/acme/skills.git');
 * // 'github.com/acme/skills'
 * ```
 */
export const gitCacheSourceKey = (source: string): string =>
  source
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/[:/\\]+/g, '/')
    .replace(/\.git$/, '')
    .replace(/[^a-zA-Z0-9._/-]+/g, '-')
    .replace(/^\/+|\/+$/g, '') || 'unknown-source';

/**
 * Build the cache path for one provider/source/commit tuple.
 *
 * Cache identity is commit-based: two refs that resolve to the same SHA share
 * one checkout, while a branch moving to a new SHA gets a new cache entry.
 *
 * @example
 * ```ts
 * getGitCachePath({
 *   provider: 'github',
 *   packageId: 'acme/skills',
 *   commitSha: 'abc123',
 * });
 * // '<cache>/ai-pkgs/git/github/acme/skills/abc123'
 * ```
 */
export const getGitCachePath = ({
  provider,
  packageId,
  commitSha,
}: Pick<GitCacheRequest, 'provider' | 'packageId' | 'commitSha'>): string =>
  join(getGitCacheRoot(), provider, gitCacheSourceKey(packageId), commitSha);

/**
 * Materialize a Git source from the global cache or clone and store it.
 *
 * On a hit, the returned `rootDir` points at the cached checkout and has no
 * cleanup callback. On a miss or refresh, a temporary clone is copied into the
 * cache and then removed, leaving only the stable cache directory.
 *
 * @example
 * ```ts
 * const source = await materializeCachedGitSource({
 *   provider: 'github',
 *   packageId: 'acme/skills',
 *   cloneUrl: 'https://github.com/acme/skills.git',
 *   ref: 'main',
 *   commitSha: 'abc123...',
 * });
 * // returns: { rootDir: '<cache>/github/acme/skills/abc123...' }
 * //
 * // Side effects:
 * //   <cache>/github/acme/skills/abc123.../      <- checked-out repository
 * //   <cache>/github/acme/skills/abc123.../.ai-pkgs-cache.json
 * ```
 */
export const materializeCachedGitSource = async (
  request: GitCacheRequest
): Promise<MaterializedSource> => {
  const cachePath = getGitCachePath(request);
  if (existsSync(cachePath) && request.refresh !== true) {
    request.onProgress?.({
      status: 'cache-hit',
      provider: request.provider,
      packageId: request.packageId,
      ref: request.ref,
      commitSha: request.commitSha,
      cachePath,
    });
    return { rootDir: cachePath };
  }

  if (request.refresh === true && existsSync(cachePath)) {
    request.onProgress?.({
      status: 'cache-refresh',
      provider: request.provider,
      packageId: request.packageId,
      ref: request.ref,
      commitSha: request.commitSha,
      cachePath,
    });
    await rm(cachePath, { force: true, recursive: true });
  }

  const cloned = await cloneRepository({
    cloneUrl: request.cloneUrl,
    ref: request.ref,
    commitSha: request.commitSha,
    onProgress: request.onProgress,
  });

  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await rm(cachePath, { force: true, recursive: true });
    await cp(cloned.rootDir, cachePath, { recursive: true });
    await writeFile(
      join(cachePath, METADATA_FILE),
      JSON.stringify(
        {
          provider: request.provider,
          packageId: request.packageId,
          cloneUrl: request.cloneUrl,
          ref: request.ref,
          commitSha: request.commitSha,
        } satisfies GitCacheMetadata,
        null,
        2
      )
    );
    request.onProgress?.({
      status: 'cache-store',
      provider: request.provider,
      packageId: request.packageId,
      ref: request.ref,
      commitSha: request.commitSha,
      cachePath,
    });
    return { rootDir: cachePath };
  } finally {
    await cloned.cleanup?.();
  }
};

/**
 * Clear cached Git checkouts, optionally scoped by provider and source.
 *
 * The return value is the number of provider/source roots removed, not the
 * number of commit directories beneath each source.
 *
 * @example
 * ```ts
 * await clearGitCache({ provider: 'github', source: 'acme/skills' });
 * // removes: '<cache>/github/acme/skills'
 * ```
 */
export const clearGitCache = async ({
  provider,
  source,
}: ClearGitCacheOptions): Promise<number> => {
  const root = getGitCacheRoot();
  if (!existsSync(root)) {
    return 0;
  }

  const providers = provider ? [provider] : await listDirectories(root);
  let removed = 0;
  for (const providerName of providers) {
    if (!isGitCacheProvider(providerName)) {
      continue;
    }

    const providerRoot = join(root, providerName);
    if (!source) {
      if (existsSync(providerRoot)) {
        await rm(providerRoot, { force: true, recursive: true });
        removed += 1;
      }
      continue;
    }

    removed += await removeMatchingSources(providerRoot, source);
  }

  return removed;
};

const removeMatchingSources = async (
  providerRoot: string,
  source: string
): Promise<number> => {
  if (!existsSync(providerRoot)) {
    return 0;
  }

  const normalized = gitCacheSourceKey(source);
  const directPath = join(providerRoot, normalized);
  if (existsSync(directPath)) {
    await rm(directPath, { force: true, recursive: true });
    return 1;
  }

  const matches = await findSourceRoots(providerRoot, source);
  await Promise.all(
    matches.map((match) => rm(match, { force: true, recursive: true }))
  );
  return matches.length;
};

const findSourceRoots = async (
  providerRoot: string,
  source: string
): Promise<string[]> => {
  const matches: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    const metadataPath = join(dir, METADATA_FILE);
    if (existsSync(metadataPath)) {
      const metadata = await readMetadata(metadataPath);
      if (
        metadata &&
        (metadata.packageId === source || metadata.cloneUrl === source)
      ) {
        matches.push(dirname(dir));
      }
      return;
    }

    for (const child of await listDirectories(dir)) {
      await visit(join(dir, child));
    }
  };

  await visit(providerRoot);
  return [...new Set(matches)];
};

const readMetadata = async (
  path: string
): Promise<GitCacheMetadata | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as GitCacheMetadata;
  } catch {
    return undefined;
  }
};

const listDirectories = async (dir: string): Promise<string[]> => {
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

/**
 * Narrow user-provided provider filters to the Git-backed cache providers.
 */
export const isGitCacheProvider = (value: string): value is GitCacheProvider =>
  value === 'github' || value === 'gitlab';
