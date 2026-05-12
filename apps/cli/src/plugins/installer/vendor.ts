import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { DiscoveredPlugin } from '../types';

const KNOWN_PLUGIN_ROOT_VARS = [
  'PLUGIN_ROOT',
  'CLAUDE_PLUGIN_ROOT',
  'CURSOR_PLUGIN_ROOT',
  'CODEX_PLUGIN_ROOT',
];

/**
 * Rewrite env-var references in hooks.json, .mcp.json, and .lsp.json
 * so that all known plugin-root variables point to the target env var
 * for the current vendor.
 *
 * @example
 * ```ts
 * await translateEnvVars('/path/to/plugin', 'my-plugin', 'CLAUDE_PLUGIN_ROOT');
 * // Any ${PLUGIN_ROOT}, ${CURSOR_PLUGIN_ROOT}, ${CODEX_PLUGIN_ROOT}
 * // references are rewritten to ${CLAUDE_PLUGIN_ROOT}.
 * ```
 */
export const translateEnvVars = async (
  pluginPath: string,
  _pluginName: string,
  envVar: string
): Promise<void> => {
  const configFiles = [
    join(pluginPath, 'hooks', 'hooks.json'),
    join(pluginPath, '.mcp.json'),
    join(pluginPath, '.lsp.json'),
  ];
  const target = `\${${envVar}}`;
  const patterns = KNOWN_PLUGIN_ROOT_VARS.filter((v) => v !== envVar).map(
    (v) => `\${${v}}`
  );

  for (const filePath of configFiles) {
    if (!existsSync(filePath)) continue;
    let content = await readFile(filePath, 'utf-8');
    let changed = false;
    for (const pattern of patterns) {
      if (content.includes(pattern)) {
        content = content.replaceAll(pattern, target);
        changed = true;
      }
    }
    if (changed) {
      await writeFile(filePath, content);
    }
  }
};

/**
 * Ensure a vendor-specific plugin directory exists with a `plugin.json`.
 * When the vendor directory is missing, generate a minimal manifest.
 *
 * After directory preparation, translates env-var references in config
 * files so they match the target vendor's variable name.
 *
 * @example
 * ```ts
 * await preparePluginDirForVendor(
 *   plugin,
 *   '.claude-plugin',
 *   'CLAUDE_PLUGIN_ROOT',
 * );
 * // plugin.path/.claude-plugin/plugin.json now exists, and
 * // hooks.json / .mcp.json / .lsp.json reference ${CLAUDE_PLUGIN_ROOT}.
 * ```
 */
export const preparePluginDirForVendor = async (
  plugin: DiscoveredPlugin,
  vendorDir: string,
  envVar: string
): Promise<void> => {
  const pluginPath = plugin.path;
  const vendorPluginDir = join(pluginPath, vendorDir);
  const hasVendorPlugin = existsSync(join(vendorPluginDir, 'plugin.json'));

  if (!hasVendorPlugin) {
    await mkdir(vendorPluginDir, { recursive: true });
    await writeFile(
      join(vendorPluginDir, 'plugin.json'),
      JSON.stringify(
        {
          name: plugin.name,
          description: plugin.description ?? '',
          version: plugin.version ?? '0.0.0',
        },
        null,
        2
      )
    );
  }

  await translateEnvVars(pluginPath, plugin.name, envVar);
};
