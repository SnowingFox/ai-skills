import * as p from '@clack/prompts';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { AiPackageManifest, SkillEntry } from '../../types';
import type { SkillsCommandRuntime, SkillsListOptions } from './types';

/** JSON output shape for `skills list --json`. */
export type ListedSkill = {
  name: string;
  source: string;
  provider: string;
  packageId: string;
  path: string;
  version?: string;
  ref?: string;
  commitSha?: string;
};

/**
 * Render `ai-pkgs skills list` as grouped, stable ASCII text.
 */
export const formatSkillsList = (manifest: AiPackageManifest): string => {
  const lines = [`manifest skills: ${manifest.skills.length}`];
  for (const group of groupSkillsBySource(manifest.skills)) {
    lines.push(formatSourceHeader(group.source, group.ref, group.commitSha));
    for (const skill of group.skills) {
      lines.push(`- ${skill.name} ${skill.path}`);
    }
  }
  return `${lines.join('\n')}\n`;
};

/**
 * Convert a manifest into JSON-safe list output.
 */
export const formatSkillsListJson = (manifest: AiPackageManifest): string =>
  `${JSON.stringify(manifest.skills.map(toListedSkill), null, 2)}\n`;

/**
 * List skills declared in `ai-package.json`.
 */
export const runSkillsListCommand = async (
  options: SkillsListOptions,
  runtime: SkillsCommandRuntime
): Promise<number> => {
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();

  if (options.json === true) {
    process.stdout.write(formatSkillsListJson(manifest));
    return 0;
  }

  if (canPrompt(options) && !isAICommand(options)) {
    p.intro('AI package skills');
    p.note(
      formatSkillsListNote(manifest),
      `Manifest skills (${manifest.skills.length})`
    );
    p.outro('Done.');
    return 0;
  }

  process.stdout.write(formatSkillsList(manifest));
  return 0;
};

const formatSkillsListNote = (manifest: AiPackageManifest): string =>
  groupSkillsBySource(manifest.skills)
    .map((group) =>
      [
        formatSourceHeader(group.source, group.ref, group.commitSha).replace(
          /^source /,
          'Source: '
        ),
        ...group.skills.flatMap((skill) => [
          `  ${skill.name}`,
          `    path: ${skill.path}`,
        ]),
      ].join('\n')
    )
    .join('\n\n');

const groupSkillsBySource = (skills: SkillEntry[]) => {
  const groups = new Map<
    string,
    {
      source: string;
      ref?: string;
      commitSha?: string;
      skills: SkillEntry[];
    }
  >();

  for (const skill of [...skills].sort(compareByName)) {
    const source = skill.source ?? `${skill.provider}:${skill.packageId}`;
    const key = `${source}\0${skill.ref ?? ''}\0${skill.commitSha ?? ''}`;
    const group = groups.get(key) ?? {
      source,
      ref: skill.ref,
      commitSha: skill.commitSha,
      skills: [],
    };
    group.skills.push(skill);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.source.localeCompare(b.source));
};

const formatSourceHeader = (
  source: string,
  ref?: string,
  commitSha?: string
): string => {
  if (!ref || !commitSha) {
    return `source ${source}`;
  }
  return `source ${source} ${ref}@${shortSha(commitSha)}`;
};

const toListedSkill = (skill: SkillEntry): ListedSkill => ({
  name: skill.name,
  source: skill.source ?? `${skill.provider}:${skill.packageId}`,
  provider: skill.provider,
  packageId: skill.packageId,
  path: skill.path,
  version: skill.version,
  ref: skill.ref,
  commitSha: skill.commitSha,
});

const compareByName = (a: SkillEntry, b: SkillEntry) =>
  a.name.localeCompare(b.name);

const shortSha = (sha: string): string => sha.slice(0, 7);
