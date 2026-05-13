import { existsSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { deriveMarketplaceName } from './claude';

/**
 * Remove a Claude Code plugin from the cache, `installed_plugins.json`,
 * and `settings.json` `enabledPlugins`.
 *
 * When `projectDir` is provided the settings cleanup targets the
 * project-scoped `.claude/settings.json`; otherwise the global one.
 */
export const uninstallFromClaude = async (
  pluginName: string,
  marketplaceName: string,
  projectDir?: string
): Promise<void> => {
  const home = homedir();
  const pluginsDir = join(home, '.claude', 'plugins');
  const cacheDir = join(pluginsDir, 'cache', marketplaceName, pluginName);

  if (existsSync(cacheDir)) {
    await rm(cacheDir, { recursive: true });
  }

  const installedPath = join(pluginsDir, 'installed_plugins.json');
  if (existsSync(installedPath)) {
    try {
      const data = JSON.parse(await readFile(installedPath, 'utf-8'));
      const pluginKey = `${pluginName}@${marketplaceName}`;
      if (data.plugins?.[pluginKey]) {
        delete data.plugins[pluginKey];
        await writeFile(installedPath, JSON.stringify(data, null, 2));
      }
    } catch {
      // corrupted file – skip
    }
  }

  const settingsPath = projectDir
    ? join(projectDir, '.claude', 'settings.json')
    : join(home, '.claude', 'settings.json');

  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      const enabled = settings.enabledPlugins as
        | Record<string, boolean>
        | undefined;
      if (enabled) {
        const pluginKey = `${pluginName}@${marketplaceName}`;
        delete enabled[pluginKey];
        await writeFile(settingsPath, JSON.stringify(settings, null, 2));
      }
    } catch {
      // corrupted file – skip
    }
  }
};

/**
 * Remove a Cursor plugin. On Windows, cleans `~/.cursor/extensions/` and
 * `extensions.json`. On other platforms, delegates to Claude cache cleanup
 * since Cursor shares it.
 */
export const uninstallFromCursor = async (
  pluginName: string,
  marketplaceName: string
): Promise<void> => {
  if (process.platform === 'win32') {
    const home = homedir();
    const extensionsDir = join(home, '.cursor', 'extensions');
    const extensionsJsonPath = join(extensionsDir, 'extensions.json');

    if (existsSync(extensionsJsonPath)) {
      try {
        const parsed = JSON.parse(await readFile(extensionsJsonPath, 'utf-8'));
        if (Array.isArray(parsed)) {
          const identifier = `${marketplaceName}.${pluginName}`;
          const filtered = parsed.filter(
            (e: Record<string, unknown>) =>
              (e?.identifier as Record<string, unknown> | undefined)?.id !==
              identifier
          );
          await writeFile(
            extensionsJsonPath,
            JSON.stringify(filtered, null, 2)
          );

          const folderPrefix = `${marketplaceName}.${pluginName}-`;
          const { readdirSync } = await import('node:fs');
          for (const entry of readdirSync(extensionsDir)) {
            if (entry.startsWith(folderPrefix)) {
              await rm(join(extensionsDir, entry), { recursive: true });
            }
          }
        }
      } catch {
        // corrupted file – skip
      }
    }
    return;
  }

  // On macOS/Linux, Cursor shares the Claude plugin cache so uninstalling
  // a Cursor plugin also removes it from ~/.claude/settings.json.
  await uninstallFromClaude(pluginName, marketplaceName);
};

/**
 * Remove a Codex plugin from its cache, `config.toml`, and the global
 * `~/.agents/plugins/marketplace.json`.
 */
export const uninstallFromCodex = async (
  pluginName: string,
  marketplaceName: string
): Promise<void> => {
  const home = homedir();
  const cacheDir = join(
    home,
    '.codex',
    'plugins',
    'cache',
    marketplaceName,
    pluginName
  );

  if (existsSync(cacheDir)) {
    await rm(cacheDir, { recursive: true });
  }

  const configPath = join(home, '.codex', 'config.toml');
  if (existsSync(configPath)) {
    try {
      const content = await readFile(configPath, 'utf-8');
      const pluginKey = `${pluginName}@plugins-cli`;
      const sectionRegex = new RegExp(
        `\\n?\\[plugins\\."${escapeRegex(pluginKey)}"\\]\\nenabled = (?:true|false)\\n?`,
        'g'
      );
      const updated = content.replace(sectionRegex, '\n');
      if (updated !== content) {
        await writeFile(configPath, updated.replace(/^\n+/, ''));
      }
    } catch {
      // corrupted file – skip
    }
  }

  const marketplacePath = join(home, '.agents', 'plugins', 'marketplace.json');
  if (existsSync(marketplacePath)) {
    try {
      const data = JSON.parse(await readFile(marketplacePath, 'utf-8'));
      if (Array.isArray(data.plugins)) {
        data.plugins = data.plugins.filter(
          (e: Record<string, unknown>) => e.name !== pluginName
        );
        await writeFile(marketplacePath, JSON.stringify(data, null, 2));
      }
    } catch {
      // corrupted file – skip
    }
  }
};

/**
 * Uninstall a plugin from one target agent. Derives the marketplace name
 * from the source string.
 */
export const uninstallPlugins = async (
  pluginName: string,
  source: string,
  target: string,
  projectDir?: string
): Promise<void> => {
  const marketplaceName = deriveMarketplaceName(source);

  switch (target) {
    case 'claude-code':
      await uninstallFromClaude(pluginName, marketplaceName, projectDir);
      break;
    case 'cursor':
      await uninstallFromCursor(pluginName, marketplaceName);
      break;
    case 'codex':
      await uninstallFromCodex(pluginName, marketplaceName);
      break;
    default:
      throw new Error(`Unsupported uninstall target: ${target}`);
  }
};

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
