import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DiscoveredPlugin,
  PluginSkill,
  PluginCommand,
  PluginAgent,
  PluginRule,
} from './types';

/** Result of plugin discovery in a source tree. */
export type DiscoverResult = {
  plugins: DiscoveredPlugin[];
  remotePlugins: RemotePlugin[];
  missingPaths: string[];
};

/** A plugin declared in marketplace.json but hosted elsewhere. */
export type RemotePlugin = {
  name: string;
  description?: string;
  source: unknown;
};

const VENDOR_DIRS = [
  '.claude-plugin',
  '.cursor-plugin',
  '.codex-plugin',
] as const;

const MARKETPLACE_LOCATIONS = [
  '.agents/plugins',
  '',
  '.claude-plugin',
  '.cursor-plugin',
  '.codex-plugin',
] as const;

const MD_EXT_RE = /\.(md|mdc|markdown)$/;

/**
 * Main entry point for plugin discovery. Scans a root directory for plugins
 * using a three-tier strategy: marketplace.json lookup, single-plugin
 * detection, then bounded recursive scan.
 *
 * @example
 * const { plugins, remotePlugins, missingPaths } = await discoverPlugins('/path/to/repo');
 * // plugins: local DiscoveredPlugin[], remotePlugins: external references,
 * // missingPaths: source entries declared but missing on disk
 */
export const discoverPlugins = async (
  rootDir: string
): Promise<DiscoverResult> => {
  for (const loc of MARKETPLACE_LOCATIONS) {
    const mp = loc
      ? join(rootDir, loc, 'marketplace.json')
      : join(rootDir, 'marketplace.json');
    if (await fileExists(mp)) {
      const data = await readJson(mp);
      if (
        data &&
        typeof data === 'object' &&
        'plugins' in data &&
        Array.isArray((data as Record<string, unknown>).plugins)
      ) {
        return discoverFromMarketplace(rootDir, data as MarketplaceData);
      }
    }
  }

  if (await isPluginDir(rootDir)) {
    const plugin = await inspectPlugin(rootDir);
    return {
      plugins: plugin ? [plugin] : [],
      remotePlugins: [],
      missingPaths: [],
    };
  }

  const plugins: DiscoveredPlugin[] = [];
  await scanForPlugins(rootDir, plugins, 2);
  return { plugins, remotePlugins: [], missingPaths: [] };
};

/**
 * Check whether a directory looks like a plugin by probing for vendor
 * manifests, skill/command/agent directories, or a root SKILL.md.
 */
export const isPluginDir = async (dirPath: string): Promise<boolean> => {
  const checks = [
    join(dirPath, '.agents', 'plugins', 'marketplace.json'),
    ...VENDOR_DIRS.map((v) => join(dirPath, v, 'plugin.json')),
    join(dirPath, 'skills'),
    join(dirPath, 'commands'),
    join(dirPath, 'agents'),
    join(dirPath, 'SKILL.md'),
  ];
  for (const check of checks) {
    if (existsSync(check)) return true;
  }
  return false;
};

/**
 * Inspect a plugin directory: read the vendor manifest, discover skills,
 * commands, agents, rules, and check for hooks/mcp/lsp config files.
 * Returns `null` when the directory cannot be inspected.
 */
export const inspectPlugin = async (
  pluginPath: string
): Promise<DiscoveredPlugin | null> => {
  let manifest: Record<string, unknown> | null = null;
  for (const dir of VENDOR_DIRS) {
    const manifestPath = join(pluginPath, dir, 'plugin.json');
    if (await fileExists(manifestPath)) {
      manifest = await readJson(manifestPath);
      break;
    }
  }

  const name = (manifest?.name as string) ?? dirName(pluginPath);
  const [skills, commands, agents, rules, hasHooks, hasMcp, hasLsp] =
    await Promise.all([
      discoverSkills(pluginPath),
      discoverCommands(pluginPath),
      discoverAgents(pluginPath),
      discoverRules(pluginPath),
      fileExists(join(pluginPath, 'hooks', 'hooks.json')),
      fileExists(join(pluginPath, '.mcp.json')),
      fileExists(join(pluginPath, '.lsp.json')),
    ]);

  return {
    name,
    version: manifest?.version as string | undefined,
    description: manifest?.description as string | undefined,
    path: pluginPath,
    marketplace: undefined,
    skills,
    commands,
    agents,
    rules,
    hasHooks,
    hasMcp,
    hasLsp,
    manifest,
    explicitSkillPaths: undefined,
    marketplaceEntry: undefined,
  };
};

