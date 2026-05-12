import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import { discoverPlugins } from '../../plugins/discover';
import { installPlugins } from '../../plugins/installer';
import type { PluginTarget } from '../../plugins/installer/types';
import { uninstallPlugins } from '../../plugins/installer/uninstall';
import { createRegistries, getRegistry } from '../../registries';
import type { ResolvedPackage } from '../../registries/types';
import type { PluginsCommandRuntime } from './types';

const VALID_TARGETS = new Set(['claude-code', 'cursor', 'codex']);

/** CLI options for `plugins targets`. */
export type PluginsTargetsOptions = {
  dir?: string;
  global?: boolean;
  manifest?: string;
  yes?: boolean;
  noInstall?: boolean;
  ai?: boolean;
};

/**
 * `plugins targets add <plugin> <agent...>` adds targets to a plugin
 * and optionally installs.
 */
export const runPluginsTargetsAddCommand = async (
  args: string[],
  options: PluginsTargetsOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const [pluginName, ...agents] = args;
  if (!pluginName || agents.length === 0) {
    throw new SilentError(
      'Usage: ai-pkgs plugins targets add <plugin> <agent...>'
    );
  }

  const aiMode = isAICommand(options);
  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin targets add'));
  }

  for (const agent of agents) {
    if (!VALID_TARGETS.has(agent)) {
      throw new SilentError(
        `Invalid target "${agent}". Allowed: claude-code, cursor, codex`
      );
    }
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const plugin = manifest.plugins.find((pl) => pl.name === pluginName);
  if (!plugin) {
    const available =
      manifest.plugins.map((pl) => pl.name).join(', ') || '(none)';
    throw new SilentError(
      `Plugin "${pluginName}" not found in ai-package.json.\nAvailable: ${available}`
    );
  }

  const existing = new Set(plugin.targets ?? []);
  const newAgents = agents.filter((a) => !existing.has(a));
  for (const agent of agents) {
    existing.add(agent);
  }
  plugin.targets = [...existing].sort();
  await store.write(manifest);

  if (aiMode) {
    process.stdout.write(
      renderAiStep(
        `Updated targets for ${pluginName}: [${plugin.targets.join(', ')}]`
      )
    );
  } else {
    p.log.success(
      `Updated targets for ${pluginName}: [${plugin.targets.join(', ')}]`
    );
  }

  if (options.noInstall === true || newAgents.length === 0) {
    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.green('Done.'));
    }
    return 0;
  }

  let shouldInstall = options.yes === true;
  if (!shouldInstall && canPrompt(options)) {
    const confirmed = await runtime.confirm({
      message: `Install to ${newAgents.join(', ')} now?`,
      initialValue: true,
    });
    shouldInstall = confirmed === true;
  }

  if (shouldInstall) {
    const source = plugin.source ?? `${plugin.provider}:${plugin.packageId}`;
    await installToTargets(
      plugin.name,
      source,
      plugin,
      newAgents,
      runtime.cwd,
      aiMode
    );
  }

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(pc.green('Done.'));
  }
  return 0;
};

/**
 * `plugins targets remove <plugin> <agent...>` removes targets from a
 * plugin and optionally uninstalls.
 */
