import { resolve } from 'node:path';
import type { CAC } from 'cac';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolveAgentTargets } from '../agents/targets';
import { canPrompt } from '../cli/ai-mode';
import { discoverSkills } from '../discovery/discover';
import { selectDiscoveredSkills } from '../discovery/select';
import { SilentError } from '../errors';
import { createManifestStore } from '../manifest';
import { installPlan } from '../installer/install';
import {
  createRegistries,
  getRegistry,
  type RegistryKind,
} from '../registries';
import type { SkillEntry } from '../types';
import {
  normalizeList,
  resolveConflictPolicy,
  resolveInstallMode,
  type InstallCommandOptions,
} from '../install-command';

type SkillsCommandRuntime = {
  cwd: string;
};

type SkillsAddOptions = InstallCommandOptions & {
  registry?: RegistryKind;
  ref?: string;
  path?: string;
  skill?: string | string[];
  installOnly?: boolean;
};

export const registerSkillsCommand = (
  cli: CAC,
  runtime: SkillsCommandRuntime
) => {
  cli
    .command('skills [...args]', 'Manage skills')
    .usage('skills <add|list|remove|update|search> [...args] [options]')
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
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('-C, --dir <path>', 'Project directory')
    .option('-m, --manifest <path>', 'Path to ai-package.json')
    .action((args: string[] | undefined, options: SkillsAddOptions) =>
      runSkillsCommand(args ?? [], options, runtime)
    );
};

export const runSkillsCommand = async (
  args: string[],
  options: SkillsAddOptions,
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

  if (subcommand === 'search') {
    throw new SilentError('Marketplace search is not implemented yet');
  }

  throw new SilentError(
    'Usage: ai-pkgs skills <add|list|remove|update|search>'
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
  if (options.installOnly === true && options.manifest) {
    throw new SilentError('--install-only cannot be used with --manifest');
  }

  const registryKind = resolveRegistry(rawSource, options.registry);
  const registries = createRegistries(projectDir);
  const registry = getRegistry(registries, registryKind);

  const resolved = await registry.resolve({
    rawSource,
    registry: registryKind,
    ref: options.ref,
  });
  const requestedSkills = normalizeList(options.skill);
  try {
    const discovered = await discoverSkills(resolved.root.rootDir, {
      path: options.path,
    });
    const selected = await selectDiscoveredSkills({
      skills: discovered,
      requestedNames: requestedSkills,
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
      yes: options.yes === true,
      canPrompt: promptAllowed,
    });
    const result = await installPlan({
      skills: selected.map((skill) => ({
        name: skill.name,
        sourceDir: skill.absolutePath,
      })),
      targets,
      mode: resolveInstallMode(options),
      conflict: resolveConflictPolicy(options),
      canPrompt: promptAllowed,
    });

    for (const skill of result.installed) {
      p.log.success(`${pc.cyan(skill.name)} -> ${pc.dim(skill.targetDir)}`);
    }
    return 0;
  } finally {
    await resolved.root.cleanup?.();
  }
};

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