/**
 * Scan a `skills/` subdirectory for directories containing `SKILL.md`.
 * Falls back to a root-level `SKILL.md` when no nested skills are found.
 */
export const discoverSkills = async (
  pluginPath: string
): Promise<PluginSkill[]> => {
  const skillsDir = join(pluginPath, 'skills');
  const entries = await readDirSafe(skillsDir);
  const skills: PluginSkill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillMd = join(skillsDir, entry.name, 'SKILL.md');
    if (await fileExists(skillMd)) {
      const content = await readFile(skillMd, 'utf-8');
      const fm = parseFrontmatter(content);
      skills.push({
        name: (fm.name as string) ?? entry.name,
        description: (fm.description as string) ?? '',
      });
    }
  }

  if (skills.length === 0) {
    const rootSkill = join(pluginPath, 'SKILL.md');
    if (await fileExists(rootSkill)) {
      const content = await readFile(rootSkill, 'utf-8');
      const fm = parseFrontmatter(content);
      skills.push({
        name: (fm.name as string) ?? dirName(pluginPath),
        description: (fm.description as string) ?? '',
      });
    }
  }

  return skills;
};

/**
 * Scan a `commands/` subdirectory for `.md`, `.mdc`, or `.markdown` files.
 * Extracts command name from filename and description from frontmatter.
 */
export const discoverCommands = async (
  pluginPath: string
): Promise<PluginCommand[]> => {
  const commandsDir = join(pluginPath, 'commands');
  const entries = await readDirSafe(commandsDir);
  const commands: PluginCommand[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !MD_EXT_RE.test(entry.name)) continue;
    const filePath = join(commandsDir, entry.name);
    const content = await readFile(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    commands.push({
      name: entry.name.replace(MD_EXT_RE, ''),
      description: (fm.description as string) ?? '',
    });
  }

  return commands;
};

/**
 * Scan an `agents/` subdirectory for `.md`, `.mdc`, or `.markdown` files
 * with both `name` and `description` in frontmatter.
 */
export const discoverAgents = async (
  pluginPath: string
): Promise<PluginAgent[]> => {
  const agentsDir = join(pluginPath, 'agents');
  const entries = await readDirSafe(agentsDir);
  const agents: PluginAgent[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !MD_EXT_RE.test(entry.name)) continue;
    const filePath = join(agentsDir, entry.name);
    const content = await readFile(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    if (fm.name && fm.description) {
      agents.push({
        name: fm.name as string,
        description: fm.description as string,
      });
    }
  }

  return agents;
};

/**
 * Scan a `rules/` subdirectory for `.mdc`, `.md`, or `.markdown` files.
 * Extracts rule name from filename and description from frontmatter.
 */
export const discoverRules = async (
  pluginPath: string
): Promise<PluginRule[]> => {
  const rulesDir = join(pluginPath, 'rules');
  const entries = await readDirSafe(rulesDir);
  const rules: PluginRule[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !MD_EXT_RE.test(entry.name)) continue;
    const filePath = join(rulesDir, entry.name);
    const content = await readFile(filePath, 'utf-8');
    const fm = parseFrontmatter(content);
    rules.push({
      name: entry.name.replace(MD_EXT_RE, ''),
      description: (fm.description as string) ?? '',
    });
  }

  return rules;
};

/**
 * Parse simple YAML-like frontmatter between `---` markers at the top of a
 * file. Extracts flat key-value pairs, converting `true`/`false` strings to
 * booleans and stripping surrounding quotes.
 *
 * @example
 * parseFrontmatter('---\nname: my-skill\ndescription: "does things"\n---\nbody');
 * // { name: 'my-skill', description: 'does things' }
 */
export const parseFrontmatter = (
  content: string
): Record<string, string | boolean> => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return {};

  const result: Record<string, string | boolean> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kv?.[1] && kv[2]) {
      let val = kv[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (val === 'true') {
        result[kv[1]] = true;
      } else if (val === 'false') {
        result[kv[1]] = false;
      } else {
        result[kv[1]] = val;
      }
    }
  }

  return result;
};

