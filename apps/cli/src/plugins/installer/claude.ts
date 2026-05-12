import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { DiscoveredPlugin } from '../types';
import { preparePluginDirForVendor } from './vendor';

const OFFICIAL_MARKETPLACE_SOURCE = 'anthropics/claude-plugins-official';

/**
 * Try to extract an official plugin ref for a known source that the
 * Claude CLI can install natively (e.g. `vercel@claude-plugins-official`).
 * Returns `null` when the source is not an official marketplace repo.
 */
export const getOfficialPluginRef = (source: string): string | null => {
  let repo: string | null = null;

  const shorthand = source.match(/^([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
  if (shorthand?.[1]) repo = shorthand[1].toLowerCase();

  if (!repo) {
    const https = source.match(
      /^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/
    );
    if (https?.[1]) repo = https[1].toLowerCase();
  }
  if (!repo) {
    const ssh = source.match(/^git@github\.com:([\w.-]+\/[\w.-]+?)(?:\.git)?$/);
    if (ssh?.[1]) repo = ssh[1].toLowerCase();
  }

  if (repo === 'vercel/vercel-plugin') {
    return 'vercel@claude-plugins-official';
  }
  return null;
};

/**
 * Locate the `claude` binary on the system. Checks `which`, then common
 * install locations. Returns the absolute path or `null`.
 */
export const findClaudeOrNull = (): string | null => {
  try {
    const path = execSync('which claude', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    if (path) return path;
  } catch {
    // not on PATH
  }

  const home = homedir();
  const candidates = [
    join(home, '.local', 'bin', 'claude'),
    join(home, '.bun', 'bin', 'claude'),
    '/usr/local/bin/claude',
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

/**
 * Attempt to install a plugin via the official Claude CLI
 * `plugin install` command. Returns `true` on success, `false` when
 * the CLI is unavailable or the command fails.
 */
export const installViaClaudeCli = async (
  pluginRef: string,
  scope: string
): Promise<boolean> => {
  const claude = findClaudeOrNull();
  if (!claude) return false;

  try {
    execSync(
      `${claude} plugin marketplace add ${OFFICIAL_MARKETPLACE_SOURCE}`,
      { stdio: 'pipe', timeout: 120_000 }
    );
    execSync(`${claude} plugin install "${pluginRef}" --scope ${scope}`, {
      stdio: 'pipe',
      timeout: 120_000,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Derive a marketplace name from a source URL or shorthand.
 * Produces a slug like `owner-repo` for `owner/repo`.
 */
export const deriveMarketplaceName = (source: string): string => {
  if (source.match(/^[\w-]+\/[\w.-]+$/)) {
    return source.replace('/', '-');
  }

  const sshMatch = source.match(/^git@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch?.[1]) {
    const parts = sshMatch[1].split('/').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
    }
  }

  try {
    const url = new URL(source);
    const parts = url.pathname
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
    }
  } catch {
    // not a URL
  }

  const parts = source.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] ?? 'plugins';
};

/**
 * Extract a GitHub `owner/repo` pair from a source string.
 * Returns `null` for non-GitHub sources.
 */
export const extractGitHubRepo = (source: string): string | null => {
  const shorthand = source.match(/^([\w-]+\/[\w.-]+)$/);
  if (shorthand?.[1]) return shorthand[1];

  const httpsMatch = source.match(
    /^https?:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/
  );
  if (httpsMatch?.[1]) return httpsMatch[1];

  const sshMatch = source.match(
    /^git@github\.com:([\w.-]+\/[\w.-]+?)(?:\.git)?$/
  );
  if (sshMatch?.[1]) return sshMatch[1];

  return null;
};

/**
 * Check whether a source string points to a remote repository
 * (GitHub shorthand, SSH, or HTTPS URL).
 */
export const isRemoteSource = (source: string): boolean => {
  if (source.match(/^[\w-]+\/[\w.-]+$/)) return true;
  if (source.startsWith('git@')) return true;
  if (source.startsWith('https://') || source.startsWith('http://'))
    return true;
  return false;
};

/**
 * Convert a source string (shorthand, SSH, or HTTPS) into a canonical
 * HTTPS git URL.
 */
export const normalizeGitUrl = (source: string): string => {
  if (source.match(/^[\w-]+\/[\w.-]+$/)) {
    return `https://github.com/${source}`;
  }

  const sshMatch = source.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  return source;
};

/**
 * Generate a `.claude-plugin/marketplace.json` for the repo and run
 * vendor preparation on each plugin.
 */
export const prepareForClaudeCode = async (
  plugins: DiscoveredPlugin[],
  repoPath: string,
  marketplaceName: string
): Promise<void> => {
  const claudePluginDir = join(repoPath, '.claude-plugin');
  await mkdir(claudePluginDir, { recursive: true });

  const marketplaceJson = {
    name: marketplaceName,
    owner: { name: 'plugins' },
    plugins: plugins.map((p) => {
      const rel = relative(repoPath, p.path);
      const sourcePath = rel === '' ? './' : `./${rel}`;
      const entry: Record<string, unknown> = {
        name: p.name,
        source: sourcePath,
        description: p.description ?? '',
      };
      if (p.version) entry.version = p.version;
      if (p.manifest?.author) entry.author = p.manifest.author;
      if (p.manifest?.license) entry.license = p.manifest.license;
      if (p.manifest?.keywords) entry.keywords = p.manifest.keywords;
      return entry;
    }),
  };

  await writeFile(
    join(claudePluginDir, 'marketplace.json'),
    JSON.stringify(marketplaceJson, null, 2)
  );

  for (const plugin of plugins) {
    await preparePluginDirForVendor(
      plugin,
      '.claude-plugin',
      'CLAUDE_PLUGIN_ROOT'
    );
  }
};

/**
 * Install plugins into the Claude plugin cache at
 * `~/.claude/plugins/cache/<marketplace>/<plugin>/<versionKey>/`.
 *
 * Updates `installed_plugins.json`, `known_marketplaces.json`, and
 * `settings.json` `enabledPlugins`.
 */
export const installToPluginCache = async (
  plugins: DiscoveredPlugin[],
  scope: string,
  repoPath: string,
  source: string,
  projectDir?: string
): Promise<void> => {
  const marketplaceName =
    plugins[0]?.marketplace ?? deriveMarketplaceName(source);
  const home = homedir();
  const pluginsDir = join(home, '.claude', 'plugins');
  const cacheDir = join(pluginsDir, 'cache');

  await prepareForClaudeCode(plugins, repoPath, marketplaceName);

  await mkdir(pluginsDir, { recursive: true });

  const knownPath = join(pluginsDir, 'known_marketplaces.json');
  let knownMarketplaces: Record<string, unknown> = {};
  if (existsSync(knownPath)) {
    try {
      knownMarketplaces = JSON.parse(await readFile(knownPath, 'utf-8'));
    } catch {
      // corrupted – start fresh
    }
  }

  const githubRepo = extractGitHubRepo(source);
  const marketplacesDir = join(pluginsDir, 'marketplaces');
  const marketplaceInstallLocation = join(marketplacesDir, marketplaceName);

  await mkdir(marketplacesDir, { recursive: true });
  if (existsSync(marketplaceInstallLocation)) {
    await rm(marketplaceInstallLocation, { recursive: true });
  }
  await cp(repoPath, marketplaceInstallLocation, { recursive: true });

  if (!(knownMarketplaces as Record<string, unknown>)[marketplaceName]) {
    let marketplaceSource: Record<string, string>;
    if (githubRepo) {
      marketplaceSource = { source: 'github', repo: githubRepo };
    } else if (isRemoteSource(source)) {
      const gitUrl = normalizeGitUrl(source);
      marketplaceSource = {
        source: 'git',
        url: gitUrl.endsWith('.git') ? gitUrl : `${gitUrl}.git`,
      };
    } else {
      marketplaceSource = { source: 'directory', path: repoPath };
    }

    (knownMarketplaces as Record<string, unknown>)[marketplaceName] = {
      source: marketplaceSource,
      installLocation: marketplaceInstallLocation,
      lastUpdated: new Date().toISOString(),
    };
    await writeFile(knownPath, JSON.stringify(knownMarketplaces, null, 2));
  }

  const installedPath = join(pluginsDir, 'installed_plugins.json');
  const installedData: {
    version: number;
    plugins: Record<string, unknown[]>;
  } = { version: 2, plugins: {} };

  if (existsSync(installedPath)) {
    try {
      const parsed = JSON.parse(await readFile(installedPath, 'utf-8'));
      installedData.version = parsed.version ?? 2;
      installedData.plugins = parsed.plugins ?? {};
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
    const cacheDest = join(cacheDir, marketplaceName, plugin.name, versionKey);

    await mkdir(cacheDest, { recursive: true });
    await cp(plugin.path, cacheDest, { recursive: true });

    const pluginKey = `${plugin.name}@${marketplaceName}`;
    const now = new Date().toISOString();
    const entry: Record<string, unknown> = {
      scope,
      installPath: cacheDest,
      version,
      installedAt: now,
      lastUpdated: now,
    };
    if (gitSha) entry.gitCommitSha = gitSha;
    installedData.plugins[pluginKey] = [entry];
  }

  await writeFile(installedPath, JSON.stringify(installedData, null, 2));

  const settingsPath = projectDir
    ? join(projectDir, '.claude', 'settings.json')
    : join(home, '.claude', 'settings.json');
  let settings: Record<string, unknown> = {};
  let settingsCorrupted = false;

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
    } catch {
      settingsCorrupted = true;
    }
  }

  if (!settingsCorrupted) {
    const enabled = (settings.enabledPlugins as Record<string, boolean>) ?? {};
    for (const plugin of plugins) {
      const pluginKey = `${plugin.name}@${marketplaceName}`;
      enabled[pluginKey] = true;
    }
    settings.enabledPlugins = enabled;
    await mkdir(join(settingsPath, '..'), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(settings, null, 2));
  }
};

/**
 * Install plugins into Claude Code. Delegates to {@link installToPluginCache}
 * which handles cache layout, manifest updates, and settings.
 */
export const installToClaudeCode = async (
  plugins: DiscoveredPlugin[],
  scope: string,
  repoPath: string,
  source: string,
  projectDir?: string
): Promise<void> => {
  await installToPluginCache(plugins, scope, repoPath, source, projectDir);
};
