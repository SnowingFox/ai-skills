export interface ParsedRepository {
  owner: string;
  repo: string;
}

/**
 * Extract `{ owner, repo }` from a Git repository URL. Returns `null` for
 * inputs we cannot confidently map onto the `/skills/[owner]/[repo]` /
 * `/plugins/[owner]/[name]` URL shapes (non-GitHub hosts, malformed strings).
 *
 * @example
 *   parseRepositoryUrl('https://github.com/Foo/Bar')          // { owner: 'Foo', repo: 'Bar' }
 *   parseRepositoryUrl('https://github.com/Foo/Bar.git')      // { owner: 'Foo', repo: 'Bar' }
 *   parseRepositoryUrl('https://github.com/Foo/Bar/tree/x')   // { owner: 'Foo', repo: 'Bar' }
 *   parseRepositoryUrl('git@github.com:Foo/Bar.git')          // { owner: 'Foo', repo: 'Bar' }
 *   parseRepositoryUrl('https://gitlab.com/Foo/Bar')          // null
 *   parseRepositoryUrl('')                                    // null
 */
export function parseRepositoryUrl(
  url: string | null | undefined
): ParsedRepository | null {
  if (!url) return null;

  const segments = extractPathSegments(url);
  if (!segments) return null;
  const [owner, repoRaw] = segments;
  if (!owner || !repoRaw) return null;
  const repo = repoRaw.replace(/\.git$/i, '');
  if (!repo) return null;
  return { owner, repo };
}

function extractPathSegments(url: string): [string, string] | null {
  // HTTPS / HTTP shape — use URL parser so query strings and deeper paths are
  // handled cleanly.
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return [parts[0], parts[1]];
    } catch {
      return null;
    }
  }
  // SSH shape `git@host:owner/repo[.git]`
  const sshMatch = url.match(/^git@[^:]+:([^/]+)\/([^/]+)$/);
  if (sshMatch) {
    return [sshMatch[1], sshMatch[2]];
  }
  return null;
}
