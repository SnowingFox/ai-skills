import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import { discoverPlugins } from '../../plugins/discover';
import { installPlugins } from '../../plugins/installer';
import type { ResolvedPackage } from '../../registries/types';
import type { PluginTarget } from '../../plugins/installer/types';
import type { PluginEntry } from '../../plugins/types';
import {
  applyPluginUpdates,
  checkPluginUpdates,
  formatPluginUpdateCheckResult,
  writePluginUpdateCheckResult,
} from './outdated';
import type { PluginsCommandRuntime, PluginsUpdateOptions } from './types';

/**
 * `ai-pkgs plugins update` checks for outdated Git pins, writes new
 * SHAs to `ai-package.json`, then reinstalls each updated plugin to
 * its persisted targets.
 */
export const runPluginsUpdateCommand = async (
  plugins: string[],
  options: PluginsUpdateOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const aiMode = isAICommand(options);
  const projectDir = runtime.cwd;

  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin update'));
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
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

  if (result.failed.length > 0) {
    writePluginUpdateCheckResult(result, {
      title: 'Plugin update check failed',
      aiMode,
    });
    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.red('Update check failed'));
    }
    return 1;
  }

  if (result.outdated.length === 0) {
    const output = formatPluginUpdateCheckResult(
      { ...result, upToDate: [] },
      { includeUpToDate: false }
    ).replace(/^outdated:/, 'updated:');
    process.stdout.write(output);
    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.green('All plugins up to date'));
    }
    return 0;
  }

  if (options.yes !== true) {
    if (!canPrompt(options)) {
      throw new SilentError(
        'Pass --yes to update plugins in non-interactive or --ai mode.'
      );
    }
    writePluginUpdateCheckResult(result, {
      title: 'Plugin updates',
      aiMode: false,
      includeUpToDate: false,
    });
    const confirmed = await runtime.confirm({
      message: `Update ${result.outdated.length} plugin${result.outdated.length === 1 ? '' : 's'} in ai-package.json?`,
      initialValue: true,
    });
    if (confirmed !== true) {
      p.cancel('Plugin update cancelled');
      return 1;
    }
  }

  const updatedPlugins = applyPluginUpdates(manifest.plugins, result);
  await store.write({ ...manifest, plugins: updatedPlugins });

  if (aiMode) {
    process.stdout.write(
      renderAiStep(
        `Updated ${result.outdated.length} plugin(s) in ai-package.json`
      )
    );
  } else {
    p.log.success(
      `Updated ${result.outdated.length} plugin(s) in ai-package.json`
    );
  }

  const updatedNames = new Set(result.outdated.map((item) => item.plugin.name));
  const pluginsToReinstall = updatedPlugins.filter((pl) =>
    updatedNames.has(pl.name)
  );
  await reinstallPlugins(pluginsToReinstall, projectDir, aiMode);

  const output = formatPluginUpdateCheckResult(
    { ...result, upToDate: [] },
    { includeUpToDate: false }
  ).replace(/^outdated:/, 'updated:');
  process.stdout.write(output);

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(pc.green('Update complete'));
  }
  return 0;
};

/**
 * Re-resolve and reinstall each updated plugin to its persisted targets.
 */
const reinstallPlugins = async (
  plugins: PluginEntry[],
  projectDir: string,
  aiMode: boolean
): Promise<void> => {
  for (const plugin of plugins) {
    const targets = plugin.targets ?? [];
    if (targets.length === 0) continue;

    const source = plugin.source ?? `${plugin.provider}:${plugin.packageId}`;

    // Re-resolve from registries to get the new version on disk
    const { createRegistries, getRegistry } = await import('../../registries');
    const registries = createRegistries(projectDir);
    const registryKind =
      plugin.provider === 'file'
        ? 'file'
        : plugin.provider === 'github'
          ? 'github'
          : 'gitlab';
    const registry = getRegistry(registries, registryKind);

    let resolved: ResolvedPackage;
    try {
      resolved = await registry.resolve({
        rawSource: source,
        registry: registryKind,
        ref: plugin.ref,
        refresh: true,
      });
    } catch {
      if (aiMode) {
        process.stdout.write(
          renderAiStep(`Failed to resolve ${plugin.name} for reinstall`)
        );
      } else {
        p.log.warn(`Failed to resolve ${plugin.name} for reinstall`);
      }
      continue;
    }

    try {
      const { plugins: discovered } = await discoverPlugins(
        resolved.root.rootDir
      );
      const toInstall =
        discovered.filter((d) => d.name === plugin.name) || discovered;

      if (toInstall.length === 0) {
        await resolved.root.cleanup?.();
        continue;
      }

      for (const targetId of targets) {
        const target: PluginTarget = {
          id: targetId as 'claude-code' | 'cursor' | 'codex',
          name: targetId,
          detected: true,
          configPath: '',
        };

        await installPlugins(
          toInstall,
          target,
          'user',
          resolved.root.rootDir,
          source,
          projectDir
        );

        if (aiMode) {
          process.stdout.write(
            renderAiDone(`Reinstalled ${plugin.name} to ${targetId}`)
          );
        } else {
          p.log.success(`Reinstalled ${plugin.name} to ${targetId}`);
        }
      }
    } finally {
      await resolved.root.cleanup?.();
    }
  }
};
