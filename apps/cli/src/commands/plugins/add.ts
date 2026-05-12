import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { createCloneProgressRenderer } from '../../cli/clone-progress';
import { SilentError } from '../../errors';
import { GitCommandError } from '../../git';
import { normalizeList } from '../../install-command';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import { createRegistries, getRegistry } from '../../registries';
import type { RegistryKind } from '../../registries';
import type { PluginEntry } from '../../plugins/types';
import { discoverPlugins } from '../../plugins/discover';
import { selectPluginTargets } from '../../plugins/targets';
import { installPlugins } from '../../plugins/installer';
import type { PluginTarget } from '../../plugins/installer/types';
import type { PluginsAddOptions, PluginsCommandRuntime } from './types';

const resolveRegistry = (
  source: string,
  registry?: RegistryKind
): RegistryKind => {
  if (
    source.startsWith('file:') ||
    source.startsWith('.') ||
    source.startsWith('/')
  ) {
    return 'file';
  }
  if (source.startsWith('github:') || source.includes('github.com/')) {
    return 'github';
  }
  if (source.startsWith('gitlab:') || source.includes('gitlab')) {
    return 'gitlab';
  }
  return registry ?? 'github';
};

/**
 * `ai-pkgs plugins add <source>` resolves a source, discovers plugins,
 * selects target agents, installs, and writes manifest entries.
 */
