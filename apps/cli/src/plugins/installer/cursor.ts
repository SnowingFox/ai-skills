import { join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { DiscoveredPlugin } from '../types';
import {
  deriveMarketplaceName,
  installToPluginCache,
  prepareForClaudeCode,
} from './claude';

/**
 * Install plugins into the Cursor extensions directory on Windows.
 * Creates per-plugin folders under `~/.cursor/extensions/` and updates
 * `extensions.json` with identifier, version, location, and metadata.
 */
export const installToCursorExtensions = async (
  plugins: DiscoveredPlugin[],
  scope: string,
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
  cachePopulated = false
): Promise<void> => {
  if (cachePopulated) return;

  if (process.platform === 'win32') {
    await installToCursorExtensions(plugins, scope, repoPath, source);
    return;
  }

  await installToPluginCache(plugins, scope, repoPath, source);
};
