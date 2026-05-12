import type { DiscoveredPlugin, PluginInstallProgress } from '../types';

/** Target agent for plugin installation. */
export type PluginTarget = {
  id: 'claude-code' | 'cursor' | 'codex';
  name: string;
  detected: boolean;
  configPath: string;
};

/** Full plugin installation plan. */
export type PluginInstallPlan = {
  plugins: DiscoveredPlugin[];
  targets: PluginTarget[];
  scope: string;
  source: string;
  repoPath: string;
  onProgress?: (event: PluginInstallProgress) => void;
};

/** Result of a plugin installation. */
export type PluginInstallResult = {
  installed: { name: string; target: string; cachePath: string }[];
};