type MarketplaceData = {
  name?: string;
  metadata?: { pluginRoot?: string };
  plugins: MarketplaceEntry[];
};

type MarketplaceEntry = {
  name: string;
  description?: string;
  version?: string;
  source: string | Record<string, unknown>;
  skills?: string[];
};

/**
 * Discover plugins from a parsed `marketplace.json`. Local source entries are
 * inspected in-place; non-string sources are collected as remote plugins;
 * missing source directories are recorded.
 */
const discoverFromMarketplace = async (
  repoPath: string,
  marketplace: MarketplaceData
): Promise<DiscoverResult> => {
  const plugins: DiscoveredPlugin[] = [];
  const remotePlugins: RemotePlugin[] = [];
  const missingPaths: string[] = [];
  const root = marketplace.metadata?.pluginRoot ?? '.';

  for (const entry of marketplace.plugins) {
    if (typeof entry.source !== 'string') {
      remotePlugins.push({
        name: entry.name,
        description: entry.description || undefined,
        source: entry.source,
      });
      continue;
    }

    const sourcePath = join(repoPath, root, entry.source.replace(/^\.\//, ''));
    if (!(await dirExists(sourcePath))) {
      missingPaths.push(entry.source);
      continue;
    }

    let skills: PluginSkill[];
    if (entry.skills && Array.isArray(entry.skills)) {
      skills = [];
      for (const skillPath of entry.skills) {
        const resolvedPath = join(
          repoPath,
          root,
          skillPath.replace(/^\.\//, '')
        );
        const skillMd = join(resolvedPath, 'SKILL.md');
        if (await fileExists(skillMd)) {
          const content = await readFile(skillMd, 'utf-8');
          const fm = parseFrontmatter(content);
          skills.push({
            name: (fm.name as string) ?? dirName(resolvedPath),
            description: (fm.description as string) ?? '',
          });
        }
      }
    } else {
      skills = await discoverSkills(sourcePath);
    }

    let manifest: Record<string, unknown> | null = null;
    for (const manifestDir of VENDOR_DIRS) {
      const manifestPath = join(sourcePath, manifestDir, 'plugin.json');
      if (await fileExists(manifestPath)) {
        manifest = await readJson(manifestPath);
        break;
      }
    }

    const [commands, agents, rules, hasHooks, hasMcp, hasLsp] =
      await Promise.all([
        discoverCommands(sourcePath),
        discoverAgents(sourcePath),
        discoverRules(sourcePath),
        fileExists(join(sourcePath, 'hooks', 'hooks.json')),
        fileExists(join(sourcePath, '.mcp.json')),
        fileExists(join(sourcePath, '.lsp.json')),
      ]);

    const name =
      entry.name || (manifest?.name as string) || dirName(sourcePath);

    plugins.push({
      name,
      version: entry.version || (manifest?.version as string) || undefined,
      description:
        entry.description || (manifest?.description as string) || undefined,
      path: sourcePath,
      marketplace: marketplace.name,
      skills,
      commands,
      agents,
      rules,
      hasHooks,
      hasMcp,
      hasLsp,
      manifest,
      explicitSkillPaths: entry.skills,
      marketplaceEntry: entry as unknown as Record<string, unknown>,
    });
  }

  return { plugins, remotePlugins, missingPaths };
};

/**
 * Recursively scan subdirectories for plugin directories, up to the given
 * depth. Skips hidden directories (names starting with `.`).
 */
const scanForPlugins = async (
  dirPath: string,
  results: DiscoveredPlugin[],
  depth: number
): Promise<void> => {
  if (depth <= 0) return;
  const entries = await readDirSafe(dirPath);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const childPath = join(dirPath, entry.name);
    if (await isPluginDir(childPath)) {
      const plugin = await inspectPlugin(childPath);
      if (plugin) results.push(plugin);
    } else {
      await scanForPlugins(childPath, results, depth - 1);
    }
  }
};

const dirName = (p: string): string => {
  const parts = p.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] ?? 'unknown';
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
};

const dirExists = async (dirPath: string): Promise<boolean> => {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
};

const readJson = async (
  path: string
): Promise<Record<string, unknown> | null> => {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const readDirSafe = async (dirPath: string) => {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
};