export const runPluginsAddCommand = async (
  rawSource: string,
  options: PluginsAddOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  const projectDir = resolve(runtime.cwd, options.dir ?? '.');
  const promptAllowed = canPrompt(options);
  const aiMode = isAICommand(options);

  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin add'));
  }

  if (options.installOnly === true && options.manifest) {
    throw new SilentError('--install-only cannot be used with --manifest');
  }
  if (options.global === true && options.manifest) {
    throw new SilentError('--global cannot be used with --manifest');
  }

  const registryKind = resolveRegistry(rawSource, options.registry);
  const registries = createRegistries(projectDir);
  const registry = getRegistry(registries, registryKind);

  const cloneRenderer = createCloneProgressRenderer({
    aiMode,
    enabled: registryKind === 'github' || registryKind === 'gitlab',
    verbose: options.verbose === true,
  });

  const resolved = await registry
    .resolve({
      rawSource,
      registry: registryKind,
      ref: options.ref,
      refresh: options.refresh,
      onProgress: cloneRenderer.onProgress,
    })
    .catch((error: unknown) => {
      cloneRenderer.fail(error);
      if (error instanceof GitCommandError) {
        throw new SilentError(formatGitCloneError(error), { cause: error });
      }
      throw error;
    });
  cloneRenderer.done(resolved.ref, resolved.commitSha);

  try {
    const { plugins: discovered } = await discoverPlugins(
      resolved.root.rootDir
    );

    if (discovered.length === 0) {
      if (aiMode) {
        process.stdout.write(renderAiStep('No plugins found in source'));
      } else {
        p.log.warn('No plugins found in source');
      }
      if (!aiMode && process.stdin.isTTY === true) {
        p.outro(pc.red('Add failed'));
      }
      return 1;
    }

    const requestedPlugins = normalizeList(options.plugin);
    let selected = discovered;
    if (requestedPlugins.length > 0) {
      selected = discovered.filter((pl) => requestedPlugins.includes(pl.name));
      if (selected.length === 0) {
        throw new SilentError(
          `No plugins matched: ${requestedPlugins.join(', ')}\nAvailable: ${discovered.map((pl) => pl.name).join(', ')}`
        );
      }
    } else if (discovered.length > 1 && !options.yes) {
      if (!promptAllowed) {
        throw new SilentError(
          `Multiple plugins found. Use --plugin to select or --yes to install all.\nAvailable: ${discovered.map((pl) => pl.name).join(', ')}`
        );
      }
      const choices = await p.multiselect({
        message: 'Select plugins to install',
        options: discovered.map((pl) => ({
          label: pl.name,
          value: pl.name,
          hint: pl.description,
        })),
        initialValues: discovered.map((pl) => pl.name),
        required: true,
      });
      if (p.isCancel(choices)) {
        throw new SilentError('Plugin selection cancelled');
      }
      selected = discovered.filter((pl) => choices.includes(pl.name));
    }

    const targetIds = await selectPluginTargets({
      pluginPath: selected[0]?.path ?? resolved.root.rootDir,
      agentFlags: normalizeList(options.agent),
      canPrompt: promptAllowed,
      yes: options.yes === true,
    });

    const manifestScope = resolveManifestScope(runtime.cwd, options);
    const isGlobal = manifestScope.global;

    for (const targetId of targetIds) {
      const target: PluginTarget = {
        id: targetId as 'claude-code' | 'cursor' | 'codex',
        name: targetId,
        detected: true,
        configPath: '',
      };

      if (aiMode) {
        process.stdout.write(renderAiStep(`Installing to ${targetId}...`));
      } else {
        p.log.step(`Installing to ${targetId}...`);
      }

      await installPlugins(
        selected,
        target,
        options.scope ?? 'user',
        resolved.root.rootDir,
        rawSource
      );

      if (aiMode) {
        process.stdout.write(
          renderAiDone(`Installed ${selected.length} plugin(s) to ${targetId}`)
        );
      } else {
        p.log.success(`Installed ${selected.length} plugin(s) to ${targetId}`);
      }
    }

    if (options.installOnly !== true) {
      const pluginEntries: PluginEntry[] = selected.map((pl) => ({
        name: pl.name,
        provider: resolved.provider,
        source: resolved.source,
        packageId: resolved.packageId,
        version: resolved.version,
        ref: resolved.ref,
        commitSha: resolved.commitSha,
        path:
          pl.path === resolved.root.rootDir
            ? '.'
            : pl.path.replace(`${resolved.root.rootDir}/`, ''),
        targets: targetIds,
      }));
      const store = createManifestStore(
        manifestScope.projectDir,
        manifestScope.manifestPath
      );
      await store.addPlugins(pluginEntries);

      if (aiMode) {
        process.stdout.write(
          renderAiStep(`Wrote ${selected.length} plugin(s) to ai-package.json`)
        );
      } else {
        p.log.success(`Wrote ${selected.length} plugin(s) to ai-package.json`);
      }
    }

    if (targetIds.includes('claude-code') || targetIds.includes('cursor')) {
      const settingsNote = isGlobal
        ? 'Enabled in ~/.claude/settings.json'
        : 'Enabled in .claude/settings.json';
      if (aiMode) {
        process.stdout.write(renderAiStep(settingsNote));
      } else {
        p.log.success(settingsNote);
      }
    }

    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.green('Add complete'));
    }
    return 0;
  } finally {
    await resolved.root.cleanup?.();
  }
};

/**
 * Convert classified Git failures into user-facing remediation text.
 */
const formatGitCloneError = (error: GitCommandError): string => {
  const kindMessages: Record<string, string> = {
    timeout:
      'Git clone timed out.\n  - Check your network connection.\n  - Retry later or clone manually and use --registry file.',
    auth: 'Authentication failed while cloning the repository.\n  - For private repos, ensure your account has access.\n  - For HTTPS: run gh auth login or configure git credentials.\n  - For SSH: check keys with ssh -T git@github.com.',
    'not-found':
      'Repository was not found.\n  - Check the owner/repo or clone URL.\n  - If it is private, confirm your Git credentials have access.',
    ref: 'Git ref checkout failed.\n  - Check the value passed with --ref.\n  - Ensure the branch, tag, or commit exists in the source repository.',
    'git-missing':
      'Git is not available on this machine.\n  - Install git and ensure it is on PATH.',
  };

  const base =
    kindMessages[error.kind] ??
    'Failed to clone repository.\n  - Check the source URL and network connection.\n  - If this is a private repo, configure Git credentials.';

  const detail = error.stderr
    ? `\n\nGit output:\n${error.stderr
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n')}`
    : '';
  return `${base}${detail}`;
};
