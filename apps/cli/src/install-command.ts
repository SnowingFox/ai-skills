import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { match } from 'ts-pattern';
import { resolveAgentTargets } from './agents/targets';
import { canPrompt, isAICommand } from './cli/ai-mode';
import { renderAiDone, renderAiStep } from './cli/ai-output';
import { SilentError } from './errors';
import { installSkills } from './install';
import { parseAiPackageManifest } from './manifest';
import type {
  AiPackageManifest,
  ConflictPolicy,
  InstallMode,
  InstallProgress,
} from './types';

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
};

export type ReadTextFile = (
  path: string,
  encoding: BufferEncoding
) => Promise<string>;

export type InstallCommandRuntime = {
  cwd: string;
  confirm: typeof p.confirm;
  install: typeof installSkills;
  readTextFile: ReadTextFile;
};

export type InstallCommandRuntimeOverrides = Partial<
  Omit<InstallCommandRuntime, 'cwd'>
>;

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
  p.intro(pc.bold('AI package skills installer'));

  try {
    const aiMode = isAICommand(options);
    const promptAllowed = canPrompt(options);
    const projectDir = resolve(runtime.cwd, options.dir ?? '.');
    const manifestPath = resolveManifestPath(
      projectDir,
      options.manifest ?? 'ai-package.json'
    );
    const manifest = await readManifest(manifestPath, runtime);

    if (manifest.skills.length === 0) {
      p.outro(pc.yellow('No skills declared in ai-package.json'));
      return 0;
    }

    p.note(formatSkillSummary(manifest), 'Install plan');

    if (options.yes !== true) {
      if (aiMode) {
        throw new SilentError(
          'Pass --yes when using --ai with install to confirm the install plan.'
        );
      }
      const confirmed = await runtime.confirm({
        message: buildConfirmMessage(manifest.skills.length),
        initialValue: true,
      });

      if (confirmed !== true) {
        p.cancel('Install cancelled');
        return 1;
      }
    }

    const targets = await resolveAgentTargets({
      agentIds: normalizeList(options.agent),
      cwd: projectDir,
      yes: options.yes === true,
      canPrompt: promptAllowed,
    });
    const spinner = aiMode ? undefined : p.spinner();
    if (aiMode) {
      process.stdout.write(renderAiStep('Installing skills'));
    } else {
      spinner?.start('Installing skills');
    }
    const result = await runtime.install({
      manifest,
      projectDir,
      targets,
      mode: resolveInstallMode(options),
      conflict: resolveConflictPolicy(options),
      canPrompt: promptAllowed,
      onProgress: (progress) => {
        const message = formatProgress(progress);
        if (aiMode) {
          process.stdout.write(renderAiStep(message));
        } else {
          spinner?.message(message);
        }
      },
    });

    if (aiMode) {
      process.stdout.write(
        renderAiDone(`Installed ${result.installed.length} skill(s)`)
      );
    } else {
      spinner?.stop(`Installed ${result.installed.length} skill(s)`);
    }
    for (const skill of result.installed) {
      p.log.success(`${pc.cyan(skill.name)} -> ${pc.dim(skill.targetDir)}`);
    }
    p.outro(pc.green('Skills install complete'));
    return 0;
  } catch (error) {
    p.log.error(formatInstallError(error));
    if (error instanceof SilentError) {
      p.log.info('Run ai-pkgs install -h for detailed usage.');
    }
    p.outro(pc.red('Skills install failed'));
    return 1;
  }
};

export const resolveManifestPath = (
  projectDir: string,
  manifestPath: string
): string => {
  if (isAbsolute(manifestPath)) {
    return manifestPath;
  }

  return resolve(projectDir, manifestPath);
};

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

export const buildConfirmMessage = (count: number): string =>
  `Install ${count} skill${count === 1 ? '' : 's'}?`;

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

export const resolveInstallMode = (
  options: InstallCommandOptions
): InstallMode => {
  if (options.link === true) {
    return 'link';
  }
  return 'copy';
};

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
