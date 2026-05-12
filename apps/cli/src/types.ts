import type { PluginEntry } from './plugins/types';

/** Git-backed remote providers that support ref resolution and caching. */
export type RemoteProvider = 'github' | 'gitlab' | 'marketplace';

/** All source providers including local file paths. */
export type SkillProvider = RemoteProvider | 'file';

/** How skill directories are materialized into agent target directories. */
export type InstallMode = 'copy' | 'link';

/**
 * Behavior when an install target directory already exists.
 *
 * - `prompt` — ask the user interactively (requires TTY)
 * - `overwrite` — replace the existing directory (`--force`)
 * - `skip` — leave the existing directory untouched (`--skip-existing`)
 * - `fail` — throw immediately (non-interactive default)
 */
export type ConflictPolicy = 'prompt' | 'overwrite' | 'skip' | 'fail';

/**
 * One skill as stored in `ai-package.json` after parsing. Runtime-only fields
 * like `sourceRoot` and `cloneUrl` are populated during materialization but
 * never serialized back to disk.
 */
export type SkillEntry = {
  name: string;
  provider: SkillProvider;
  source?: string;
  packageId: string;
  cloneUrl?: string;
  version?: string;
  ref?: string;
  commitSha?: string;
  path: string;
  sourceRoot?: string;
};

/**
 * A skill entry backed by a Git remote (GitHub or GitLab). Always carries a
 * pinned `version` string in `<ref>@<commitSha>` format.
 */
export type RemoteSkillEntry = SkillEntry & {
  provider: RemoteProvider;
  version: string;
  ref: string;
  commitSha: string;
};

/** A skill entry backed by a local filesystem path. */
export type FileSkillEntry = SkillEntry & {
  provider: 'file';
  sourceRoot: string;
};

/** Top-level `ai-package.json` document after parsing. */
export type AiPackageManifest = {
  skills: SkillEntry[];
  plugins: PluginEntry[];
};

/**
 * A source that has been resolved to a local directory. The optional `cleanup`
 * callback removes temporary directories (e.g. temp clones) when the caller
 * is done reading from `rootDir`.
 */
export type MaterializedSource = {
  rootDir: string;
  cleanup?: () => Promise<void>;
};

/** Inputs for cloning a Git-backed remote source at a pinned commit. */
export type CloneRequest = {
  provider: Exclude<RemoteProvider, 'marketplace'>;
  packageId: string;
  cloneUrl: string;
  ref: string;
  commitSha: string;
};

/** Clone result: either a bare directory path or a materialized source with cleanup. */
export type ClonedSource = string | MaterializedSource;

/** Injectable clone strategy used by install to allow test doubles. */
export type CloneSource = (request: CloneRequest) => Promise<ClonedSource>;

/** A resolved agent install destination with its skills directory. */
export type AgentTarget = {
  agentId: string;
  displayName: string;
  skillsDir: string;
};

/** A skill selected for installation (name + resolved source directory). */
export type SelectedSkill = {
  name: string;
  sourceDir: string;
};

/** Result row for one skill after install completes. */
export type InstalledSkill = {
  name: string;
  targetDir: string;
  skipped?: boolean;
};

/** Progress event emitted during install for UI/logging. */
export type InstallProgress = {
  name: string;
  status:
    | 'resolving'
    | 'cloning'
    | 'discovering'
    | 'copying'
    | 'linking'
    | 'skipped'
    | 'installed';
  detail?: string;
};
