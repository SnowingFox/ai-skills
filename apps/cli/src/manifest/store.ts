import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { join } from 'node:path';
import { SilentError } from '../errors';
import type { PluginEntry } from '../plugins/types';
import type { AiPackageManifest, SkillEntry } from '../types';
import { parseAiPackageManifest } from './parse';

/**
 * Small CRUD API around one `ai-package.json` file. Reads always validate
 * through the manifest parser; writes produce deterministic sorted JSON.
 */
export type ManifestStore = {
  path: string;
  read: () => Promise<AiPackageManifest>;
  write: (manifest: AiPackageManifest) => Promise<void>;
  addSkills: (skills: SkillEntry[]) => Promise<AiPackageManifest>;
  removeSkills: (names: string[]) => Promise<AiPackageManifest>;
  addPlugins: (plugins: PluginEntry[]) => Promise<AiPackageManifest>;
  removePlugins: (names: string[]) => Promise<AiPackageManifest>;
};

/** CLI inputs that affect manifest path resolution. */
export type ManifestScopeOptions = {
  dir?: string;
  global?: boolean;
  manifest?: string;
};

/** Resolved project directory, manifest path, and scope after flag evaluation. */
export type ManifestScope = {
  projectDir: string;
  manifestPath: string;
  global: boolean;
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
      const existing = await read().catch(() => ({
        skills: [],
        plugins: [],
      }));
      const byName = new Map(
        existing.skills.map((skill) => [skill.name, skill])
      );
      for (const skill of skills) {
        byName.set(skill.name, skill);
      }
      const next: AiPackageManifest = {
        skills: [...byName.values()].sort(compareByName),
        plugins: existing.plugins,
      };
      await write(next);
      return next;
    },
    removeSkills: async (names) => {
      const remove = new Set(names);
      const existing = await read();
      const next: AiPackageManifest = {
        skills: existing.skills
          .filter((skill) => !remove.has(skill.name))
          .sort(compareByName),
        plugins: existing.plugins,
      };
      await write(next);
      return next;
    },
    addPlugins: async (plugins) => {
      const existing = await read().catch(() => ({
        skills: [],
        plugins: [],
      }));
      const byName = new Map(
        existing.plugins.map((plugin) => [plugin.name, plugin])
      );
      for (const plugin of plugins) {
        byName.set(plugin.name, plugin);
      }
      const next: AiPackageManifest = {
        skills: existing.skills,
        plugins: [...byName.values()].sort(comparePluginByName),
      };
      await write(next);
      return next;
    },
    removePlugins: async (names) => {
      const remove = new Set(names);
      const existing = await read();
      const next: AiPackageManifest = {
        skills: existing.skills,
        plugins: existing.plugins
          .filter((plugin) => !remove.has(plugin.name))
          .sort(comparePluginByName),
      };
      await write(next);
      return next;
    },
  };
};

/**
 * Resolve project or global manifest scope for commands that read/write
 * `ai-package.json`.
 */
export const resolveManifestScope = (
  cwd: string,
  options: ManifestScopeOptions
): ManifestScope => {
  if (options.global === true) {
    if (options.manifest) {
      throw new SilentError('--global cannot be used with --manifest');
    }
    const manifestPath = getGlobalManifestPath();
    return {
      projectDir: dirname(manifestPath),
      manifestPath,
      global: true,
    };
  }

  const projectDir = resolve(cwd, options.dir ?? '.');
  return {
    projectDir,
    manifestPath: resolveManifestPath(
      projectDir,
      options.manifest ?? 'ai-package.json'
    ),
    global: false,
  };
};

/**
 * Return the fixed global ai-pkgs manifest path.
 */
export const getGlobalManifestPath = (): string =>
  join(homedir(), '.ai-pkgs', 'ai-package.json');

/**
 * Join a relative manifest path to the project directory, or pass through
 * an absolute path unchanged.
 */
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
 * written; the manifest remains `{ source, version?, path }` per entry.
 *
 * Only includes `skills` or `plugins` keys when the respective array is
 * non-empty. At least one key will always be present.
 */
export const serializeManifest = (manifest: AiPackageManifest): string => {
  const output: Record<string, Record<string, Record<string, string>>> = {};

  if (manifest.skills.length > 0) {
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
    output.skills = skills;
  }

  if (manifest.plugins.length > 0) {
    const plugins: Record<string, Record<string, string>> = {};
    for (const plugin of [...manifest.plugins].sort(comparePluginByName)) {
      const entry: Record<string, string> = {
        source: plugin.source ?? `${plugin.provider}:${plugin.packageId}`,
        path: plugin.path,
      };
      if (plugin.version) {
        entry.version = plugin.version;
      }
      if (plugin.targets && plugin.targets.length > 0) {
        (entry as Record<string, unknown>).targets = plugin.targets;
      }
      plugins[plugin.name] = entry;
    }
    output.plugins = plugins;
  }

  return `${JSON.stringify(output, null, 2)}\n`;
};

const compareByName = (a: SkillEntry, b: SkillEntry) =>
  a.name.localeCompare(b.name);

const comparePluginByName = (a: PluginEntry, b: PluginEntry) =>
  a.name.localeCompare(b.name);
