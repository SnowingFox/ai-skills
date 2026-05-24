import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { DiscoveredPlugin } from '../types';
import { deriveMarketplaceName, prepareForClaudeCode } from './claude';
import { preparePluginDirForVendor } from './vendor';

/**
 * Install plugins into the Cursor extensions directory on Windows.
 * Creates per-plugin folders under `~/.cursor/extensions/` and updates
 * `extensions.json` with identifier, version, location, and metadata.
 */
export const installToCursorExtensions = async (
  plugins: DiscoveredPlugin[],
  _scope: string,
  repoPath: string,
  source: string
): Promise<void> => {
  const marketplaceName =
    plugins[0]?.marketplace ?? deriveMarketplaceName(source);
  const home = homedir();
  const extensionsDir = join(home, '.cursor', 'extensions');

  await prepareForClaudeCode(plugins, repoPath, marketplaceName);
  await mkdir(extensionsDir, { recursive: true });

  const extensionsJsonPath = join(extensionsDir, 'extensions.json');
  let extensions: Record<string, unknown>[] = [];
  if (existsSync(extensionsJsonPath)) {
    try {
      const parsed = JSON.parse(await readFile(extensionsJsonPath, 'utf-8'));
      if (Array.isArray(parsed)) extensions = parsed;
    } catch {
      // corrupted – start fresh
    }
  }

  let gitSha: string | undefined;
  try {
    gitSha = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
  } catch {
    // not a git repo or git unavailable
  }

  for (const plugin of plugins) {
    const version = plugin.version ?? '0.0.0';
    const versionKey = gitSha ? gitSha.slice(0, 12) : version;
    const folderName = `${marketplaceName}.${plugin.name}-${versionKey}`;
    const destDir = join(extensionsDir, folderName);

    await mkdir(destDir, { recursive: true });
    await cp(plugin.path, destDir, { recursive: true });

    const identifier = `${marketplaceName}.${plugin.name}`;
    extensions = extensions.filter(
      (e) =>
        (e?.identifier as Record<string, unknown> | undefined)?.id !==
        identifier
    );

    const uriPath = `/${destDir.replace(/\\/g, '/')}`;
    extensions.push({
      identifier: { id: identifier },
      version,
      location: { $mid: 1, path: uriPath, scheme: 'file' },
      relativeLocation: folderName,
      metadata: {
        installedTimestamp: Date.now(),
        ...(gitSha ? { gitCommitSha: gitSha } : {}),
      },
    });
  }

  await writeFile(extensionsJsonPath, JSON.stringify(extensions, null, 2));
};

/**
 * Install plugins for Cursor.
 *
 * On non-Windows platforms, Cursor reuses the Claude plugin cache so
 * we delegate to {@link installToPluginCache}. On Windows, we use
 * {@link installToCursorExtensions} to write into
 * `~/.cursor/extensions/`.
 *
 * @param cachePopulated - When `true` (e.g. the Claude CLI already
 *   populated the cache), skip installation entirely.
 */
export const installToCursor = async (
  plugins: DiscoveredPlugin[],
  scope: string,
  repoPath: string,
  source: string,
  cachePopulated = false,
  projectDir?: string
): Promise<void> => {
  if (cachePopulated) return;

  if (process.platform === 'win32') {
    await installToCursorExtensions(plugins, scope, repoPath, source);
    return;
  }

  await installToCursorLocalPlugins(plugins);
  if (projectDir) {
    await enableCursorPluginsForProject(plugins, projectDir);
  }
};

/**
 * Install plugins into Cursor's documented local plugin directory.
 *
 * @example
 * ```ts
 * await installToCursorLocalPlugins([plugin]);
 * // ~/.cursor/plugins/local/<plugin> now contains .cursor-plugin/plugin.json
 * // and the plugin assets copied from the staged install workspace.
 * ```
 */
export const installToCursorLocalPlugins = async (
  plugins: DiscoveredPlugin[]
): Promise<void> => {
  const localDir = join(homedir(), '.cursor', 'plugins', 'local');

  for (const plugin of plugins) {
    await preparePluginDirForVendor(
      plugin,
      '.cursor-plugin',
      'CURSOR_PLUGIN_ROOT'
    );
    const destDir = join(localDir, plugin.name);
    await rm(destDir, { recursive: true, force: true });
    await mkdir(localDir, { recursive: true });
    await cp(plugin.path, destDir, { recursive: true });
  }
};

/**
 * Enable project-scoped Cursor plugins in `.cursor/settings.json`.
 *
 * Existing settings are preserved and `plugins.<name>.enabled` is merged.
 */
export const enableCursorPluginsForProject = async (
  plugins: DiscoveredPlugin[],
  projectDir: string
): Promise<void> => {
  const settingsPath = join(projectDir, '.cursor', 'settings.json');
  let settings: Record<string, unknown> = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
    } catch {
      return;
    }
  }

  const pluginSettings =
    settings.plugins && typeof settings.plugins === 'object'
      ? (settings.plugins as Record<string, unknown>)
      : {};

  for (const plugin of plugins) {
    const current =
      pluginSettings[plugin.name] &&
      typeof pluginSettings[plugin.name] === 'object'
        ? (pluginSettings[plugin.name] as Record<string, unknown>)
        : {};
    pluginSettings[plugin.name] = { ...current, enabled: true };
  }

  settings.plugins = pluginSettings;
  await mkdir(join(settingsPath, '..'), { recursive: true });
  await writeFile(settingsPath, JSON.stringify(settings, null, 2));
};
