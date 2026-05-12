import type { DiscoveredPlugin } from '../types';
import type { PluginTarget } from './types';
import {
  getOfficialPluginRef,
  installToClaudeCode,
  installViaClaudeCli,
} from './claude';
import { installToCursor } from './cursor';
import { installToCodex } from './codex';
import { stageInstallWorkspace } from './staging';

/**
 * Install plugins to the specified target agent. Dispatches to
 * per-target strategies after staging files into a temporary workspace
 * so the original source is never mutated.
 *
 * For Claude Code, attempts the official CLI first and falls back to
 * direct file-based installation. Cursor reuses the Claude plugin
 * cache on non-Windows (or writes to `~/.cursor/extensions/` on
 * Windows). Codex gets its own vendor directory and cache layout.
 *
 * @example
 * ```ts
 * await installPlugins(plugins, target, 'user', '/tmp/repo', 'owner/repo');
 * ```
 */
export const installPlugins = async (
  plugins: DiscoveredPlugin[],
  target: PluginTarget,
  scope: string,
  repoPath: string,
  source: string,
  projectDir?: string
): Promise<void> => {
  switch (target.id) {
    case 'claude-code': {
      const officialRef = getOfficialPluginRef(source);
      if (officialRef) {
        const ok = await installViaClaudeCli(officialRef, scope);
        if (ok) return;
      }
      const workspace = await stageInstallWorkspace(
        plugins,
        repoPath,
        target.id
      );
      await installToClaudeCode(
        workspace.plugins,
        scope,
        workspace.repoPath,
        source,
        projectDir
      );
      break;
    }
    case 'cursor': {
      const workspace = await stageInstallWorkspace(
        plugins,
        repoPath,
        target.id
      );
      await installToCursor(
        workspace.plugins,
        scope,
        workspace.repoPath,
        source
      );
      break;
    }
    case 'codex': {
      const workspace = await stageInstallWorkspace(
        plugins,
        repoPath,
        target.id
      );
      await installToCodex(
        workspace.plugins,
        scope,
        workspace.repoPath,
        source
      );
      break;
    }
    default:
      throw new Error(`Unsupported plugin target: ${target.id}`);
  }
};
