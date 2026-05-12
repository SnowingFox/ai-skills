import { readFile } from 'node:fs/promises';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { match } from 'ts-pattern';
import { resolveAgentTargets } from './agents/targets';
import { canPrompt, isAICommand } from './cli/ai-mode';
import { renderAiDone, renderAiStep } from './cli/ai-output';
import { SilentError } from './errors';
import type { GitProgressEvent } from './git';
import { installSkills } from './install';
import { parseAiPackageManifest, resolveManifestScope } from './manifest';
export { resolveManifestPath } from './manifest';
import type {
  AgentTarget,
  AiPackageManifest,
  ConflictPolicy,
  InstallMode,
  InstallProgress,
  InstalledSkill,
} from './types';

/** Parsed CLI flags shared by `install` and `skills` commands. */
export type InstallCommandOptions = {
  manifest?: string;
  dir?: string;
  yes?: boolean;
  agent?: string | string[];
  copy?: boolean;
  link?: boolean;
  force?: boolean;
  skipExisting?: boolean;
  ai?: boolean;
  project?: boolean;
  global?: boolean;
  refresh?: boolean;
  verbose?: boolean;
};

/** Injectable file reader type for tests. */
export type ReadTextFile = (
  path: string,
  encoding: BufferEncoding
) => Promise<string>;

/**
 * Injection surface for `install` and `skills` command actions.
 * Provides cwd, confirm prompt, install executor, and file reader so
 * commands are fully unit-testable without real I/O.
 */
export type InstallCommandRuntime = {
  cwd: string;
  confirm: typeof p.confirm;
  install: typeof installSkills;
  readTextFile: ReadTextFile;
};

/** Partial overrides when constructing an {@link InstallCommandRuntime}. */
export type InstallCommandRuntimeOverrides = Partial<
  Omit<InstallCommandRuntime, 'cwd'>
>;

/**
 * Build the default install command runtime backed by Clack prompts,
 * real filesystem reads, and {@link installSkills}.
 */
export const createInstallCommandRuntime = (
  cwd: string,
  overrides: InstallCommandRuntimeOverrides = {}
): InstallCommandRuntime => ({
  cwd,
  confirm: overrides.confirm ?? p.confirm,
  install: overrides.install ?? installSkills,
  readTextFile:
    overrides.readTextFile ?? ((path, encoding) => readFile(path, encoding)),
});

/**
 * Run the `install` command action registered by `cac`.
 *
 * @example
 * await runInstallCommand({ yes: true }, { cwd: '/repo' });
 * // Reads /repo/ai-package.json and installs declared skills into
 * // /repo/.agents/skills. It does not mutate the manifest.
 */
