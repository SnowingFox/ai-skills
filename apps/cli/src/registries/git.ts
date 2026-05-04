import { cloneRepository, resolveDefaultBranch, resolveHeadSha } from '../git';
import type { SkillEntry } from '../types';
import type { AddSourceInput, ResolvedPackage, SourceRegistry } from './types';

export type ParsedGitSource = {
  packageId: string;
  cloneUrl: string;
};

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
    const cloned = await cloneRepository({
      cloneUrl: parsed.cloneUrl,
      ref: input.ref,
    });

    const ref = input.ref ?? (await resolveDefaultBranch(cloned.rootDir));
    const commitSha = await resolveHeadSha(cloned.rootDir);

    return {
      provider: config.kind,
      source: config.toManifestSource(parsed),
      packageId: parsed.packageId,
      version: `${ref}@${commitSha}`,
      ref,
      commitSha,
      root: cloned,
    };
  },
  materialize: async (entry: SkillEntry) => {
    if (!entry.ref || !entry.commitSha) {
      throw new Error(`Skill "${entry.name}" is missing a pinned git version`);
    }

    return cloneRepository({
      cloneUrl: config.parseInput(entry.packageId).cloneUrl,
      ref: entry.ref,
      commitSha: entry.commitSha,
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
    });
  },
});

export const stripGitSuffix = (value: string): string =>
  value.replace(/\.git$/, '');
