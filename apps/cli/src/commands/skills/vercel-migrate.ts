import { readFile, unlink } from 'node:fs/promises';
import { isAbsolute, posix, resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { discoverSkills, type DiscoveredSkill } from '../../discovery/discover';
import { SilentError } from '../../errors';
import {
  type InstallCommandOptions,
  type InstallCommandRuntime,
  runInstallCommand,
} from '../../install-command';
import { createManifestStore } from '../../manifest';
import { sanitizeManifestPath } from '../../manifest/parse';
import { githubRegistry } from '../../registries/github';
import type { ResolvedPackage } from '../../registries/types';
import type {
  AiPackageManifest,
  RemoteSkillEntry,
  SkillEntry,
} from '../../types';

type RawLegacyVercelLockEntry = {
  source?: unknown;
  sourceType?: unknown;
  skillPath?: unknown;
  computedHash?: unknown;
};

type RawLegacyVercelLock = {
  version?: unknown;
  skills?: unknown;
};

export type LegacyVercelLockEntry = {
  name: string;
  source: string;
  sourceType: 'github';
  skillPath?: string;
  computedHash: string;
};

export type PendingVercelMigrationSkill = {
  name: string;
  rawSource: string;
  path?: string;
};

export type ResolvedVercelMigrationSkill = PendingVercelMigrationSkill & {
  path: string;
};

export type VercelMigrationSourcePin = Pick<
  RemoteSkillEntry,
  'provider' | 'source' | 'packageId' | 'version' | 'ref' | 'commitSha'
>;

export type ResolveVercelMigrationSource = (
  rawSource: string
) => Promise<VercelMigrationSourcePin>;

export type DiscoverVercelMigrationSkills = (
  rawSource: string
) => Promise<DiscoveredSkill[]>;

export type SelectVercelMigrationSkillPath = (
  skill: PendingVercelMigrationSkill,
  discovered: DiscoveredSkill[]
) => Promise<string>;

export type VercelMigrationMergePolicy = 'overwrite' | 'skip' | 'fail';

export type VercelMigrationMergeResult = {
  manifest: AiPackageManifest;
  added: string[];
  overwritten: string[];
  skipped: string[];
};

export type SkillsVercelMigrateOptions = InstallCommandOptions & {
  lockfile?: string;
  removeLock?: boolean;
  install?: boolean;
};

const HASH_RE = /^[0-9a-f]{64}$/i;

/**
 * Parse the legacy Vercel `skills-lock.json` shape.
 */
export const parseLegacyVercelSkillsLock = (
  raw: unknown,
  lockPath: string
): LegacyVercelLockEntry[] => {
  if (!isRecord(raw)) {
    throw new Error(`${lockPath} must be a JSON object`);
  }

  const lock = raw as RawLegacyVercelLock;
  if (lock.version !== 1) {
    throw new Error(`${lockPath} must use legacy lock version 1`);
  }

  if (!isRecord(lock.skills)) {
    throw new Error(`${lockPath} must contain a top-level "skills" object`);
  }

  return Object.entries(lock.skills).map(([name, value]) =>
    parseLegacyVercelLockEntry(name, value, lockPath)
  );
};

/**
 * Convert validated lock entries into manifest-ready skill requests.
 */
export const normalizeLegacyVercelLockEntries = (
  entries: LegacyVercelLockEntry[]
): PendingVercelMigrationSkill[] =>
  entries.map((entry) => ({
    name: entry.name,
    rawSource: entry.source,
    path: entry.skillPath
      ? skillPathToManifestPath(entry.skillPath, entry.name)
      : undefined,
  }));

/**
 * Fill missing manifest paths by discovering skills in the materialized source.
 */
export const resolveMissingVercelMigrationPaths = async (
  skills: PendingVercelMigrationSkill[],
  discoverSource: DiscoverVercelMigrationSkills,
  options: {
    canPrompt: boolean;
    selectSkillPath?: SelectVercelMigrationSkillPath;
  }
): Promise<ResolvedVercelMigrationSkill[]> => {
  const discoveredBySource = new Map<string, DiscoveredSkill[]>();
  const resolved: ResolvedVercelMigrationSkill[] = [];

  for (const skill of skills) {
    if (skill.path) {
      resolved.push({
        ...skill,
        path: skill.path,
      });
      continue;
    }

    let discovered = discoveredBySource.get(skill.rawSource);
    if (!discovered) {
      discovered = await discoverSource(skill.rawSource);
      discoveredBySource.set(skill.rawSource, discovered);
    }

    const matches = discovered.filter(
      (candidate) => candidate.name === skill.name
    );
    if (matches.length === 1) {
      resolved.push({
        ...skill,
        path: matches[0]?.path ?? '.',
      });
      continue;
    }

    if (options.canPrompt && options.selectSkillPath) {
      resolved.push({
        ...skill,
        path: await options.selectSkillPath(skill, discovered),
      });
      continue;
    }

    throw new SilentError(formatMissingSkillPathError(skill, discovered));
  }

  return resolved;
};

/**
 * Resolve GitHub pins once per legacy source and return manifest entries.
 */
export const resolveVercelMigrationSkills = async (
  skills: ResolvedVercelMigrationSkill[],
  resolveSource: ResolveVercelMigrationSource
): Promise<RemoteSkillEntry[]> => {
  const pins = new Map<string, VercelMigrationSourcePin>();
  const resolved: RemoteSkillEntry[] = [];

  for (const skill of skills) {
    let pin = pins.get(skill.rawSource);
    if (!pin) {
      pin = await resolveSource(skill.rawSource);
      pins.set(skill.rawSource, pin);
    }

    resolved.push({
      name: skill.name,
      ...pin,
      path: skill.path,
    });
  }

  return resolved;
};

/**
 * Merge migrated skills into the existing manifest using an explicit conflict
 * policy.
 */
export const mergeVercelMigrationSkills = (
  existing: AiPackageManifest,
  migrated: SkillEntry[],
  policy: VercelMigrationMergePolicy
): VercelMigrationMergeResult => {
  const byName = new Map(existing.skills.map((skill) => [skill.name, skill]));
  const added: string[] = [];
  const overwritten: string[] = [];
  const skipped: string[] = [];
  const conflicts = migrated.filter((skill) => byName.has(skill.name));

  if (conflicts.length > 0 && policy === 'fail') {
    throw new SilentError(
      [
        'ai-package.json already contains migrated skill names:',
        formatNameList(conflicts.map((skill) => skill.name)),
        'Pass --force to overwrite them or --skip-existing to keep them.',
      ].join('\n')
    );
  }

  for (const skill of migrated) {
    if (!byName.has(skill.name)) {
      added.push(skill.name);
      byName.set(skill.name, skill);
      continue;
    }

    if (policy === 'skip') {
      skipped.push(skill.name);
      continue;
    }

    overwritten.push(skill.name);
    byName.set(skill.name, skill);
  }

  return {
    manifest: { skills: [...byName.values()].sort(compareByName) },
    added,
    overwritten,
    skipped,
  };
};

/**
 * Execute `ai-pkgs skills vercel-migrate`.
 */
export const runSkillsVercelMigrateCommand = async (
  options: SkillsVercelMigrateOptions,
  runtime: InstallCommandRuntime
): Promise<number> => {
  if (options.global === true) {
    throw new SilentError('skills vercel-migrate does not support --global');
  }
  if (options.force === true && options.skipExisting === true) {
    throw new SilentError('--force and --skip-existing are mutually exclusive');
  }

  const projectDir = resolve(runtime.cwd, options.dir ?? '.');
  const lockPath = resolveLockfilePath(
    projectDir,
    options.lockfile ?? 'skills-lock.json'
  );
  const store = createManifestStore(projectDir, options.manifest);
  const aiMode = isAICommand(options);
  const promptAllowed = canPrompt(options);
  const rawLock = JSON.parse(await readFile(lockPath, 'utf-8'));
  const lockEntries = parseLegacyVercelSkillsLock(rawLock, lockPath);

  if (lockEntries.length === 0) {
    writeMigrationMessage('No skills found in skills-lock.json', aiMode);
    return 0;
  }

  const sourceCache = createGithubMigrationSourceCache(options);
  try {
    const pending = normalizeLegacyVercelLockEntries(lockEntries);
    const resolvedPaths = await resolveMissingVercelMigrationPaths(
      pending,
      sourceCache.discoverSource,
      {
        canPrompt: promptAllowed,
        selectSkillPath: promptAllowed ? selectMissingSkillPath : undefined,
      }
    );
    const migrated = await resolveVercelMigrationSkills(
      resolvedPaths,
      sourceCache.resolveSource
    );
    const existing = await readExistingManifest(store);
    const conflicts = findConflictingSkillNames(existing, migrated);
    const policy = await resolveVercelMigrationMergePolicy(
      options,
      promptAllowed,
      conflicts
    );
    const result = mergeVercelMigrationSkills(existing, migrated, policy);

    await store.write(result.manifest);
    writeMigrationSummary(result, store.path, aiMode);

    if (options.removeLock === true) {
      await unlink(lockPath);
      writeMigrationMessage(`Removed ${lockPath}`, aiMode);
    }

    const installNow = await shouldInstallAfterMigration(
      options,
      promptAllowed,
      runtime
    );
    if (!installNow) {
      return 0;
    }

    return runInstallCommand(options, runtime);
  } finally {
    await sourceCache.cleanup();
  }
};

/**
 * Resolve a lockfile path relative to the selected project directory.
 */
export const resolveLockfilePath = (
  projectDir: string,
  lockfilePath: string
): string => {
  if (isAbsolute(lockfilePath)) {
    return lockfilePath;
  }

  return resolve(projectDir, lockfilePath);
};

const parseLegacyVercelLockEntry = (
  name: string,
  raw: unknown,
  lockPath: string
): LegacyVercelLockEntry => {
  if (!isValidSkillName(name)) {
    throw new Error(`Invalid legacy skill name "${name}" in ${lockPath}`);
  }
  if (!isRecord(raw)) {
    throw new Error(`Legacy skill "${name}" must be an object`);
  }

  const entry = raw as RawLegacyVercelLockEntry;
  if (entry.sourceType !== 'github') {
    throw new Error(
      `Legacy skill "${name}" sourceType must be "github"; other sources are not supported yet`
    );
  }
  if (typeof entry.source !== 'string' || entry.source.trim().length === 0) {
    throw new Error(`Legacy skill "${name}" source is required`);
  }
  const source = normalizeLegacyGithubSource(entry.source, name);
  if (
    entry.skillPath !== undefined &&
    (typeof entry.skillPath !== 'string' || entry.skillPath.trim().length === 0)
  ) {
    throw new Error(
      `Legacy skill "${name}" skillPath must be a non-empty string when provided`
    );
  }
  if (
    typeof entry.computedHash !== 'string' ||
    !HASH_RE.test(entry.computedHash)
  ) {
    throw new Error(
      `Legacy skill "${name}" computedHash must be a 64-character hex digest`
    );
  }

  return {
    name,
    source,
    sourceType: 'github',
    skillPath: entry.skillPath,
    computedHash: entry.computedHash,
  };
};

const normalizeLegacyGithubSource = (source: string, skillName: string) => {
  const normalized = source.trim().replace(/^github:/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length !== 2 || normalized.includes('://')) {
    throw new Error(
      `Legacy skill "${skillName}" source must use GitHub owner/repo`
    );
  }

  return `${segments[0]}/${segments[1]?.replace(/\.git$/, '')}`;
};

const skillPathToManifestPath = (
  skillPath: string,
  skillName: string
): string => {
  const normalized = sanitizeManifestPath(
    skillPath,
    `Legacy skill "${skillName}" skillPath`
  );
  if (normalized !== 'SKILL.md' && !normalized.endsWith('/SKILL.md')) {
    throw new Error(
      `Legacy skill "${skillName}" skillPath must point to SKILL.md`
    );
  }

  return posix.dirname(normalized);
};

const createGithubMigrationSourceCache = (
  options: Pick<SkillsVercelMigrateOptions, 'refresh'>
) => {
  const cache = new Map<
    string,
    {
      resolved: ResolvedPackage;
      discovered?: DiscoveredSkill[];
    }
  >();

  const getResolved = async (rawSource: string) => {
    const cached = cache.get(rawSource);
    if (cached) {
      return cached.resolved;
    }

    const resolved = await githubRegistry.resolve({
      rawSource,
      registry: 'github',
      refresh: options.refresh,
    });
    cache.set(rawSource, { resolved });
    return resolved;
  };

  return {
    resolveSource: async (rawSource: string) =>
      toMigrationSourcePin(await getResolved(rawSource)),
    discoverSource: async (rawSource: string) => {
      const resolved = await getResolved(rawSource);
      const cached = cache.get(rawSource);
      if (cached?.discovered) {
        return cached.discovered;
      }

      const discovered = await discoverSkills(resolved.root.rootDir);
      cache.set(rawSource, { resolved, discovered });
      return discovered;
    },
    cleanup: async () => {
      await Promise.all(
        [...cache.values()].map(({ resolved }) => resolved.root.cleanup?.())
      );
    },
  };
};

const toMigrationSourcePin = (
  resolved: ResolvedPackage
): VercelMigrationSourcePin => {
  if (
    resolved.provider !== 'github' ||
    !resolved.version ||
    !resolved.ref ||
    !resolved.commitSha
  ) {
    throw new Error('GitHub migration source did not resolve a pinned version');
  }

  return {
    provider: 'github',
    source: resolved.source,
    packageId: resolved.packageId,
    version: resolved.version,
    ref: resolved.ref,
    commitSha: resolved.commitSha,
  };
};

const readExistingManifest = async (
  store: ReturnType<typeof createManifestStore>
): Promise<AiPackageManifest> => {
  try {
    return await store.read();
  } catch (error) {
    if (isNotFoundError(error)) {
      return { skills: [] };
    }
    throw error;
  }
};

const resolveVercelMigrationMergePolicy = async (
  options: Pick<SkillsVercelMigrateOptions, 'force' | 'skipExisting'>,
  promptAllowed: boolean,
  conflicts: string[]
): Promise<VercelMigrationMergePolicy> => {
  if (options.force === true) {
    return 'overwrite';
  }
  if (options.skipExisting === true) {
    return 'skip';
  }
  if (conflicts.length === 0) {
    return 'fail';
  }
  if (!promptAllowed) {
    return 'fail';
  }

  const selected = await p.select({
    message: `ai-package.json already contains ${formatNameList(conflicts)}`,
    options: [
      {
        label: 'Overwrite existing manifest entries',
        value: 'overwrite',
      },
      {
        label: 'Skip existing manifest entries',
        value: 'skip',
      },
    ],
    initialValue: 'skip',
  });

  if (p.isCancel(selected)) {
    throw new SilentError('Vercel skills migration cancelled');
  }

  return selected as VercelMigrationMergePolicy;
};

const shouldInstallAfterMigration = async (
  options: Pick<SkillsVercelMigrateOptions, 'install' | 'yes'>,
  promptAllowed: boolean,
  runtime: Pick<InstallCommandRuntime, 'confirm'>
): Promise<boolean> => {
  if (options.install === true) {
    return true;
  }
  if (!promptAllowed || options.yes === true) {
    return false;
  }

  const confirmed = await runtime.confirm({
    message: 'Install migrated ai-package.json now?',
    initialValue: false,
  });

  if (p.isCancel(confirmed)) {
    throw new SilentError('Vercel skills migration cancelled');
  }

  return confirmed === true;
};

const selectMissingSkillPath: SelectVercelMigrationSkillPath = async (
  skill,
  discovered
) => {
  if (discovered.length === 0) {
    throw new SilentError(formatMissingSkillPathError(skill, discovered));
  }

  const selected = await p.select({
    message: `Select skill path for legacy skill "${skill.name}"`,
    options: discovered.map((candidate) => ({
      label: `${candidate.name} (${candidate.path})`,
      value: candidate.path,
      hint: candidate.description,
    })),
  });

  if (p.isCancel(selected)) {
    throw new SilentError('Vercel skills migration cancelled');
  }

  return String(selected);
};

const findConflictingSkillNames = (
  existing: AiPackageManifest,
  migrated: SkillEntry[]
): string[] => {
  const existingNames = new Set(existing.skills.map((skill) => skill.name));
  return migrated
    .filter((skill) => existingNames.has(skill.name))
    .map((skill) => skill.name)
    .sort();
};

const writeMigrationSummary = (
  result: VercelMigrationMergeResult,
  manifestPath: string,
  aiMode: boolean
) => {
  const lines = [
    `updated: ${manifestPath}`,
    `added: ${result.added.length}`,
    `overwritten: ${result.overwritten.length}`,
    `skipped: ${result.skipped.length}`,
  ];
  writeMigrationMessage(lines.join('\n'), aiMode);
};

const writeMigrationMessage = (message: string, aiMode: boolean) => {
  if (aiMode) {
    process.stdout.write(renderAiStep(message));
    if (message.startsWith('updated:')) {
      process.stdout.write(renderAiDone('Vercel skills migration complete'));
    }
    return;
  }

  if (message.startsWith('updated:')) {
    p.note(message, 'Vercel skills migration');
    p.log.success(pc.green('Vercel skills migration complete'));
    return;
  }

  p.log.info(message);
};

const formatMissingSkillPathError = (
  skill: PendingVercelMigrationSkill,
  discovered: DiscoveredSkill[]
): string => {
  const lines = [
    `Could not infer skillPath for legacy skill "${skill.name}".`,
    'Add skillPath to skills-lock.json and rerun.',
  ];

  if (discovered.length > 0) {
    lines.push('', 'Available skills:');
    for (const candidate of discovered) {
      lines.push(`  - ${candidate.name} (${candidate.path})`);
    }
  }

  return lines.join('\n');
};

const formatNameList = (names: string[]): string => names.join(', ');

const compareByName = (a: SkillEntry, b: SkillEntry) =>
  a.name.localeCompare(b.name);

const isValidSkillName = (name: string): boolean =>
  name.trim().length > 0 &&
  name !== '.' &&
  name !== '..' &&
  !name.includes('/') &&
  !name.includes('\\');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNotFoundError = (error: unknown): boolean =>
  isRecord(error) && error.code === 'ENOENT';
