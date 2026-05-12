import { resolveRemoteRef } from '../git';
import { materializeCachedGitSource } from '../git-cache';
import type { SkillEntry } from '../types';
import type { AddSourceInput, ResolvedPackage, SourceRegistry } from './types';

/** Parsed package identifier and clone URL from a Git source string. */
export type ParsedGitSource = {
  packageId: string;
  cloneUrl: string;
};

/**
 * Provider-specific hooks for building clone URLs, parsing user input,
 * and rendering manifest source strings. Passed to {@link createGitRegistry}
 * to build the shared Git registry boundary.
 */
export type GitProviderConfig = {
  kind: 'github' | 'gitlab';
  buildCloneUrl: (packageId: string) => string;
  parseInput: (source: string) => ParsedGitSource;
  toManifestSource: (source: ParsedGitSource) => string;
};

/**
 * Shared Git implementation for GitHub and GitLab providers.
 *
 * Provider adapters are responsible for parsing user input and rendering the
 * manifest source. This shared layer only clones, resolves the default branch
 * or requested ref, pins HEAD as `<ref>@<sha>`, and later materializes stored
 * manifest entries at their pinned commit.
 */
export const createGitRegistry = (
  config: GitProviderConfig
): SourceRegistry => ({
  kind: config.kind,
  resolve: async (input: AddSourceInput): Promise<ResolvedPackage> => {
    const parsed = config.parseInput(input.rawSource);
    input.onProgress?.({
      status: 'resolving-remote',
      cloneUrl: parsed.cloneUrl,
      ref: input.ref,
    });
    const { ref, commitSha } = await resolveRemoteRef({
      cloneUrl: parsed.cloneUrl,
      ref: input.ref,
    });
    input.onProgress?.({ status: 'resolved', ref, commitSha });
    const root = await materializeCachedGitSource({
      provider: config.kind,
      packageId: parsed.packageId,
      cloneUrl: parsed.cloneUrl,
      ref,
      commitSha,
      refresh: input.refresh,
      onProgress: input.onProgress,
    });

    return {
      provider: config.kind,
      source: config.toManifestSource(parsed),
      packageId: parsed.packageId,
      version: `${ref}@${commitSha}`,
      ref,
      commitSha,
      root,
    };
  },
  materialize: async (entry: SkillEntry, options) => {
    if (!entry.ref || !entry.commitSha) {
      throw new Error(`Skill "${entry.name}" is missing a pinned git version`);
    }

    const parsed = config.parseInput(entry.cloneUrl ?? entry.packageId);
    return materializeCachedGitSource({
      provider: config.kind,
      packageId: entry.packageId,
      cloneUrl: parsed.cloneUrl,
      ref: entry.ref,
      commitSha: entry.commitSha,
      refresh: options?.refresh,
      onProgress: options?.onProgress,
    });
  },
  update: async (entry: SkillEntry) => {
    if (!entry.ref) {
      throw new Error(`Skill "${entry.name}" is missing an update ref`);
    }

    return createGitRegistry(config).resolve({
      rawSource: entry.packageId,
      registry: config.kind,
      ref: entry.ref,
      refresh: true,
    });
  },
});

/** Remove a trailing `.git` suffix from a URL or path segment. */
export const stripGitSuffix = (value: string): string =>
  value.replace(/\.git$/, '');