export const runPluginsTargetsRemoveCommand = async (
  args: string[],
  options: PluginsTargetsOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const [pluginName, ...agents] = args;
  if (!pluginName || agents.length === 0) {
    throw new SilentError(
      'Usage: ai-pkgs plugins targets remove <plugin> <agent...>'
    );
  }

  const aiMode = isAICommand(options);
  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin targets remove'));
  }

  for (const agent of agents) {
    if (!VALID_TARGETS.has(agent)) {
      throw new SilentError(
        `Invalid target "${agent}". Allowed: claude-code, cursor, codex`
      );
    }
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const plugin = manifest.plugins.find((pl) => pl.name === pluginName);
  if (!plugin) {
    throw new SilentError(
      `Plugin "${pluginName}" not found in ai-package.json`
    );
  }

  const removeSet = new Set(agents);
  const removedAgents = (plugin.targets ?? []).filter((t) => removeSet.has(t));
  plugin.targets = (plugin.targets ?? []).filter((t) => !removeSet.has(t));
  await store.write(manifest);

  if (aiMode) {
    process.stdout.write(
      renderAiStep(
        `Updated targets for ${pluginName}: [${plugin.targets.join(', ')}]`
      )
    );
  } else {
    p.log.success(
      `Updated targets for ${pluginName}: [${plugin.targets.join(', ')}]`
    );
  }

  if (options.noInstall === true || removedAgents.length === 0) {
    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.green('Done.'));
    }
    return 0;
  }

  let shouldUninstall = options.yes === true;
  if (!shouldUninstall && canPrompt(options)) {
    const confirmed = await runtime.confirm({
      message: `Uninstall from ${removedAgents.join(', ')} now?`,
      initialValue: true,
    });
    shouldUninstall = confirmed === true;
  }

  if (shouldUninstall) {
    const source = plugin.source ?? `${plugin.provider}:${plugin.packageId}`;
    for (const target of removedAgents) {
      try {
        await uninstallPlugins(plugin.name, source, target, runtime.cwd);
        if (aiMode) {
          process.stdout.write(
            renderAiDone(`Uninstalled ${plugin.name} from ${target}`)
          );
        } else {
          p.log.success(`Uninstalled ${plugin.name} from ${target}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (aiMode) {
          process.stdout.write(
            renderAiStep(`Failed to uninstall from ${target}: ${msg}`)
          );
        } else {
          p.log.warn(`Failed to uninstall from ${target}: ${msg}`);
        }
      }
    }
  }

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(pc.green('Done.'));
  }
  return 0;
};

/**
 * `plugins targets list <plugin>` shows current targets in Clack-note
 * format (TTY) or plain text.
 */
export const runPluginsTargetsListCommand = async (
  args: string[],
  options: PluginsTargetsOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const pluginName = args[0];
  if (!pluginName) {
    throw new SilentError('Usage: ai-pkgs plugins targets list <plugin>');
  }

  const aiMode = isAICommand(options);
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const plugin = manifest.plugins.find((pl) => pl.name === pluginName);
  if (!plugin) {
    const available =
      manifest.plugins.map((pl) => pl.name).join(', ') || '(none)';
    throw new SilentError(
      `Plugin "${pluginName}" not found in ai-package.json.\nAvailable: ${available}`
    );
  }

  const targets = plugin.targets ?? [];

  if (!aiMode && process.stdin.isTTY === true) {
    const body =
      targets.length > 0 ? `targets: ${targets.join(', ')}` : 'targets: (none)';
    p.note(body, `Plugin: ${pluginName}`);
  } else {
    process.stdout.write(
      `${pluginName}: ${targets.length > 0 ? targets.join(', ') : '(none)'}\n`
    );
  }

  return 0;
};

/**
 * Resolve, discover, and install a plugin to specified targets.
 */
const installToTargets = async (
  pluginName: string,
  source: string,
  plugin: { provider: string; ref?: string },
  targets: string[],
  projectDir: string,
  aiMode: boolean
): Promise<void> => {
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
    });
  } catch {
    if (aiMode) {
      process.stdout.write(
        renderAiStep(`Failed to resolve ${pluginName} for install`)
      );
    } else {
      p.log.warn(`Failed to resolve ${pluginName} for install`);
    }
    return;
  }

  try {
    const { plugins: discovered } = await discoverPlugins(
      resolved.root.rootDir
    );
    const toInstall = discovered.filter((d) => d.name === pluginName);
    if (toInstall.length === 0) return;

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
          renderAiDone(`Installed ${pluginName} to ${targetId}`)
        );
      } else {
        p.log.success(`Installed ${pluginName} to ${targetId}`);
      }
    }
  } finally {
    await resolved.root.cleanup?.();
  }
};