export const runInstallCommand = async (
  options: InstallCommandOptions,
  runtime: InstallCommandRuntime
): Promise<number> => {
  p.intro(pc.bold('AI package installer'));

  try {
    const aiMode = isAICommand(options);
    const promptAllowed = canPrompt(options);
    const verbose = options.verbose === true;
    if (options.project === true && options.global === true) {
      throw new SilentError('--project and --global are mutually exclusive');
    }
    const manifestScope = resolveManifestScope(runtime.cwd, options);
    const manifest = await readManifest(manifestScope.manifestPath, runtime);
    const hasSkills = manifest.skills.length > 0;
    const hasPlugins = manifest.plugins.length > 0;

    if (!hasSkills && !hasPlugins) {
      p.outro(pc.yellow('No skills or plugins declared in ai-package.json'));
      return 0;
    }

    const planParts: string[] = [];
    if (hasSkills) {
      planParts.push(formatSkillSummary(manifest));
    }
    if (hasPlugins) {
      planParts.push(formatPluginSummary(manifest));
    }
    p.note(planParts.join('\n\n'), 'Install plan');

    if (options.yes !== true) {
      if (aiMode) {
        throw new SilentError(
          'Pass --yes when using --ai with install to confirm the install plan.'
        );
      }
      const totalCount = manifest.skills.length + manifest.plugins.length;
      const confirmed = await runtime.confirm({
        message: buildConfirmMessage(totalCount),
        initialValue: true,
      });

      if (confirmed !== true) {
        p.cancel('Install cancelled');
        return 1;
      }
    }

    const targets = await resolveAgentTargets({
      agentIds: normalizeList(options.agent),
      cwd: manifestScope.projectDir,
      global: manifestScope.global,
      yes: options.yes === true,
      canPrompt: promptAllowed,
    });
    const mode = resolveInstallMode(options);
    const conflict = resolveConflictPolicy(options);
    if (hasSkills) {
      if (aiMode) {
        process.stdout.write(renderAiStep('Materializing sources'));
      } else {
        p.note(
          'Resolving declared package sources and Git cache entries.',
          'Materializing sources'
        );
      }
      const result = await runtime.install({
        manifest,
        projectDir: manifestScope.projectDir,
        targets,
        mode,
        conflict,
        canPrompt: promptAllowed,
        refresh: options.refresh === true,
        onProgress: (progress) => {
          if (!verbose) {
            return;
          }
          const message = formatProgress(progress);
          if (aiMode) {
            process.stdout.write(renderAiStep(message));
          } else {
            p.log.info(message);
          }
        },
        onGitProgress: (progress) => {
          const message = formatGitProgress(progress);
          if (!message) {
            return;
          }
          if (aiMode) {
            process.stdout.write(renderAiStep(message));
          } else {
            p.note(message, 'Git cache');
          }
        },
      });

      const installedCount = countInstalled(result.installed);
      const installSummary = formatInstallResultSummary({
        installed: result.installed,
        targets,
        mode,
      });
      if (aiMode) {
        process.stdout.write(renderAiStep(installSummary));
        process.stdout.write(
          renderAiDone(`Installed ${installedCount} skill(s)`)
        );
      } else {
        p.note(installSummary, 'Installing skills');
        p.log.success(`Installed ${installedCount} skill(s)`);
      }
      for (const skill of result.installed) {
        if (skill.skipped === true) {
          writeInstallDetail(skill, aiMode, 'skipped');
        } else if (verbose) {
          writeInstallDetail(skill, aiMode, 'installed');
        }
      }
    }

    if (hasPlugins) {
      if (aiMode) {
        process.stdout.write(renderAiStep('Installing plugins'));
      } else {
        p.note('Installing declared plugins from ai-package.json', 'Plugins');
      }

      for (const plugin of manifest.plugins) {
        const pluginTargets = plugin.targets ?? [];
        if (pluginTargets.length === 0) {
          if (aiMode) {
            process.stdout.write(
              renderAiStep(`skipped: ${plugin.name} (no targets)`)
            );
          } else {
            p.log.warn(`${plugin.name}: no targets declared, skipping`);
          }
          continue;
        }

        if (aiMode) {
          process.stdout.write(
            renderAiStep(
              `${plugin.name} -> ${pluginTargets.join(', ')}`
            )
          );
        } else {
          p.log.info(
            `${plugin.name} -> ${pluginTargets.join(', ')}`
          );
        }
      }
    }

    p.outro(pc.green('Install complete'));
    return 0;
  } catch (error) {
    p.log.error(formatInstallError(error));
    if (error instanceof SilentError) {
      p.log.info('Run ai-pkgs install -h for detailed usage.');
    }
    p.outro(pc.red('Install failed'));
    return 1;
  }
};

/** Multi-line Clack note content showing each skill's source and path. */
export const formatSkillSummary = (manifest: AiPackageManifest): string =>
  manifest.skills
    .map((skill) => {
      const source = match(skill)
        .with({ provider: 'file' }, (entry) => `file:${entry.packageId}`)
        .otherwise(
          (entry) =>
            `${entry.source ?? `${entry.provider}:${entry.packageId}`}@${
              entry.ref ?? 'unknown'
            }`
        );
      return `${skill.name}\n  ${source}\n  ${skill.path}`;
    })
    .join('\n\n');

/** Multi-line Clack note content showing each plugin's source and path. */
export const formatPluginSummary = (manifest: AiPackageManifest): string =>
  manifest.plugins
    .map((plugin) => {
      const source = match(plugin)
        .with({ provider: 'file' }, (entry) => `file:${entry.packageId}`)
        .otherwise(
          (entry) =>
            `${entry.source ?? `${entry.provider}:${entry.packageId}`}@${
              entry.ref ?? 'unknown'
            }`
        );
      return `[plugin] ${plugin.name}\n  ${source}\n  ${plugin.path}`;
    })
    .join('\n\n');

/** Build the yes/no confirmation prompt for the install count. */
export const buildConfirmMessage = (count: number): string => {
  const unit = count === 1 ? 'item' : 'items';
  return `Install ${count} ${unit}?`;
};

/** Single-line human-readable progress status for one skill. */
export const formatProgress = (progress: InstallProgress): string =>
  match(progress.status)
    .with('cloning', () => `cloning: ${progress.name}`)
    .with('resolving', () => `resolving: ${progress.name}`)
    .with('discovering', () => `discovering: ${progress.name}`)
    .with('copying', () => `copying: ${progress.name}`)
    .with('linking', () => `linking: ${progress.name}`)
    .with('skipped', () => `skipped: ${progress.name}`)
    .with('installed', () => `installed: ${progress.name}`)
    .exhaustive();

