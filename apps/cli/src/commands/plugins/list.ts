import * as p from '@clack/prompts';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { PluginEntry } from '../../plugins/types';
import type { PluginsCommandRuntime, PluginsListOptions } from './types';

/** JSON output shape for `plugins list --json`. */
export type ListedPlugin = {
  name: string;
  source: string;
  provider: string;
  packageId: string;
  path: string;
  version?: string;
  ref?: string;
  commitSha?: string;
  targets?: string[];
};

/**
 * Render `ai-pkgs plugins list` as grouped, stable ASCII text.
 */
export const formatPluginsList = (plugins: PluginEntry[]): string => {
  const lines = [`manifest plugins: ${plugins.length}`];
  for (const plugin of [...plugins].sort(compareByName)) {
    const source = plugin.source ?? `${plugin.provider}:${plugin.packageId}`;
    const version =
      plugin.ref && plugin.commitSha
        ? ` ${plugin.ref}@${plugin.commitSha.slice(0, 7)}`
        : '';
    const targets =
      plugin.targets && plugin.targets.length > 0
        ? ` [${plugin.targets.join(', ')}]`
        : '';
    lines.push(`- ${plugin.name} ${source}${version} ${plugin.path}${targets}`);
  }
  return `${lines.join('\n')}\n`;
};

/**
 * List plugins declared in `ai-package.json`.
 */
export const runPluginsListCommand = async (
  options: PluginsListOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();

  if (options.json === true) {
    process.stdout.write(
      `${JSON.stringify(manifest.plugins.map(toListedPlugin), null, 2)}\n`
    );
    return 0;
  }

  if (canPrompt(options) && !isAICommand(options)) {
    p.intro('AI package plugins');
    if (manifest.plugins.length === 0) {
      p.log.info('No plugins declared in ai-package.json');
    } else {
      p.note(
        formatPluginsListNote(manifest.plugins),
        `Manifest plugins (${manifest.plugins.length})`
      );
    }
    p.outro('Done.');
    return 0;
  }

  process.stdout.write(formatPluginsList(manifest.plugins));
  return 0;
};

const formatPluginsListNote = (plugins: PluginEntry[]): string =>
  [...plugins]
    .sort(compareByName)
    .map((plugin) => {
      const source = plugin.source ?? `${plugin.provider}:${plugin.packageId}`;
      const targets =
        plugin.targets && plugin.targets.length > 0
          ? plugin.targets.join(', ')
          : '(none)';
      return [
        `  ${plugin.name}`,
        `    source: ${source}`,
        `    path: ${plugin.path}`,
        `    targets: ${targets}`,
        ...(plugin.version ? [`    version: ${plugin.version}`] : []),
      ].join('\n');
    })
    .join('\n\n');

const toListedPlugin = (plugin: PluginEntry): ListedPlugin => ({
  name: plugin.name,
  source: plugin.source ?? `${plugin.provider}:${plugin.packageId}`,
  provider: plugin.provider,
  packageId: plugin.packageId,
  path: plugin.path,
  version: plugin.version,
  ref: plugin.ref,
  commitSha: plugin.commitSha,
  targets: plugin.targets,
});

const compareByName = (a: PluginEntry, b: PluginEntry) =>
  a.name.localeCompare(b.name);
