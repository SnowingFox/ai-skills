import { createGitRegistry, stripGitSuffix, type ParsedGitSource } from './git';

const parseGitlabInput = (source: string): ParsedGitSource => {
  const normalized = source.replace(/^gitlab:/, '').trim();

  if (/^https?:\/\//.test(normalized)) {
    const cloneUrl = normalized.endsWith('.git')
      ? normalized
      : `${stripGitSuffix(normalized)}.git`;
    return {
      packageId: cloneUrl,
      cloneUrl,
    };
  }

  if (/^git@[^:]+:.+/.test(normalized)) {
    return {
      packageId: normalized,
      cloneUrl: normalized,
    };
  }

  const path = normalized.replace(/^\/+|\/+$/g, '');
  if (!path.includes('/')) {
    throw new Error(
      'GitLab sources must use a full URL or group/repo shorthand'
    );
  }

  const cloneUrl = `https://gitlab.com/${stripGitSuffix(path)}.git`;
  return {
    packageId: cloneUrl,
    cloneUrl,
  };
};

/**
 * GitLab-flavored Git registry. Preserves full clone URLs (including
 * self-hosted instances) as the package id since GitLab projects don't
 * have a universal shorthand like GitHub's `owner/repo`.
 */
export const gitlabRegistry = createGitRegistry({
  kind: 'gitlab',
  buildCloneUrl: (packageId) => packageId,
  parseInput: parseGitlabInput,
  toManifestSource: ({ cloneUrl }) => `gitlab:${cloneUrl}`,
});
