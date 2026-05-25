import type { RegistryKind } from './types';

/**
 * Detect whether a source string is a full Git clone URL (HTTPS or SSH)
 * rather than an `owner/repo` shorthand or a registry prefix.
 */
export const isFullGitCloneUrl = (source: string): boolean =>
  /^https?:\/\//.test(source) || /^git@[^:]+:.+/.test(source);

/**
 * Determine which source registry to use for a given input string.
 *
 * Resolution order:
 * 1. Local file paths (`file:`, `.`, `/`)
 * 2. Explicit GitHub (`github:` prefix or `github.com/` in URL)
 * 3. Explicit GitLab (`gitlab:` prefix or `gitlab` in URL)
 * 4. Any other full clone URL → GitLab registry (preserves arbitrary URLs)
 * 5. Bare `owner/repo` shorthand → GitHub (default)
 *
 * Non-GitHub/GitLab full clone URLs route through the GitLab registry
 * because it preserves arbitrary HTTPS and SSH origins in the manifest.
 *
 * @example
 * ```ts
 * resolveRegistry('vercel-labs/skills'); // 'github'
 * resolveRegistry('https://self-hosted.example.com/team/repo.git'); // 'gitlab'
 * ```
 */
export const resolveRegistry = (
  source: string,
  registry?: RegistryKind
): RegistryKind => {
  if (
    source.startsWith('file:') ||
    source.startsWith('.') ||
    source.startsWith('/')
  ) {
    return 'file';
  }
  if (source.startsWith('github:') || source.includes('github.com/')) {
    return 'github';
  }
  if (source.startsWith('gitlab:') || source.includes('gitlab')) {
    return 'gitlab';
  }
  if (isFullGitCloneUrl(source)) {
    return registry ?? 'gitlab';
  }
  return registry ?? 'github';
};
