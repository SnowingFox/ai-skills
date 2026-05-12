import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { DiscoveredPlugin } from '../types';
import { preparePluginDirForVendor } from './vendor';
import { deriveMarketplaceName } from './claude';

/**
 * Enrich the `.codex-plugin/plugin.json` with `interface` metadata
 * (display name, capabilities, logo) when it is not already present.
 * Codex uses this to render the plugin in its UI.
 */
export const enrichForCodex = async (
  plugin: DiscoveredPlugin
): Promise<void> => {
  const codexManifestPath = join(plugin.path, '.codex-plugin', 'plugin.json');
  if (!existsSync(codexManifestPath)) return;

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await readFile(codexManifestPath, 'utf-8'));
  } catch {
    return;
  }

  if (manifest.interface) return;

  let changed = false;

  if (!manifest.skills && existsSync(join(plugin.path, 'skills'))) {
    manifest.skills = './skills/';
    changed = true;
  }
  if (!manifest.mcpServers && existsSync(join(plugin.path, '.mcp.json'))) {
    manifest.mcpServers = './.mcp.json';
    changed = true;
  }
  if (!manifest.apps && existsSync(join(plugin.path, '.app.json'))) {
    manifest.apps = './.app.json';
    changed = true;
  }

  const name = (manifest.name as string) ?? plugin.name;
  const description =
    (manifest.description as string) ?? plugin.description ?? '';
  const author = manifest.author as Record<string, string> | undefined;

  const iface: Record<string, unknown> = {
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    shortDescription: description,
    developerName: author?.name ?? 'Unknown',
    category: 'Coding',
    capabilities: ['Interactive', 'Write'],
  };

  if (manifest.homepage) iface.websiteURL = manifest.homepage;
  else if (manifest.repository) iface.websiteURL = manifest.repository;

  const assetCandidates = [
    'assets/app-icon.png',
    'assets/icon.png',
    'assets/logo.png',
    'assets/logo.svg',
  ];
  for (const candidate of assetCandidates) {
    if (existsSync(join(plugin.path, candidate))) {
      iface.logo = `./${candidate}`;
      iface.composerIcon = `./${candidate}`;
      break;
    }
  }

  manifest.interface = iface;
  changed = true;

  if (changed) {
    await writeFile(codexManifestPath, JSON.stringify(manifest, null, 2));
  }
};

/**
 * Install plugins for Codex.
 *
 * Prepares the `.codex-plugin/` vendor directory, enriches each
 * plugin's manifest with `interface` metadata, copies plugins to
 * `~/.codex/plugins/cache/`, registers them in the global marketplace
 * at `~/.agents/plugins/marketplace.json`, and updates
 * `~/.codex/config.toml`.
 */
export const installToCodex = async (
  plugins: DiscoveredPlugin[],
  _scope: string,
  repoPath: string,
  source: string
): Promise<void> => {
  const marketplaceName =
    plugins[0]?.marketplace ?? deriveMarketplaceName(source);
  const home = homedir();
  const cacheDir = join(home, '.codex', 'plugins', 'cache');
  const configPath = join(home, '.codex', 'config.toml');
  const marketplaceDir = join(home, '.agents', 'plugins');
  const marketplacePath = join(marketplaceDir, 'marketplace.json');
  const marketplaceRoot = home;

  for (const plugin of plugins) {
    await preparePluginDirForVendor(
      plugin,
      '.codex-plugin',
      'CODEX_PLUGIN_ROOT'
    );
    await enrichForCodex(plugin);
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

  const versionKey = gitSha ?? 'local';
  const pluginPaths: Record<string, string> = {};

  for (const plugin of plugins) {
    const cacheDest = join(cacheDir, marketplaceName, plugin.name, versionKey);
    await mkdir(cacheDest, { recursive: true });
    await cp(plugin.path, cacheDest, { recursive: true });
    pluginPaths[plugin.name] = cacheDest;
  }

  await mkdir(marketplaceDir, { recursive: true });
  let marketplace: {
    name: string;
    interface: Record<string, string>;
    plugins: Record<string, unknown>[];
  } = {
    name: 'plugins-cli',
    interface: { displayName: 'Plugins CLI' },
    plugins: [],
  };

  if (existsSync(marketplacePath)) {
    try {
      const existing = JSON.parse(await readFile(marketplacePath, 'utf-8'));
      if (
        existing &&
        typeof existing === 'object' &&
        Array.isArray(existing.plugins)
      ) {
        marketplace = existing;
      }
    } catch {
      // corrupted – start fresh
    }
  }

  for (const plugin of plugins) {
    const cacheDest = pluginPaths[plugin.name]!;
    const relPath = relative(marketplaceRoot, cacheDest);

    marketplace.plugins = marketplace.plugins.filter(
      (e) => e.name !== plugin.name
    );
    marketplace.plugins.push({
      name: plugin.name,
      source: {
        source: 'local',
        path: `./${relPath}`,
      },
      policy: {
        installation: 'AVAILABLE',
        authentication: 'ON_INSTALL',
      },
      category: 'Coding',
    });
  }

  await writeFile(marketplacePath, JSON.stringify(marketplace, null, 2));

  await mkdir(join(home, '.codex'), { recursive: true });
  let configContent = '';
  if (existsSync(configPath)) {
    configContent = await readFile(configPath, 'utf-8');
  }

  let configChanged = false;
  for (const plugin of plugins) {
    const pluginKey = `${plugin.name}@plugins-cli`;
    const tomlSection = `[plugins."${pluginKey}"]`;
    if (configContent.includes(tomlSection)) {
      continue;
    }
    configContent += `\n${tomlSection}\nenabled = true\n`;
    configChanged = true;
  }

  if (configChanged) {
    await writeFile(configPath, configContent);
  }
};
