import { createGitRegistry, stripGitSuffix, type ParsedGitSource } from './git';

const parseGithubInput = (source: string): ParsedGitSource => {
  const normalized = source.replace(/^github:/, '').trim();
  const urlMatch = normalized.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/#]+)(?:\/tree\/([^/]+)(?:\/.*)?)?/
  );
  if (urlMatch) {
    const owner = urlMatch[1];
    const repo = stripGitSuffix(urlMatch[2] ?? '');
    return {
      packageId: `${owner}/${repo}`,
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
    };
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error('GitHub sources must use owner/repo');
  }

  const packageId = `${segments[0]}/${stripGitSuffix(segments[1] ?? '')}`;
  return {
    packageId,
    cloneUrl: `https://github.com/${packageId}.git`,
  };
};

/**
 * GitHub-flavored Git registry. Parses `github:owner/repo` shorthand and
 * full `https://github.com/owner/repo` URLs into `owner/repo` package ids.
 */
export const githubRegistry = createGitRegistry({
  kind: 'github',
  buildCloneUrl: (packageId) => `https://github.com/${packageId}.git`,
  parseInput: parseGithubInput,
  toManifestSource: ({ packageId }) => `github:${packageId}`,
});
