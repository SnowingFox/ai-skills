import { dirname, isAbsolute, resolve } from 'node:path';
import type {
  AiPackageManifest,
  FileSkillEntry,
  RemoteSkillEntry,
  SkillEntry,
  SkillProvider,
} from '../types';
import type { RawAiPackageManifest, RawSkillEntry } from './types';

const COMMIT_SHA_RE = /^[0-9a-f]{7,40}$/i;
const PROVIDERS = new Set<SkillProvider>([
  'github',
  'gitlab',
  'marketplace',
  'file',
]);

export const parseAiPackageManifest = (
  raw: unknown,
  manifestPath: string
): AiPackageManifest => {
  if (!isRecord(raw)) {
    throw new Error(`${manifestPath} must be a JSON object`);
  }

  const manifest = raw as RawAiPackageManifest;
  if (manifest.skills === undefined) {
    if (manifest.skill !== undefined) {
      throw new Error(
        `${manifestPath} must use the top-level "skills" object, not "skill"`
      );
    }
    throw new Error(`${manifestPath} must contain a top-level "skills" object`);
  }

  if (!isRecord(manifest.skills)) {
    throw new Error(`${manifestPath} top-level "skills" must be an object`);
  }

  const manifestDir = dirname(resolve(manifestPath));
  const skills = Object.entries(manifest.skills).map(([name, value]) =>
    parseSkillEntry(name, value, manifestDir)
  );

  return { skills };
};

/**
 * Validate and normalize one manifest skill entry.
 *
 * The parser accepts Marketplace locators so manifests round-trip cleanly, but
 * network behavior remains behind the registry layer. GitLab entries require a
 * full clone URL to preserve self-hosted origins.
 */
export const parseSkillEntry = (
  name: string,
  raw: unknown,
  manifestDir: string
): SkillEntry => {
  validateSkillName(name);

  if (!isRecord(raw)) {
    throw new Error(`Skill "${name}" must be an object`);
  }

  const entry = raw as RawSkillEntry;
  if (typeof entry.source !== 'string' || entry.source.trim().length === 0) {
    throw new Error(`Skill "${name}" source is required`);
  }

  if (typeof entry.path !== 'string' || entry.path.trim().length === 0) {
    throw new Error(`Skill "${name}" path is required`);
  }

  const source = parseSourceLocator(entry.source, name);
  const path = sanitizeManifestPath(entry.path, `Skill "${name}" path`);

  if (source.provider === 'file') {
    return {
      name,
      provider: 'file',
      source: entry.source,
      packageId: source.packageId,
      sourceRoot: resolveFileSource(manifestDir, source.packageId),
      path,
    } satisfies FileSkillEntry;
  }

  const version = parseRemoteVersion(entry.version, name);
  return {
    name,
    provider: source.provider,
    source: entry.source,
    packageId: source.packageId,
    version: version.raw,
    ref: version.ref,
    commitSha: version.commitSha,
    path,
  } satisfies RemoteSkillEntry;
};

/**
 * Split a manifest source locator (`github:owner/repo`,
 * `gitlab:https://host/group/repo.git`, `file:.`, or
 * `marketplace:owner/package`) and apply provider-specific shape checks.
 */
export const parseSourceLocator = (
  source: string,
  skillName = 'skill'
): { provider: SkillProvider; packageId: string } => {
  const separator = source.indexOf(':');
  if (separator <= 0) {
    throw new Error(
      `Skill "${skillName}" source must use <provider>:<package-id>`
    );
  }

  const provider = source.slice(0, separator) as SkillProvider;
  const packageId =
    provider === 'file'
      ? source.slice(separator + 1)
      : source.slice(separator + 1).trim();

  if (!PROVIDERS.has(provider)) {
    throw new Error(`Unsupported source provider "${provider}"`);
  }

  if (packageId.trim().length === 0) {
    throw new Error(`Skill "${skillName}" source package id is required`);
  }

  validateProviderPackageId(provider, packageId, skillName);
  return { provider, packageId };
};

export const parseRemoteVersion = (
  version: unknown,
  skillName: string
): { raw: string; ref: string; commitSha: string } => {
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(
      `Skill "${skillName}" version is required for remote sources`
    );
  }

  const separator = version.lastIndexOf('@');
  if (separator <= 0 || separator === version.length - 1) {
    throw new Error(`Skill "${skillName}" version must use <ref>@<commitSha>`);
  }

  const ref = version.slice(0, separator);
  const commitSha = version.slice(separator + 1);
  if (
    !COMMIT_SHA_RE.test(commitSha) &&
    !version.includes('@sha256:') &&
    !commitSha.startsWith('sha256:')
  ) {
    throw new Error(`Skill "${skillName}" version must use <ref>@<commitSha>`);
  }

  return { raw: version, ref, commitSha };
};

export const sanitizeManifestPath = (path: string, label = 'path'): string => {
  const normalized = path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
  if (normalized.length === 0) {
    throw new Error(`${label} is required`);
  }

  if (isAbsolute(normalized)) {
    throw new Error(`${label} must stay inside the source`);
  }

  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new Error(`${label} must stay inside the source`);
  }

  return normalized;
};

const validateProviderPackageId = (
  provider: SkillProvider,
  packageId: string,
  skillName: string
) => {
  if (provider === 'github') {
    const segments = packageId.split('/').filter(Boolean);
    if (segments.length !== 2) {
      throw new Error(
        `Skill "${skillName}" github source must use github:owner/repo`
      );
    }
  }

  if (provider === 'gitlab') {
    if (!/^https?:\/\/.+/.test(packageId) && !/^git@[^:]+:.+/.test(packageId)) {
      throw new Error(
        `Skill "${skillName}" gitlab source must use gitlab:https://host/group/repo.git`
      );
    }
  }
};

const validateSkillName = (name: string) => {
  if (
    name.trim().length === 0 ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\')
  ) {
    throw new Error(`Invalid skill name "${name}"`);
  }
};

const resolveFileSource = (manifestDir: string, packageId: string): string => {
  if (isAbsolute(packageId)) {
    return resolve(packageId);
  }

  return resolve(manifestDir, packageId);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
