import * as p from '@clack/prompts';
import pc from 'picocolors';
import { isAICommand } from '../../cli/ai-mode';
import { SilentError } from '../../errors';
import { resolveRemoteRef, type ResolvedRemoteRef } from '../../git';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { PluginEntry } from '../../plugins/types';
import type { PluginsCommandRuntime } from './types';

/**
 * Discriminated union for per-plugin update check outcome.
 */
export type PluginUpdateStatus =
  | {
      status: 'outdated';
      plugin: PluginEntry;
      ref: string;
      currentSha: string;
      latestSha: string;
    }
  | {
      status: 'up-to-date';
      plugin: PluginEntry;
      ref: string;
      currentSha: string;
    }
  | {
      status: 'skipped';
      plugin: PluginEntry;
      reason: string;
    }
  | {
      status: 'failed';
      plugin: PluginEntry;
      reason: string;
    };

/** Aggregated result of an update check across all manifest plugins. */
export type PluginUpdateCheckResult = {
  outdated: Extract<PluginUpdateStatus, { status: 'outdated' }>[];
  upToDate: Extract<PluginUpdateStatus, { status: 'up-to-date' }>[];
  skipped: Extract<PluginUpdateStatus, { status: 'skipped' }>[];
  failed: Extract<PluginUpdateStatus, { status: 'failed' }>[];
};

/** Injectable `resolveRef` for tests. */
export type CheckPluginUpdatesOptions = {
  resolveRef?: (request: {
    provider: 'github' | 'gitlab';
    packageId: string;
    cloneUrl: string;
    ref: string;
  }) => Promise<ResolvedRemoteRef>;
};

/**
 * Check all or selected manifest plugins for Git pin updates.
 *
 * Groups checks by provider + packageId + ref so multiple plugins from the
 * same source perform only one remote lookup.
 */
