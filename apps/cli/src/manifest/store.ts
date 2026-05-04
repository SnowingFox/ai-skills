import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type { AiPackageManifest, SkillEntry } from '../types';
import { parseAiPackageManifest } from './parse';

export type ManifestStore = {
  path: string;
  read: () => Promise<AiPackageManifest>;
  write: (manifest: AiPackageManifest) => Promise<void>;
  addSkills: (skills: SkillEntry[]) => Promise<AiPackageManifest>;
  removeSkills: (names: string[]) => Promise<AiPackageManifest>;
};

/**
 * Open an `ai-package.json` as a small mutation-oriented store.
 *
 * Reads always validate through the manifest parser, while writes are
 * deterministic JSON sorted by skill name. `skills add/remove/update` use this
 * instead of ad-hoc object mutation so command behavior stays testable.
 */
export const createManifestStore = (
  projectDir: string,
  manifestPath = 'ai-package.json'
): ManifestStore => {
  const path = resolveManifestPath(projectDir, manifestPath);

  const read = async () => {
    const raw = await readFile(path, 'utf-8');
    return parseAiPackageManifest(JSON.parse(raw), path);
  };

  const write = async (manifest: AiPackageManifest) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, serializeManifest(manifest), 'utf-8');
  };

  return {
    path,
    read,
    write,
    addSkills: async (skills) => {
      const existing = await read().catch(() => ({ skills: [] }));
      const byName = new Map(
        existing.skills.map((skill) => [skill.name, skill])
      );
      for (const skill of skills) {
        byName.set(skill.name, skill);
      }
      const next = { skills: [...byName.values()].sort(compareByName) };
      await write(next);
      return next;
    },
    removeSkills: async (names) => {
      const remove = new Set(names);
      const existing = await read();
      const next = {
        skills: existing.skills
          .filter((skill) => !remove.has(skill.name))
          .sort(compareByName),
      };
      await write(next);
      return next;
    },
  };
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

/**
 * Serialize the normalized manifest back to the user-editable file shape.
 * Runtime-only fields such as `sourceRoot` and resolved clone paths are never
 * written; the manifest remains `{ source, version?, path }` per skill.
 */
export const serializeManifest = (manifest: AiPackageManifest): string => {
  const skills: Record<string, Record<string, string>> = {};
  for (const skill of [...manifest.skills].sort(compareByName)) {
    const entry: Record<string, string> = {
      source: skill.source ?? `${skill.provider}:${skill.packageId}`,
      path: skill.path,
    };
    if (skill.version) {
      entry.version = skill.version;
    }
    skills[skill.name] = entry;
  }

  return `${JSON.stringify({ skills }, null, 2)}\n`;
};

const compareByName = (a: SkillEntry, b: SkillEntry) =>
  a.name.localeCompare(b.name);
