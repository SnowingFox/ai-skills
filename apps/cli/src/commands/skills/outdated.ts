import * as p from '@clack/prompts';
import { isAICommand } from '../../cli/ai-mode';
import { SilentError } from '../../errors';
import { resolveRemoteRef, type ResolvedRemoteRef } from '../../git';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { AiPackageManifest, SkillEntry } from '../../types';
import type { SkillsCommandRuntime } from './types';

/**
 * Discriminated union for per-skill update check outcome.
 * Each variant carries enough context for the UI formatter to render
 * a meaningful line.
 */
export type SkillUpdateStatus =
  | {
      status: 'outdated';
      skill: SkillEntry;
      ref: string;
      currentSha: string;
      latestSha: string;
    }
  | {
      status: 'up-to-date';
      skill: SkillEntry;
      ref: string;
      currentSha: string;
    }
  | {
      status: 'skipped';
      skill: SkillEntry;
      reason: string;
    }
  | {
      status: 'failed';
      skill: SkillEntry;
      reason: string;
    };

/** Aggregated result of an update check across all manifest skills. */
export type SkillUpdateCheckResult = {
  outdated: Extract<SkillUpdateStatus, { status: 'outdated' }>[];
  upToDate: Extract<SkillUpdateStatus, { status: 'up-to-date' }>[];
  skipped: Extract<SkillUpdateStatus, { status: 'skipped' }>[];
  failed: Extract<SkillUpdateStatus, { status: 'failed' }>[];
};

/** Optional injectable `resolveRef` for tests or custom remote resolution. */
export type CheckSkillUpdatesOptions = {
  resolveRef?: (request: {
    provider: 'github' | 'gitlab';
    packageId: string;
    cloneUrl: string;
    ref: string;
  }) => Promise<ResolvedRemoteRef>;
};

/**
 * Check all or selected manifest skills for Git pin updates.
 *
 * Git checks are grouped by provider, packageId, and ref so multiple skills
 * from the same source/ref perform one remote ref lookup.
 */