export const checkPluginUpdates = async (
  plugins: PluginEntry[],
  requestedNames: string[] = [],
  options: CheckPluginUpdatesOptions = {}
): Promise<PluginUpdateCheckResult> => {
  const selected = selectManifestPlugins(plugins, requestedNames);
  const result: PluginUpdateCheckResult = {
    outdated: [],
    upToDate: [],
    skipped: [],
    failed: [],
  };
  const grouped = new Map<string, PluginEntry[]>();

  for (const plugin of selected) {
    if (plugin.provider === 'file') {
      result.skipped.push({
        status: 'skipped',
        plugin,
        reason: 'file sources are not Git-updatable',
      });
      continue;
    }
    if (plugin.provider === 'marketplace') {
      result.skipped.push({
        status: 'skipped',
        plugin,
        reason: 'marketplace updates are not implemented yet',
      });
      continue;
    }
    if (!plugin.ref || !plugin.commitSha) {
      result.failed.push({
        status: 'failed',
        plugin,
        reason: 'missing ref or commitSha in ai-package.json',
      });
      continue;
    }

    const key = `${plugin.provider}\0${plugin.packageId}\0${plugin.ref}`;
    grouped.set(key, [...(grouped.get(key) ?? []), plugin]);
  }

  for (const group of grouped.values()) {
    const first = group[0];
    if (
      !first ||
      (first.provider !== 'github' && first.provider !== 'gitlab')
    ) {
      continue;
    }

    try {
      const latest = await (options.resolveRef ?? defaultResolveRef)({
        provider: first.provider,
        packageId: first.packageId,
        cloneUrl: cloneUrlForPlugin({
          ...first,
          provider: first.provider,
        }),
        ref: first.ref ?? 'HEAD',
      });
      for (const plugin of group) {
        const currentSha = plugin.commitSha ?? '';
        if (latest.commitSha === currentSha) {
          result.upToDate.push({
            status: 'up-to-date',
            plugin,
            ref: latest.ref,
            currentSha,
          });
        } else {
          result.outdated.push({
            status: 'outdated',
            plugin,
            ref: latest.ref,
            currentSha,
            latestSha: latest.commitSha,
          });
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      for (const plugin of group) {
        result.failed.push({ status: 'failed', plugin, reason });
      }
    }
  }

  result.outdated.sort(compareStatuses);
  result.upToDate.sort(compareStatuses);
  result.skipped.sort(compareStatuses);
  result.failed.sort(compareStatuses);
  return result;
};

/**
 * Format plugin update check groups as stable ASCII text.
 */
export const formatPluginUpdateCheckResult = (
  result: PluginUpdateCheckResult,
  options: { includeUpToDate?: boolean } = {}
): string => {
  const lines: string[] = [`outdated: ${result.outdated.length}`];
  for (const item of result.outdated) {
    lines.push(
      `- ${item.plugin.name} ${item.ref}@${shortSha(item.currentSha)} -> ${item.ref}@${shortSha(item.latestSha)}`
    );
  }

  if (options.includeUpToDate !== false) {
    lines.push(`up-to-date: ${result.upToDate.length}`);
    for (const item of result.upToDate) {
      lines.push(
        `- ${item.plugin.name} ${item.ref}@${shortSha(item.currentSha)}`
      );
    }
  }

  lines.push(`skipped: ${result.skipped.length}`);
  for (const item of result.skipped) {
    lines.push(`- ${item.plugin.name} ${item.reason}`);
  }

  if (result.failed.length > 0) {
    lines.push(`failed: ${result.failed.length}`);
    for (const item of result.failed) {
      lines.push(`- ${item.plugin.name} ${item.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

/**
 * Write the plugin update check result to stdout (plain text) or as
 * a Clack note (TTY).
 */
export const writePluginUpdateCheckResult = (
  result: PluginUpdateCheckResult,
  options: { title: string; aiMode: boolean; includeUpToDate?: boolean }
) => {
  const output = formatPluginUpdateCheckResult(result, {
    includeUpToDate: options.includeUpToDate,
  });

  if (!options.aiMode && process.stdin.isTTY === true) {
    p.note(output.trimEnd(), options.title);
    return;
  }

  process.stdout.write(output);
};

/**
 * Apply outdated Git pins to plugin entries without changing skipped entries.
 */
export const applyPluginUpdates = (
  plugins: PluginEntry[],
  result: PluginUpdateCheckResult
): PluginEntry[] => {
  const updatesByName = new Map(
    result.outdated.map((item) => [item.plugin.name, item])
  );

  return plugins.map((plugin): PluginEntry => {
    const update = updatesByName.get(plugin.name);
    if (!update) return plugin;
    return {
      ...plugin,
      version: `${update.ref}@${update.latestSha}`,
      ref: update.ref,
      commitSha: update.latestSha,
    };
  });
};

/**
 * Execute `ai-pkgs plugins outdated`.
 */
export const runPluginsOutdatedCommand = async (
  plugins: string[],
  options: { dir?: string; global?: boolean; manifest?: string; ai?: boolean },
  _runtime: PluginsCommandRuntime
): Promise<number> => {
  const aiMode = isAICommand(options);
  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin outdated'));
  }

  const manifestScope = resolveManifestScope(_runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();

  if (manifest.plugins.length === 0) {
    if (aiMode) {
      process.stdout.write('No plugins in ai-package.json\n');
    } else if (process.stdin.isTTY === true) {
      p.log.info('No plugins declared in ai-package.json');
      p.outro('Done.');
    }
    return 0;
  }

  const result = await checkPluginUpdates(manifest.plugins, plugins);
  writePluginUpdateCheckResult(result, {
    title: 'Plugin updates',
    aiMode,
  });

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(
      result.outdated.length > 0
        ? pc.yellow(
            `${result.outdated.length} plugin${result.outdated.length === 1 ? '' : 's'} can be updated`
          )
        : pc.green('All plugins up to date')
    );
  }

  return result.failed.length > 0 ? 1 : 0;
};

const selectManifestPlugins = (
  plugins: PluginEntry[],
  requestedNames: string[]
): PluginEntry[] => {
  if (requestedNames.length === 0) return plugins;

  const byName = new Map(plugins.map((pl) => [pl.name, pl]));
  const missing = requestedNames.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new SilentError(
      [
        `Unknown plugin name${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
        `Available plugins: ${plugins
          .map((pl) => pl.name)
          .sort()
          .join(', ')}`,
      ].join('\n')
    );
  }

  return requestedNames
    .map((name) => byName.get(name))
    .filter((v): v is PluginEntry => v !== undefined);
};

const defaultResolveRef: NonNullable<
  CheckPluginUpdatesOptions['resolveRef']
> = async ({ cloneUrl, ref }) => resolveRemoteRef({ cloneUrl, ref });

const cloneUrlForPlugin = (
  plugin: PluginEntry & { provider: 'github' | 'gitlab' }
): string => {
  if (plugin.cloneUrl) return plugin.cloneUrl;
  if (plugin.provider === 'github') {
    return `https://github.com/${plugin.packageId.replace(/\.git$/, '')}.git`;
  }
  return plugin.packageId;
};

const compareStatuses = (
  a: Pick<PluginUpdateStatus, 'plugin'>,
  b: Pick<PluginUpdateStatus, 'plugin'>
) => a.plugin.name.localeCompare(b.plugin.name);

const shortSha = (sha: string): string => sha.slice(0, 7);
