import type { WorkspaceSkillEntry } from '../../types';

/**
 * Derive a clone URL for a workspace skill from its source locator.
 *
 * Honors an explicit `cloneUrl` override first, then maps:
 * - `github:owner/repo` -> `https://github.com/owner/repo.git`
 * - `gitlab:<url>` -> the raw `<url>` (must already be a full URL)
 *
 * @example
 * resolveCloneUrl({ source: 'github:owner/repo', ... }); // 'https://github.com/owner/repo.git'
 */
export const resolveCloneUrl = (entry: WorkspaceSkillEntry): string => {
  if (entry.cloneUrl) return entry.cloneUrl;
  if (entry.provider === 'github') {
    return `https://github.com/${entry.packageId.replace(/\.git$/, '')}.git`;
  }
  return entry.packageId;
};

/**
 * Default commit message used by `workspace push` when no `--message` is
 * provided in `--ai` mode or accepted as the prompt default in TTY.
 */
export const defaultCommitMessage = (skillName: string): string =>
  `chore: update ${skillName}`;

/**
 * Build an updated workspace entry with a fresh commit SHA, keeping the
 * locked branch portion of `version` intact.
 *
 * @example
 * computeNewVersion(entry, 'abc123...');
 * // { ...entry, version: 'main@abc123...', commitSha: 'abc123...' }
 */
export const computeNewVersion = (
  entry: WorkspaceSkillEntry,
  newSha: string
): WorkspaceSkillEntry => ({
  ...entry,
  version: `${entry.ref}@${newSha}`,
  commitSha: newSha,
});

/**
 * Classify Git stderr output as a push rejection caused by remote
 * divergence (vs. auth failures, network errors, etc.).
 *
 * @example
 * isPushRejected('! [rejected] main -> main (non-fast-forward)'); // true
 * isPushRejected('Authentication failed');                         // false
 */
export const isPushRejected = (stderr: string): boolean => {
  if (!stderr) return false;
  const normalized = stderr.toLowerCase();
  return (
    normalized.includes('[rejected]') ||
    normalized.includes('non-fast-forward') ||
    normalized.includes('updates were rejected') ||
    normalized.includes('failed to push some refs')
  );
};