export const checkSkillUpdates = async (
  manifest: AiPackageManifest,
  requestedNames: string[] = [],
  options: CheckSkillUpdatesOptions = {}
): Promise<SkillUpdateCheckResult> => {
  const selected = selectManifestSkills(manifest.skills, requestedNames);
  const result: SkillUpdateCheckResult = {
    outdated: [],
    upToDate: [],
    skipped: [],
    failed: [],
  };
  const grouped = new Map<string, SkillEntry[]>();

  for (const skill of selected) {
    if (skill.provider === 'file') {
      result.skipped.push({
        status: 'skipped',
        skill,
        reason: 'file sources are not Git-updatable',
      });
      continue;
    }
    if (skill.provider === 'marketplace') {
      result.skipped.push({
        status: 'skipped',
        skill,
        reason: 'marketplace updates are not implemented yet',
      });
      continue;
    }
    if (!skill.ref || !skill.commitSha) {
      result.failed.push({
        status: 'failed',
        skill,
        reason: 'missing ref or commitSha in ai-package.json',
      });
      continue;
    }

    const key = updateGroupKey(skill.provider, skill.packageId, skill.ref);
    grouped.set(key, [...(grouped.get(key) ?? []), skill]);
  }

  for (const group of grouped.values()) {
    const first = group[0];
    if (
      !first ||
      (first.provider !== 'github' && first.provider !== 'gitlab')
    ) {
      continue;
    }

    try {
      const latest = await (options.resolveRef ?? defaultResolveRef)({
        provider: first.provider,
        packageId: first.packageId,
        cloneUrl: cloneUrlForSkill({
          ...first,
          provider: first.provider,
        }),
        ref: first.ref ?? 'HEAD',
      });
      for (const skill of group) {
        const currentSha = skill.commitSha ?? '';
        if (latest.commitSha === currentSha) {
          result.upToDate.push({
            status: 'up-to-date',
            skill,
            ref: latest.ref,
            currentSha,
          });
        } else {
          result.outdated.push({
            status: 'outdated',
            skill,
            ref: latest.ref,
            currentSha,
            latestSha: latest.commitSha,
          });
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      for (const skill of group) {
        result.failed.push({ status: 'failed', skill, reason });
      }
    }
  }

  result.outdated.sort(compareStatuses);
  result.upToDate.sort(compareStatuses);
  result.skipped.sort(compareStatuses);
  result.failed.sort(compareStatuses);
  return result;
};

/**
 * Execute `ai-pkgs skills outdated`.
 */
export const runSkillsOutdatedCommand = async (
  skills: string[],
  options: { dir?: string; global?: boolean; manifest?: string; ai?: boolean },
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const result = await checkSkillUpdates(manifest, skills);
  writeUpdateCheckResult(result, {
    title: 'Skill updates',
    aiMode: isAICommand(options),
  });
  return result.failed.length > 0 ? 1 : 0;
};

/**
 * Format update check groups as stable ASCII text.
 */
export const formatUpdateCheckResult = (
  result: SkillUpdateCheckResult,
  options: { includeUpToDate?: boolean } = {}
): string => {
  const lines: string[] = [`outdated: ${result.outdated.length}`];
  for (const item of result.outdated) {
    lines.push(formatOutdatedLine(item));
  }

  if (options.includeUpToDate !== false) {
    lines.push(`up-to-date: ${result.upToDate.length}`);
    for (const item of result.upToDate) {
      lines.push(
        `- ${item.skill.name} ${item.ref}@${shortSha(item.currentSha)}`
      );
    }
  }

  lines.push(`skipped: ${result.skipped.length}`);
  for (const item of result.skipped) {
    lines.push(`- ${item.skill.name} ${item.reason}`);
  }

  if (result.failed.length > 0) {
    lines.push(`failed: ${result.failed.length}`);
    for (const item of result.failed) {
      lines.push(`- ${item.skill.name} ${item.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

/**
 * Write the update check result to stdout (plain text) or as a Clack note
 * (TTY), depending on the current output mode.
 */
export const writeUpdateCheckResult = (
  result: SkillUpdateCheckResult,
  options: { title: string; aiMode: boolean; includeUpToDate?: boolean }
) => {
  const output = formatUpdateCheckResult(result, {
    includeUpToDate: options.includeUpToDate,
  });

  if (!options.aiMode && process.stdin.isTTY === true) {
    p.note(output.trimEnd(), options.title);
    return;
  }

  process.stdout.write(output);
};

/** Format one outdated skill entry as `- name ref@old -> ref@new`. */
export const formatOutdatedLine = (
  item: Extract<SkillUpdateStatus, { status: 'outdated' }>
): string =>
  `- ${item.skill.name} ${item.ref}@${shortSha(item.currentSha)} -> ${item.ref}@${shortSha(item.latestSha)}`;

const selectManifestSkills = (
  skills: SkillEntry[],
  requestedNames: string[]
): SkillEntry[] => {
  if (requestedNames.length === 0) {
    return skills;
  }

  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  const missing = requestedNames.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new SilentError(
      [
        `Unknown skill name${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
        `Available skills: ${skills
          .map((skill) => skill.name)
          .sort()
          .join(', ')}`,
      ].join('\n')
    );
  }

  return requestedNames.map((name) => byName.get(name)).filter(isSkillEntry);
};

const defaultResolveRef: NonNullable<
  CheckSkillUpdatesOptions['resolveRef']
> = async ({ cloneUrl, ref }) => resolveRemoteRef({ cloneUrl, ref });

const updateGroupKey = (
  provider: string,
  packageId: string,
  ref: string
): string => `${provider}\0${packageId}\0${ref}`;

const cloneUrlForSkill = (
  skill: SkillEntry & { provider: 'github' | 'gitlab' }
): string => {
  if (skill.cloneUrl) {
    return skill.cloneUrl;
  }
  if (skill.provider === 'github') {
    return `https://github.com/${skill.packageId.replace(/\.git$/, '')}.git`;
  }
  return skill.packageId;
};

const compareStatuses = (
  a: Pick<SkillUpdateStatus, 'skill'>,
  b: Pick<SkillUpdateStatus, 'skill'>
) => a.skill.name.localeCompare(b.skill.name);

const isSkillEntry = (value: SkillEntry | undefined): value is SkillEntry =>
  value !== undefined;

const shortSha = (sha: string): string => sha.slice(0, 7);
