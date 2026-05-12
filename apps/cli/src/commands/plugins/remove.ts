import * as p from '@clack/prompts';
import pc from 'picocolors';
import { isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { normalizeList } from '../../install-command';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import { uninstallPlugins } from '../../plugins/installer/uninstall';
import type { PluginsCommandRuntime, PluginsRemoveOptions } from './types';

/**
 * `ai-pkgs plugins remove <plugin...>` removes plugin entries from
 * `ai-package.json`. With `--uninstall`, also cleans agent directories
 * for each persisted target.
 */
export const runPluginsRemoveCommand = async (
  plugins: string[],
  options: PluginsRemoveOptions,
  runtime: PluginsCommandRuntime
): Promise<number> => {
  if (plugins.length === 0) {
    throw new SilentError(
      'Usage: ai-pkgs plugins remove <plugin...> [--uninstall] [--agent <agent>]'
    );
  }

  const aiMode = isAICommand(options);
  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Plugin remove'));
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();

  const byName = new Map(manifest.plugins.map((pl) => [pl.name, pl]));
  const missing = plugins.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    const available =
      manifest.plugins
        .map((pl) => pl.name)
        .sort()
        .join(', ') || '(none)';
    throw new SilentError(
      `Unknown plugin${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}\nAvailable plugins: ${available}`
    );
  }

  if (options.uninstall === true) {
    const agentFilter = new Set(normalizeList(options.agent));

    for (const name of plugins) {
      const entry = byName.get(name)!;
      const source = entry.source ?? `${entry.provider}:${entry.packageId}`;
      const targets =
        agentFilter.size > 0
          ? (entry.targets ?? []).filter((t) => agentFilter.has(t))
          : (entry.targets ?? []);

      for (const target of targets) {
        try {
          await uninstallPlugins(
            name,
            source,
            target,
            manifestScope.projectDir
          );
          if (aiMode) {
            process.stdout.write(
              renderAiDone(`Uninstalled ${name} from ${target}`)
            );
          } else {
            p.log.success(`Uninstalled ${name} from ${target}`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (aiMode) {
            process.stdout.write(
              renderAiStep(`Failed to uninstall ${name} from ${target}: ${msg}`)
            );
          } else {
            p.log.warn(`Failed to uninstall ${name} from ${target}: ${msg}`);
          }
        }
      }

      if (targets.length === 0 && (entry.targets ?? []).length > 0) {
        if (aiMode) {
          process.stdout.write(
            renderAiStep(
              `No matching targets to uninstall for ${name} (targets: ${(entry.targets ?? []).join(', ')})`
            )
          );
        } else {
          p.log.info(
            `No matching targets to uninstall for ${name} (targets: ${(entry.targets ?? []).join(', ')})`
          );
        }
      }
    }
  }

  await store.removePlugins(plugins);

  if (aiMode) {
    process.stdout.write(
      renderAiDone(
        `Removed ${plugins.length} plugin${plugins.length === 1 ? '' : 's'} from ai-package.json`
      )
    );
  } else {
    p.log.success(
      `Removed ${plugins.length} plugin${plugins.length === 1 ? '' : 's'} from ai-package.json: ${plugins.join(', ')}`
    );
  }

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(pc.green('Remove complete'));
  }
  return 0;
};
