import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { match } from 'ts-pattern';
import { resolveAgentTargets } from '../../agents/targets';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { discoverSkills } from '../../discovery/discover';
import { selectDiscoveredSkills } from '../../discovery/select';
import { SilentError } from '../../errors';
import { GitCommandError, type GitProgressEvent } from '../../git';
import {
  formatInstallResultSummary,
  formatProgress,
  normalizeList,
  resolveConflictPolicy,
  resolveInstallMode,
} from '../../install-command';
import { installPlan } from '../../installer/install';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import {
  createRegistries,
  getRegistry,
  type RegistryKind,
} from '../../registries';
import type { ResolvedPackage } from '../../registries/types';
import type { SkillEntry } from '../../types';
import type { SkillsAddOptions, SkillsCommandRuntime } from './types';

/**
 * `ai-pkgs skills add <source>` resolves a source, writes selected manifest
 * entries, then installs the chosen skills into explicit agent targets.
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
      const manifestScope = resolveManifestScope(runtime.cwd, options);
      const manifestSkills: SkillEntry[] = selected.map((skill) => ({
        name: skill.name,
        provider: resolved.provider,
        source: resolveManifestSource(resolved, manifestScope.global),
        packageId: resolveManifestPackageId(resolved, manifestScope.global),
        version: resolved.version,
        ref: resolved.ref,
        commitSha: resolved.commitSha,
        path: skill.path,
        sourceRoot:
          resolved.provider === 'file' ? resolved.root.rootDir : undefined,
      }));
      const store = createManifestStore(
        manifestScope.projectDir,
        manifestScope.manifestPath
      );
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
      'reusing Git cache for verified remote ref',
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

/**
 * Select the source registry for `skills add`.
 *
 * GitHub owner/repo shorthand remains the default, while complete non-GitHub
 * clone URLs route through the GitLab registry because it preserves arbitrary
 * HTTPS and SSH origins in the manifest.
 *
 * @example
 * ```ts
 * resolveRegistry('vercel-labs/skills'); // 'github'
 * resolveRegistry('https://self-hosted-gitlab.yourcompany.com/your-skills-repo/skills.git'); // 'gitlab'
 * ```
 */
export const resolveRegistry = (
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
  if (isFullGitCloneUrl(source)) {
    return registry ?? 'gitlab';
  }
  return registry ?? 'github';
};

const isFullGitCloneUrl = (source: string): boolean =>
  /^https?:\/\//.test(source) || /^git@[^:]+:.+/.test(source);

const resolveManifestSource = (
  resolved: ResolvedPackage,
  global: boolean
): string | undefined => {
  if (resolved.provider !== 'file' || !global) {
    return resolved.source;
  }
  return `file:${resolved.root.rootDir}`;
};

const resolveManifestPackageId = (
  resolved: ResolvedPackage,
  global: boolean
): string => {
  if (resolved.provider !== 'file' || !global) {
    return resolved.packageId;
  }
  return resolved.root.rootDir;
};

const shortSha = (sha: string): string => sha.slice(0, 7);

const indent = (value: string): string =>
  value
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
