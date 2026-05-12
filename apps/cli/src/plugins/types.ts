import type { SkillProvider } from '../types';

/** One plugin as stored in `ai-package.json` after parsing. */
export type PluginEntry = {
  name: string;
  provider: SkillProvider;
  source?: string;
  packageId: string;
  cloneUrl?: string;
  version?: string;
  ref?: string;
  commitSha?: string;
  path: string;
  targets?: string[];
  sourceRoot?: string;
};

/** A plugin entry backed by a Git remote. */
export type RemotePluginEntry = PluginEntry & {
  provider: 'github' | 'gitlab' | 'marketplace';
  version: string;
  ref: string;
  commitSha: string;
};

/** A plugin entry backed by a local filesystem path. */
export type FilePluginEntry = PluginEntry & {
  provider: 'file';
  sourceRoot: string;
};

/** Metadata about a skill discovered inside a plugin directory. */
export type PluginSkill = {
  name: string;
  description: string;
};

/** Metadata about a command discovered inside a plugin directory. */
export type PluginCommand = {
  name: string;
  description: string;
};

/** Metadata about an agent persona discovered inside a plugin directory. */
export type PluginAgent = {
  name: string;
  description: string;
};

/** Metadata about a rule discovered inside a plugin directory. */
export type PluginRule = {
  name: string;
  description: string;
};

/** A plugin directory after inspection during discovery. */
export type DiscoveredPlugin = {
  name: string;
  version?: string;
  description?: string;
  path: string;
  marketplace?: string;
  skills: PluginSkill[];
  commands: PluginCommand[];
  agents: PluginAgent[];
  rules: PluginRule[];
  hasHooks: boolean;
  hasMcp: boolean;
  hasLsp: boolean;
  manifest: Record<string, unknown> | null;
  explicitSkillPaths?: string[];
  marketplaceEntry?: Record<string, unknown>;
};

/** A plugin selected for installation. */
export type SelectedPlugin = {
  name: string;
  path: string;
  plugin: DiscoveredPlugin;
};

/** Progress event emitted during plugin install. */
export type PluginInstallProgress = {
  name: string;
  status: 'preparing' | 'staging' | 'installing' | 'skipped' | 'installed';
  detail?: string;
};
