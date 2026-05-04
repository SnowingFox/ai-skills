import { resolve } from 'node:path';
import type { CAC } from 'cac';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { match } from 'ts-pattern';
import { resolveAgentTargets } from '../agents/targets';
import { canPrompt, isAICommand } from '../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../cli/ai-output';
import { discoverSkills } from '../discovery/discover';
import { selectDiscoveredSkills } from '../discovery/select';
import { SilentError } from '../errors';
import { GitCommandError, type GitProgressEvent } from '../git';
import { createManifestStore } from '../manifest';
import { installPlan } from '../installer/install';
import {
  createRegistries,
  getRegistry,
  type RegistryKind,
} from '../registries';
import {
  runSkillsVercelMigrateCommand,
  type SkillsVercelMigrateOptions,
} from './skills-vercel-migrate';
import type { SkillEntry } from '../types';
import {
  normalizeList,
  formatInstallResultSummary,
  formatProgress,
  resolveConflictPolicy,
  resolveInstallMode,
  type InstallCommandRuntime,
  type InstallCommandOptions,
} from '../install-command';

type SkillsCommandRuntime = InstallCommandRuntime;

type SkillsAddOptions = InstallCommandOptions & {
  registry?: RegistryKind;
  ref?: string;
  path?: string;
  skill?: string | string[];
  installOnly?: boolean;
  project?: boolean;
  global?: boolean;
  all?: boolean;
  refresh?: boolean;
};

type SkillsCommandOptions = SkillsAddOptions & SkillsVercelMigrateOptions;

export const registerSkillsCommand = (
  cli: CAC,
  runtime: SkillsCommandRuntime
) => {
  cli
    .command('skills [...args]', 'Manage skills')
    .usage(
      'skills <add|list|remove|update|search|vercel-migrate> [...args] [options]'
    )
    .option('--registry <registry>', 'github, gitlab, marketplace, or file')
    .option('--ref <ref>', 'Git ref to pin')
    .option('--path <path>', 'Path to scan inside the source')
    .option('-s, --skill <skill>', 'Skill name to add (repeatable)')
    .option('-a, --agent <agent>', 'Target agent (repeatable)')
    .option('--copy', 'Copy skill directories (default)')
    .option('--link', 'Symlink skill directories')
    .option('--force', 'Overwrite existing skill directories')
    .option('--skip-existing', 'Skip existing skill directories')
    .option('--install-only', 'Install without writing ai-package.json')
    .option('--project', 'Install into project-local agent skill directories')
    .option('--global', 'Install into global agent skill directories')
    .option('--all', 'Select all discovered skills')
    .option('--refresh', 'Refresh Git cache before installing')
    .option('--lockfile <path>', 'Path to legacy skills-lock.json')
    .option('--remove-lock', 'Remove skills-lock.json after migration')
    .option('--install', 'Install migrated ai-package.json after writing')
    .option('--verbose', 'Show per-skill install progress and paths')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-C, --dir <path>', 'Project directory')
    .option('-m, --manifest <path>', 'Path to ai-package.json')
    .action((args: string[] | undefined, options: SkillsCommandOptions) =>
      runSkillsCommand(args ?? [], options, runtime)
    );
};

export const runSkillsCommand = async (
  args: string[],
  options: SkillsCommandOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const [subcommand, ...rest] = args;

  if (subcommand === 'add') {
    const source = rest[0];
    if (!source) {
      throw new SilentError('Usage: ai-pkgs skills add <source> [options]');
    }
    return runSkillsAddCommand(source, options, runtime);
  }

  if (subcommand === 'list') {
    return runSkillsListCommand(options, runtime);
  }

  if (subcommand === 'remove') {
    return runSkillsRemoveCommand(rest, options, runtime);
  }

  if (subcommand === 'update') {
    return runSkillsUpdateCommand(rest, options, runtime);
  }

  if (subcommand === 'vercel-migrate') {
    return runSkillsVercelMigrateCommand(options, runtime);
  }

  if (subcommand === 'search') {
    throw new SilentError('Marketplace search is not implemented yet');
  }

  throw new SilentError(
    'Usage: ai-pkgs skills <add|list|remove|update|search|vercel-migrate>'
  );
};

/**
 * `ai-pkgs skills add <source>` — resolve a source, discover skill folders,
 * write selected entries back to `ai-package.json`, then install them into
 * explicit agent targets.
 *
 * The manifest mutation happens before install so a failed target copy still
 * leaves the user's declarative package file reflecting the requested source.
 * Non-TTY callers must pass both `--skill` when discovery is ambiguous and
 * `--agent` for target selection.
 */
