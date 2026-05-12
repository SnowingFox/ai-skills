import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import { SilentError } from '../errors';

/** Plugin-capable agent target. */
export type PluginTargetInfo = {
  id: 'claude-code' | 'cursor' | 'codex';
  name: string;
  binary: string;
  detected: boolean;
};

/** Vendor dir detection result for one plugin. */
export type VendorDirInfo = {
  hasAgentsPlugins: boolean;
  hasClaudePlugin: boolean;
  hasCursorPlugin: boolean;
  hasCodexPlugin: boolean;
  hasAnyContent: boolean;
};

const TARGET_DEFS: Omit<PluginTargetInfo, 'detected'>[] = [
  { id: 'claude-code', name: 'Claude Code', binary: 'claude' },
  { id: 'cursor', name: 'Cursor', binary: 'cursor' },
  { id: 'codex', name: 'Codex', binary: 'codex' },
];

/**
 * Detect which plugin-capable agents are installed by checking for their
 * CLI binaries on PATH.
 */
export const detectPluginTargets = (): PluginTargetInfo[] =>
  TARGET_DEFS.map((def) => ({
    ...def,
    detected: detectBinary(def.binary),
  }));

/**
 * Detect which vendor directories exist in a plugin source directory.
 */
export const detectPluginVendorDirs = (pluginPath: string): VendorDirInfo => ({
  hasAgentsPlugins: existsSync(
    join(pluginPath, '.agents', 'plugins', 'marketplace.json')
  ),
  hasClaudePlugin: existsSync(
    join(pluginPath, '.claude-plugin', 'plugin.json')
  ),
  hasCursorPlugin: existsSync(
    join(pluginPath, '.cursor-plugin', 'plugin.json')
  ),
  hasCodexPlugin: existsSync(join(pluginPath, '.codex-plugin', 'plugin.json')),
  hasAnyContent:
    existsSync(join(pluginPath, 'skills')) ||
    existsSync(join(pluginPath, 'commands')) ||
    existsSync(join(pluginPath, 'agents')) ||
    existsSync(join(pluginPath, 'SKILL.md')),
});

/**
 * Determine which targets are enabled for a plugin based on its vendor dirs.
 */
export const resolveEnabledTargets = (
  vendorDirs: VendorDirInfo
): Map<string, { enabled: boolean; hint: string }> => {
  const result = new Map<string, { enabled: boolean; hint: string }>();

  if (vendorDirs.hasAgentsPlugins || vendorDirs.hasAnyContent) {
    result.set('claude-code', {
      enabled: true,
      hint: vendorDirs.hasAgentsPlugins
        ? '.agents/plugins/ found'
        : vendorDirs.hasClaudePlugin
          ? '.claude-plugin/ found'
          : 'will generate vendor dir',
    });
    result.set('cursor', {
      enabled: true,
      hint: vendorDirs.hasCursorPlugin
        ? '.cursor-plugin/ found'
        : vendorDirs.hasClaudePlugin
          ? 'will translate from .claude-plugin/'
          : 'will generate vendor dir',
    });
    result.set('codex', {
      enabled: true,
      hint: vendorDirs.hasCodexPlugin
        ? '.codex-plugin/ found'
        : vendorDirs.hasAgentsPlugins
          ? '.agents/plugins/ found'
          : 'will generate vendor dir',
    });
  } else {
    result.set('claude-code', {
      enabled: vendorDirs.hasClaudePlugin,
      hint: vendorDirs.hasClaudePlugin
        ? '.claude-plugin/ found'
        : 'no .claude-plugin/ or .agents/plugins/',
    });
    result.set('cursor', {
      enabled: vendorDirs.hasCursorPlugin || vendorDirs.hasClaudePlugin,
      hint: vendorDirs.hasCursorPlugin
        ? '.cursor-plugin/ found'
        : vendorDirs.hasClaudePlugin
          ? 'will translate from .claude-plugin/'
          : 'no .cursor-plugin/ or .claude-plugin/',
    });
    result.set('codex', {
      enabled: vendorDirs.hasCodexPlugin,
      hint: vendorDirs.hasCodexPlugin
        ? '.codex-plugin/ found'
        : 'no .codex-plugin/ or .agents/plugins/',
    });
  }

  return result;
};

/**
 * Prompt the user to select plugin installation targets with vendor-dir-aware
 * enable/disable hints. Returns selected target IDs.
 */
export const selectPluginTargets = async (options: {
  pluginPath: string;
  agentFlags: string[];
  canPrompt: boolean;
  yes: boolean;
}): Promise<string[]> => {
  if (options.agentFlags.length > 0) {
    return options.agentFlags;
  }

  const vendorDirs = detectPluginVendorDirs(options.pluginPath);
  const enabledMap = resolveEnabledTargets(vendorDirs);
  const allTargets = detectPluginTargets();

  if (!options.canPrompt) {
    const detected = allTargets
      .filter((t) => t.detected && enabledMap.get(t.id)?.enabled)
      .map((t) => t.id);
    if (detected.length === 0) {
      throw new SilentError(
        'No plugin-capable agents detected. Use --agent to specify one.'
      );
    }
    return detected;
  }

  if (options.yes) {
    const detected = allTargets
      .filter((t) => t.detected && enabledMap.get(t.id)?.enabled)
      .map((t) => t.id);
    return detected.length > 0
      ? detected
      : allTargets
          .filter((t) => enabledMap.get(t.id)?.enabled)
          .map((t) => t.id);
  }

  const choices = allTargets.map((t) => {
    const info = enabledMap.get(t.id);
    const enabled = info?.enabled ?? false;
    const hint = info?.hint ?? '';
    const detectedHint = t.detected ? '' : ' (not installed)';
    return {
      label: `${t.name}${!enabled ? ' (disabled)' : ''}`,
      value: t.id,
      hint: `${hint}${detectedHint}`,
    };
  });

  const enabledIds = allTargets
    .filter((t) => enabledMap.get(t.id)?.enabled && t.detected)
    .map((t) => t.id);

  const selected = await p.multiselect({
    message: 'Target agents?',
    options: choices,
    initialValues: enabledIds,
    required: true,
  });

  if (p.isCancel(selected)) {
    throw new SilentError('Target selection cancelled');
  }

  return selected;
};

const detectBinary = (name: string): boolean => {
  try {
    execSync(`which ${name}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};
