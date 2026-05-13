import * as p from '@clack/prompts';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { WorkspaceSkillEntry } from '../../types';
import type { WorkspaceCommandRuntime, WorkspaceListOptions } from './types';

/**
 * Format the workspace skill list as stable plain text, one line per entry,
 * sorted alphabetically by name.
 *
 * @example
 * formatWorkspaceList([{ name: 'explain', local: '.cursor/skills/explain', ... }])
 * // 'workspace skills: 1\n- explain github:entireio/skills main@c376dc9 .cursor/skills/explain -> skills/explain\n'
 */
export const formatWorkspaceList = (skills: WorkspaceSkillEntry[]): string => {
  const lines = [`workspace skills: ${skills.length}`];
  for (const skill of [...skills].sort(byName)) {
    const shortSha = skill.commitSha.slice(0, 7);
    lines.push(
      `- ${skill.name} ${skill.source} ${skill.ref}@${shortSha} ${skill.local} -> ${skill.path}`
    );
  }
  return `${lines.join('\n')}\n`;
};

/**
 * Format the workspace skill list as a JSON array suitable for `--json`
 * output and automation tooling.
 *
 * @example
 * formatWorkspaceListJson([{ name: 'explain', local: '.cursor/skills/explain', ... }])
 * // '[\n  {\n    "name": "explain",\n    "local": ".cursor/skills/explain",\n    "source": "github:entireio/skills",\n    "path": "skills/explain",\n    "version": "main@c376dc9..."\n  }\n]\n'
 */
export const formatWorkspaceListJson = (
  skills: WorkspaceSkillEntry[]
): string =>
  `${JSON.stringify(
    [...skills].sort(byName).map((skill) => ({
      name: skill.name,
      local: skill.local,
      source: skill.source,
      path: skill.path,
      version: skill.version,
    })),
    null,
    2
  )}\n`;

/**
 * Run `ai-pkgs workspace list`. Prints the workspace.skills section as a
 * Clack note in TTY mode, as plain text in `--ai` or non-TTY mode, or as
 * JSON when `--json` is set.
 *
 * @example
 * await runWorkspaceListCommand({}, runtime);
 * // Side effects:
 * //   reads ai-package.json from runtime.cwd
 * //   writes formatted output to process.stdout
 * // Returns: 0 on success
 */
export const runWorkspaceListCommand = async (
  options: WorkspaceListOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const skills = manifest.workspace.skills;

  if (options.json === true) {
    process.stdout.write(formatWorkspaceListJson(skills));
    return 0;
  }

  if (canPrompt(options) && !isAICommand(options)) {
    p.intro('Workspace skills');
    if (skills.length === 0) {
      p.log.warn(
        'No workspace skills.\n  Use "ai-pkgs workspace link <name>" to iterate on an installed skill,\n  or "ai-pkgs skills add <source> --workspace" to add a new one.'
      );
    } else {
      p.note(formatNote(skills), `Workspace skills (${skills.length})`);
    }
    p.outro('Done.');
    return 0;
  }

  process.stdout.write(formatWorkspaceList(skills));
  return 0;
};

const formatNote = (skills: WorkspaceSkillEntry[]): string =>
  [...skills]
    .sort(byName)
    .map((skill) =>
      [
        `  ${skill.name}`,
        `    local:   ${skill.local}`,
        `    source:  ${skill.source}`,
        `    path:    ${skill.path}`,
        `    version: ${skill.version}`,
      ].join('\n')
    )
    .join('\n\n');

const byName = (a: WorkspaceSkillEntry, b: WorkspaceSkillEntry) =>
  a.name.localeCompare(b.name);
