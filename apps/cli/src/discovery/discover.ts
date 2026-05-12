import type { Stats } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, normalize, relative, resolve, sep } from 'node:path';
import { sanitizeManifestPath } from '../manifest';
import { parseSkillFrontmatter } from './frontmatter';

/** Skill metadata discovered from a `SKILL.md` file plus its relative path. */
export type DiscoveredSkill = {
  name: string;
  description?: string;
  path: string;
  absolutePath: string;
  rawSkillMd: string;
};

/** Options for skill discovery: optional scan root override and name filter. */
export type DiscoverSkillsOptions = {
  path?: string;
  skillNames?: string[];
};

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);
const PRIORITY_DIRS = [
  '',
  'skills',
  'skills/.curated',
  'skills/.experimental',
  'skills/.system',
  '.agents/skills',
  '.claude/skills',
  '.codex/skills',
  '.cursor/skills',
  '.cline/skills',
  '.continue/skills',
  '.opencode/skills',
];

/**
 * Discover skill directories under a materialized package source.
 *
 * `--path` is treated as the user's explicit root and must stay inside the
 * package. Without `--path`, discovery checks common agent/skills locations
 * first and only falls back to bounded recursion when no priority match exists.
 */
export const discoverSkills = async (
  rootDir: string,
  options: DiscoverSkillsOptions = {}
): Promise<DiscoveredSkill[]> => {
  const baseDir = resolve(rootDir);
  const searchRoot = options.path
    ? resolveInside(baseDir, sanitizeManifestPath(options.path))
    : baseDir;

  const direct = await readSkill(searchRoot, baseDir);
  const skills = new Map<string, DiscoveredSkill>();
  if (direct) {
    skills.set(direct.name.toLowerCase(), direct);
  }

  if (!direct) {
    for (const dir of PRIORITY_DIRS) {
      const priorityRoot = dir ? join(searchRoot, dir) : searchRoot;
      for (const skill of await discoverOneLevel(priorityRoot, baseDir)) {
        skills.set(skill.name.toLowerCase(), skill);
      }
    }
  }

  if (skills.size === 0) {
    for (const skill of await discoverRecursive(searchRoot, baseDir)) {
      skills.set(skill.name.toLowerCase(), skill);
    }
  }

  const found = [...skills.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  if (!options.skillNames || options.skillNames.length === 0) {
    return found;
  }

  const requested = new Set(
    options.skillNames.map((name) => name.toLowerCase())
  );
  return found.filter((skill) => requested.has(skill.name.toLowerCase()));
};

/**
 * Assert that a directory exists and contains a `SKILL.md` file.
 *
 * @throws Error when the directory is missing, not a directory, or lacks `SKILL.md`.
 */
export const assertSkillDirectory = async (skillDir: string, name: string) => {
  let dirStats: Stats;
  try {
    dirStats = await stat(skillDir);
  } catch {
    throw new Error(`Skill "${name}" path does not exist: ${skillDir}`);
  }

  if (!dirStats.isDirectory()) {
    throw new Error(`Skill "${name}" path must be a directory: ${skillDir}`);
  }

  const skillFile = await stat(join(skillDir, 'SKILL.md')).catch(() => null);
  if (!skillFile?.isFile()) {
    throw new Error(`Skill "${name}" path does not contain SKILL.md`);
  }
};

/**
 * Resolve a subpath under a root directory. Rejects `..` traversals that
 * would escape the root.
 *
 * @throws Error when the resolved path escapes the root directory.
 */
export const resolveInside = (rootDir: string, path: string): string => {
  const root = resolve(rootDir);
  const resolved = resolve(root, path);
  const rel = relative(root, resolved);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..${sep}`)) {
    throw new Error(`Skill path "${path}" must stay inside the source`);
  }

  return resolved;
};

const discoverOneLevel = async (
  dir: string,
  baseDir: string
): Promise<DiscoveredSkill[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const skills: DiscoveredSkill[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const skill = await readSkill(join(dir, entry.name), baseDir);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
};

const discoverRecursive = async (
  dir: string,
  baseDir: string,
  depth = 0
): Promise<DiscoveredSkill[]> => {
  if (depth > 5) {
    return [];
  }

  const current = await readSkill(dir, baseDir);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
      .map((entry) =>
        discoverRecursive(join(dir, entry.name), baseDir, depth + 1)
      )
  );

  return [...(current ? [current] : []), ...nested.flat()];
};

const readSkill = async (
  dir: string,
  baseDir: string
): Promise<DiscoveredSkill | null> => {
  const skillFile = join(dir, 'SKILL.md');
  const fileStats = await stat(skillFile).catch(() => null);
  if (!fileStats?.isFile()) {
    return null;
  }

  const rawSkillMd = await readFile(skillFile, 'utf-8');
  const frontmatter = parseSkillFrontmatter(rawSkillMd);
  const rel = normalize(relative(baseDir, dir)).replace(/\\/g, '/');
  return {
    name: frontmatter.name || basename(dir),
    description: frontmatter.description,
    path: rel || '.',
    absolutePath: dir,
    rawSkillMd,
  };
};