/** Summary of installed/skipped counts per install mode and target agents. */
export const formatInstallResultSummary = ({
  installed,
  targets,
  mode,
}: {
  installed: InstalledSkill[];
  targets: AgentTarget[];
  mode: InstallMode;
}): string => {
  const installedCount = countInstalled(installed);
  const skippedCount = installed.length - installedCount;
  const targetSummary = formatTargetSummary(targets);
  const lines = [
    `${mode}: ${installedCount} ${formatSkillUnit(installedCount)} -> ${targetSummary}`,
  ];

  if (skippedCount > 0) {
    lines.push(`skipped: ${skippedCount} ${formatSkillUnit(skippedCount)}`);
  }

  return lines.join('\n');
};

/**
 * Render Git cache events (hit/refresh/store) as Clack note text.
 * Returns an empty string for events that don't need user-visible output.
 */
export const formatGitProgress = (progress: GitProgressEvent): string => {
  if (progress.status === 'cache-hit') {
    return [
      'reusing Git cache for verified remote ref',
      `source: ${progress.provider}:${progress.packageId}`,
      `ref: ${progress.ref}@${progress.commitSha.slice(0, 7)}`,
      `cache: ${progress.cachePath}`,
    ].join('\n');
  }
  if (progress.status === 'cache-refresh') {
    return `refreshing Git cache: ${progress.cachePath}`;
  }
  if (progress.status === 'cache-store') {
    return `stored Git cache: ${progress.cachePath}`;
  }
  return '';
};

const writeInstallDetail = (
  skill: InstalledSkill,
  aiMode: boolean,
  status: 'installed' | 'skipped'
) => {
  const message = `${status}: ${skill.name} -> ${skill.targetDir}`;
  if (aiMode) {
    process.stdout.write(renderAiStep(message));
    return;
  }

  if (status === 'skipped') {
    p.log.info(
      `${pc.yellow(skill.name)} skipped -> ${pc.dim(skill.targetDir)}`
    );
  } else {
    p.log.success(`${pc.cyan(skill.name)} -> ${pc.dim(skill.targetDir)}`);
  }
};

const countInstalled = (installed: InstalledSkill[]): number =>
  installed.filter((skill) => skill.skipped !== true).length;

const formatTargetSummary = (targets: AgentTarget[]): string =>
  targets
    .map((target) => `${target.displayName} (${target.skillsDir})`)
    .join(', ');

const formatSkillUnit = (count: number): string =>
  count === 1 ? 'skill' : 'skills';

/** User-facing install failure string (prefers `Error.message`). */
export const formatInstallError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const readManifest = async (
  manifestPath: string,
  runtime: InstallCommandRuntime
): Promise<AiPackageManifest> => {
  const raw = await runtime.readTextFile(manifestPath, 'utf-8');
  return parseAiPackageManifest(JSON.parse(raw), manifestPath);
};

/**
 * Normalize a CLI flag value (string, string[], or undefined) into a flat
 * array, splitting on commas and trimming whitespace.
 *
 * @example
 * normalizeList('cursor,claude-code'); // ['cursor', 'claude-code']
 * normalizeList(['a', 'b,c']);         // ['a', 'b', 'c']
 * normalizeList(undefined);            // []
 */
export const normalizeList = (
  value: string | string[] | undefined
): string[] => {
  if (value === undefined) {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) =>
    item
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
};

/**
 * Map `--link` / `--copy` flags to an {@link InstallMode}. Defaults to `'copy'`.
 */
export const resolveInstallMode = (
  options: InstallCommandOptions
): InstallMode => {
  if (options.link === true) {
    return 'link';
  }
  return 'copy';
};

/**
 * Map `--force` / `--skip-existing` flags to a {@link ConflictPolicy}.
 * Validates that the two flags are mutually exclusive.
 *
 * @throws Error when both `--force` and `--skip-existing` are set.
 */
export const resolveConflictPolicy = (
  options: InstallCommandOptions
): ConflictPolicy => {
  if (options.force === true && options.skipExisting === true) {
    throw new Error('--force and --skip-existing are mutually exclusive');
  }
  if (options.force === true) {
    return 'overwrite';
  }
  if (options.skipExisting === true) {
    return 'skip';
  }
  return canPrompt(options) ? 'prompt' : 'fail';
};