export const runSkillsAddCommand = async (
  rawSource: string,
  options: SkillsAddOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const projectDir = resolve(runtime.cwd, options.dir ?? '.');
  const promptAllowed = canPrompt(options);
  const aiMode = isAICommand(options);
  if (options.installOnly === true && options.manifest) {
    throw new SilentError('--install-only cannot be used with --manifest');
  }
  if (options.project === true && options.global === true) {
    throw new SilentError('--project and --global are mutually exclusive');
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
  const requestedSkills = normalizeList(options.skill);
  if (options.all === true && requestedSkills.length > 0) {
    throw new SilentError('--all cannot be used with --skill');
  }
  try {
    const discovered = await discoverSkills(resolved.root.rootDir, {
      path: options.path,
    });
    const selected = await selectDiscoveredSkills({
      skills: discovered,
      requestedNames: requestedSkills,
      all: options.all === true,
      yes: options.yes === true,
      canPrompt: promptAllowed,
    });

    if (options.installOnly !== true) {
      const manifestSkills: SkillEntry[] = selected.map((skill) => ({
        name: skill.name,
        provider: resolved.provider,
        source: resolved.source,
        packageId: resolved.packageId,
        version: resolved.version,
        ref: resolved.ref,
        commitSha: resolved.commitSha,
        path: skill.path,
        sourceRoot:
          resolved.provider === 'file' ? resolved.root.rootDir : undefined,
      }));
      const store = createManifestStore(projectDir, options.manifest);
      await store.addSkills(manifestSkills);
    }

    const targets = await resolveAgentTargets({
      agentIds: normalizeList(options.agent),
      cwd: projectDir,
      global: await resolveInstallScope(options, promptAllowed),
      yes: options.yes === true,
      canPrompt: promptAllowed,
    });
    const mode = resolveInstallMode(options);
    const result = await installPlan({
      skills: selected.map((skill) => ({
        name: skill.name,
        sourceDir: skill.absolutePath,
      })),
      targets,
      mode,
      conflict: resolveConflictPolicy(options),
      canPrompt: promptAllowed,
      onProgress:
        options.verbose === true
          ? (progress) => {
              const message = formatProgress(progress);
              if (aiMode) {
                process.stdout.write(renderAiStep(message));
              } else {
                p.log.info(message);
              }
            }
          : undefined,
    });

    const installSummary = formatInstallResultSummary({
      installed: result.installed,
      targets,
      mode,
    });
    if (aiMode) {
      process.stdout.write(renderAiStep(installSummary));
    } else {
      p.note(installSummary, 'Installing skills');
    }
    for (const skill of result.installed) {
      if (skill.skipped === true) {
        const message = `skipped: ${skill.name} -> ${skill.targetDir}`;
        if (aiMode) {
          process.stdout.write(renderAiStep(message));
        } else {
          p.log.info(
            `${pc.yellow(skill.name)} skipped -> ${pc.dim(skill.targetDir)}`
          );
        }
      } else if (options.verbose === true) {
        const message = `installed: ${skill.name} -> ${skill.targetDir}`;
        if (aiMode) {
          process.stdout.write(renderAiStep(message));
        } else {
          p.log.success(`${pc.cyan(skill.name)} -> ${pc.dim(skill.targetDir)}`);
        }
      }
    }
    return 0;
  } finally {
    await resolved.root.cleanup?.();
  }
};

/**
 * Resolve the install dimension for `skills add`.
 *
 * TTY users choose between project and global when no flag is present. AI and
 * other non-interactive callers default to project so automated installs never
 * silently write to user-level agent directories.
 *
 * @example
 * ```ts
 * await resolveInstallScope({ global: true }, false); // true
 * await resolveInstallScope({}, false);               // false
 * ```
 */
export const resolveInstallScope = async (
  options: Pick<SkillsAddOptions, 'project' | 'global'>,
  canPromptForScope: boolean
): Promise<boolean> => {
  if (options.project === true && options.global === true) {
    throw new SilentError('--project and --global are mutually exclusive');
  }
  if (options.global === true) {
    return true;
  }
  if (options.project === true || !canPromptForScope) {
    return false;
  }

  const selected = await p.select({
    message: 'Install scope',
    options: [
      {
        label: 'Project',
        value: 'project',
        hint: 'Install inside this repository',
      },
      {
        label: 'Global',
        value: 'global',
        hint: 'Install into user-level agent skills',
      },
    ],
    initialValue: 'project',
  });

  if (p.isCancel(selected)) {
    throw new SilentError('Install scope selection cancelled');
  }

  return selected === 'global';
};

type CloneProgressRenderer = {
  onProgress?: (event: GitProgressEvent) => void;
  done: (ref?: string, commitSha?: string) => void;
  fail: (error: unknown) => void;
};

const createCloneProgressRenderer = ({
  aiMode,
  enabled,
  verbose,
}: {
  aiMode: boolean;
  enabled: boolean;
  verbose: boolean;
}): CloneProgressRenderer => {
  if (!enabled) {
    return {
      done: () => {},
      fail: () => {},
    };
  }

  if (aiMode) {
    let usedCache = false;
    return {
      onProgress: (event) => {
        if (event.status === 'cache-hit') {
          usedCache = true;
        }
        const message = formatCloneProgress(event);
        if (message) {
          process.stdout.write(renderAiStep(message));
        }
      },
      done: (ref, commitSha) => {
        if (usedCache) {
          return;
        }
        process.stdout.write(renderAiDone(formatCloneDone(ref, commitSha)));
      },
      fail: () => {},
    };
  }

  if (process.stdin.isTTY !== true) {
    return {
      done: () => {},
      fail: () => {},
    };
  }

  const spinner = p.spinner();
  let started = false;
  let completed = false;

  return {
    onProgress: (event) => {
      if (isCacheProgressEvent(event)) {
        const message = formatCloneProgress(event);
        if (started && event.status === 'cache-store') {
          started = false;
          completed = true;
          spinner.stop(formatCloneDone(event.ref, event.commitSha));
        }
        if (message) {
          p.note(message, 'Git cache');
        }
        return;
      }

      if (event.status === 'cloning') {
        started = true;
        spinner.start(`Cloning repository: ${event.cloneUrl}`);
        return;
      }

      const message = formatCloneProgress(event);
      if (message && started) {
        spinner.message(message);
      } else if (message && verbose) {
        p.log.info(message);
      }
    },
    done: (ref, commitSha) => {
      if (started && !completed) {
        spinner.stop(formatCloneDone(ref, commitSha));
      }
    },
    fail: () => {
      if (started) {
        spinner.stop(pc.red('Failed to clone repository'));
      }
    },
  };
};

const isCacheProgressEvent = (
  event: GitProgressEvent
): event is Extract<
  GitProgressEvent,
  { status: 'cache-hit' | 'cache-refresh' | 'cache-store' }
> =>
  event.status === 'cache-hit' ||
  event.status === 'cache-refresh' ||
  event.status === 'cache-store';

/**
 * Format Git resolve, clone, and cache events for spinner/static output.
 *
 * @example
 * ```ts
 * formatCloneProgress({
 *   status: 'cache-hit',
 *   provider: 'github',
 *   packageId: 'acme/skills',
 *   ref: 'main',
 *   commitSha: 'abcdef123',
 *   cachePath: '/cache/acme/skills/abcdef123',
 * });
 * // 'reusing Git cache\\nsource: github:acme/skills\\n...'
 * ```
 */
export const formatCloneProgress = (event: GitProgressEvent): string => {
  if (event.status === 'resolving-remote') {
    return `resolving remote ref: ${event.ref ?? 'HEAD'}`;
  }
  if (event.status === 'cloning') {
    return `cloning repository: ${event.cloneUrl}`;
  }
  if (event.status === 'checking-out') {
    return event.commitSha
      ? `checking out commit: ${shortSha(event.commitSha)}`
      : `checking out ref: ${event.ref ?? 'HEAD'}`;
  }
  if (event.status === 'resolved') {
    return `resolving git pin: ${event.ref}@${shortSha(event.commitSha)}`;
  }
  if (event.status === 'cache-hit') {
    return [
      'reusing Git cache',
      `source: ${event.provider}:${event.packageId}`,
      `ref: ${event.ref}@${shortSha(event.commitSha)}`,
      `cache: ${event.cachePath}`,
    ].join('\n');
  }
  if (event.status === 'cache-refresh') {
    return `refreshing Git cache: ${event.cachePath}`;
  }
  if (event.status === 'cache-store') {
    return `stored Git cache: ${event.cachePath}`;
  }
  return '';
};

/**
 * Format the terminal clone success message with the pinned Git version.
 */
export const formatCloneDone = (ref?: string, commitSha?: string): string => {
  if (!ref || !commitSha) {
    return 'Repository cloned';
  }
  return `Repository cloned (${ref}@${shortSha(commitSha)})`;
};

/**
 * Convert classified Git failures into user-facing remediation text.
 */
export const formatGitCloneError = (error: GitCommandError): string => {
  const base = match(error.kind)
    .with(
      'timeout',
      () =>
        'Git clone timed out.\n  - Check your network connection.\n  - Retry later or clone manually and use --registry file.'
    )
    .with(
      'auth',
      () =>
        'Authentication failed while cloning the repository.\n  - For private repos, ensure your account has access.\n  - For HTTPS: run gh auth login or configure git credentials.\n  - For SSH: check keys with ssh -T git@github.com.'
    )
    .with(
      'not-found',
      () =>
        'Repository was not found.\n  - Check the owner/repo or clone URL.\n  - If it is private, confirm your Git credentials have access.'
    )
    .with(
      'ref',
      () =>
        'Git ref checkout failed.\n  - Check the value passed with --ref.\n  - Ensure the branch, tag, or commit exists in the source repository.'
    )
    .with(
      'git-missing',
      () =>
        'Git is not available on this machine.\n  - Install git and ensure it is on PATH.'
    )
    .otherwise(
      () =>
        'Failed to clone repository.\n  - Check the source URL and network connection.\n  - If this is a private repo, configure Git credentials.'
    );

  const detail = error.stderr ? `\n\nGit output:\n${indent(error.stderr)}` : '';
  return `${base}${detail}`;
};

const shortSha = (sha: string): string => sha.slice(0, 7);

const indent = (value: string): string =>
  value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

export const runSkillsListCommand = async (
  options: InstallCommandOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const projectDir = resolve(runtime.cwd, options.dir ?? '.');
  const store = createManifestStore(projectDir, options.manifest);
  const manifest = await store.read();
  for (const skill of manifest.skills) {
    process.stdout.write(
      `${skill.name}\t${skill.source ?? `${skill.provider}:${skill.packageId}`}\t${skill.path}\n`
    );
  }
  return 0;
};

/**
 * Remove manifest entries by name. This intentionally does not delete already
 * installed target directories; uninstalling materialized skill folders can be
 * added later without changing the package-file contract.
 */
export const runSkillsRemoveCommand = async (
  skills: string[],
  options: InstallCommandOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  if (skills.length === 0) {
    throw new SilentError('Pass at least one skill to remove');
  }

  const projectDir = resolve(runtime.cwd, options.dir ?? '.');
  const store = createManifestStore(projectDir, options.manifest);
  await store.removeSkills(skills);
  return 0;
};

/**
 * Refresh Git-backed manifest entries by preserving their stored ref and
 * replacing only the resolved SHA in `<ref>@<sha>`.
 *
 * File sources are left unchanged. Marketplace entries route through the
 * registry boundary and currently emit the deferred Marketplace stub error.
 */
export const runSkillsUpdateCommand = async (
  skills: string[],
  options: InstallCommandOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const projectDir = resolve(runtime.cwd, options.dir ?? '.');
  const store = createManifestStore(projectDir, options.manifest);
  const manifest = await store.read();
  const requested = new Set(skills);
  const registries = createRegistries(projectDir);
  const updated: SkillEntry[] = [];

  for (const skill of manifest.skills) {
    if (requested.size > 0 && !requested.has(skill.name)) {
      updated.push(skill);
      continue;
    }

    if (skill.provider === 'file') {
      updated.push(skill);
      continue;
    }

    const registry = getRegistry(registries, skill.provider);
    if (!registry.update) {
      throw new SilentError(
        `${skill.provider} updates are not implemented yet`
      );
    }

    const resolved = await registry.update(skill);
    await resolved.root.cleanup?.();
    updated.push({
      ...skill,
      source: resolved.source,
      packageId: resolved.packageId,
      version: resolved.version,
      ref: resolved.ref,
      commitSha: resolved.commitSha,
    });
    p.log.success(`${pc.cyan(skill.name)} -> ${resolved.version}`);
  }

  await store.write({ skills: updated });
  return 0;
};

const resolveRegistry = (
  source: string,
  registry: RegistryKind | undefined
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
