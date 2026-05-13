import { existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { relative, resolve as resolvePath } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { agents } from '../../agents/registry';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { SkillEntry, WorkspaceSkillEntry } from '../../types';
import type { WorkspaceCommandRuntime, WorkspaceLinkOptions } from './types';

/**
 * Scan every known agent's project skills directory for a folder named
 * `<skillName>`. Returns project-relative paths so they can be surfaced
 * in a selector and written to `workspace.skills[].local`.
 *
 * @example
 * await discoverInstalledPaths('explain', '/repo');
 * // ['.cursor/skills/explain', '.claude/skills/explain']
 */
export const discoverInstalledPaths = async (
  skillName: string,
  projectDir: string
): Promise<string[]> => {
  const seen = new Set<string>();
  for (const agent of Object.values(agents)) {
    const candidate = resolvePath(
      projectDir,
      agent.projectSkillsDir,
      skillName
    );
    if (!existsSync(candidate)) continue;
    let isDir = false;
    try {
      isDir = (await stat(candidate)).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) continue;
    const rel = relative(projectDir, candidate).replace(/\\/g, '/');
    seen.add(rel);
  }
  return [...seen].sort();
};

/**
 * Build a {@link WorkspaceSkillEntry} from an existing `skills[]` entry plus
 * the desired local path. Validates that the source is Git-backed and that
 * the skill has a pinned ref/commitSha/version.
 *
 * @throws {SilentError} when the source is not github/gitlab or when the
 *   entry is missing version metadata.
 */
export const buildLinkEntry = (
  skill: SkillEntry,
  local: string
): WorkspaceSkillEntry => {
  if (skill.provider !== 'github' && skill.provider !== 'gitlab') {
    throw new SilentError(
      `"${skill.name}" provider "${skill.provider}" cannot be moved to workspace (only github and gitlab)`
    );
  }
  if (!skill.ref || !skill.commitSha || !skill.version) {
    throw new SilentError(
      `"${skill.name}" is missing ref/commitSha/version and cannot be moved to workspace`
    );
  }

  return {
    name: skill.name,
    local,
    provider: skill.provider,
    source: skill.source ?? `${skill.provider}:${skill.packageId}`,
    packageId: skill.packageId,
    cloneUrl: skill.cloneUrl,
    version: skill.version,
    ref: skill.ref,
    commitSha: skill.commitSha,
    path: skill.path,
  };
};

/**
 * Run `ai-pkgs workspace link <name>`.
 *
 * Moves a skill from `skills[]` to `workspace.skills`. Auto-fills
 * source/path/version from the existing entry and prompts only for the
 * local path with an agent-aware selector (or `--local` to skip).
 *
 * @example
 * await runWorkspaceLinkCommand('explain', { local: '.cursor/skills/explain' }, runtime);
 * // Side effects:
 * //   ai-package.json                        ← skills.explain removed,
 * //                                            workspace.skills.explain added
 * // Returns: 0 on success
 */
export const runWorkspaceLinkCommand = async (
  name: string | undefined,
  options: WorkspaceLinkOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  if (!name) {
    throw new SilentError('Usage: ai-pkgs workspace link <name>');
  }

  const aiMode = isAICommand(options);
  const promptAllowed = canPrompt(options);

  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Workspace link'));
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();

  const inWorkspace = manifest.workspace.skills.find(
    (skill) => skill.name === name
  );
  if (inWorkspace) {
    throw new SilentError(`"${name}" is already a workspace skill.`);
  }

  const existing = manifest.skills.find((skill) => skill.name === name);
  if (!existing) {
    throw new SilentError(
      `"${name}" is not in skills. Use "skills add <source> --workspace" to add a new workspace skill.`
    );
  }

  if (aiMode) {
    process.stdout.write(
      renderAiStep(`Found "${name}" in skills (${existing.source})`)
    );
  } else {
    p.log.step(`Found "${name}" in skills (${existing.source})`);
  }

  const localPath = await resolveLocalPath({
    name,
    projectDir: manifestScope.projectDir,
    optionLocal: options.local,
    promptAllowed,
    aiMode,
  });

  const entry = buildLinkEntry(existing, localPath);
  await store.moveSkillToWorkspace(name, localPath);

  if (aiMode) {
    process.stdout.write(renderAiDone(`Moved "${name}" to workspace`));
    process.stdout.write(renderAiStep(`local: ${entry.local}`));
    process.stdout.write(renderAiStep(`source: ${entry.source}`));
    process.stdout.write(renderAiStep(`path: ${entry.path}`));
    process.stdout.write(renderAiStep(`version: ${entry.version}`));
  } else {
    p.log.success(`Moved "${name}" to workspace`);
    p.note(
      [
        `local:   ${entry.local}`,
        `source:  ${entry.source}`,
        `path:    ${entry.path}`,
        `version: ${entry.version}`,
      ].join('\n')
    );
  }

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(pc.green('Link complete'));
  }
  return 0;
};

const resolveLocalPath = async (args: {
  name: string;
  projectDir: string;
  optionLocal?: string;
  promptAllowed: boolean;
  aiMode: boolean;
}): Promise<string> => {
  if (args.optionLocal) {
    validateLocalPathExists(args.projectDir, args.optionLocal);
    return args.optionLocal;
  }

  if (args.aiMode || !args.promptAllowed) {
    throw new SilentError(
      '--local is required when linking in non-interactive mode.'
    );
  }

  const installed = await discoverInstalledPaths(args.name, args.projectDir);
  const options = [
    ...installed.map((path) => ({ label: path, value: path })),
    { label: 'Custom path (type manually)', value: '__custom__' },
  ];

  const selected = await p.select({
    message: 'Which installed copy to iterate on?',
    options,
    initialValue: installed[0] ?? '__custom__',
  });
  if (p.isCancel(selected)) {
    throw new SilentError('Workspace link cancelled');
  }
  if (selected !== '__custom__') {
    return selected;
  }

  while (true) {
    const typed = await p.text({
      message: 'Enter path:',
      placeholder: `.cursor/skills/${args.name}`,
      validate: (value = '') =>
        value.trim().length === 0 ? 'Path is required' : undefined,
    });
    if (p.isCancel(typed)) {
      throw new SilentError('Workspace link cancelled');
    }
    try {
      validateLocalPathExists(args.projectDir, typed);
      return typed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(message);
    }
  }
};

const validateLocalPathExists = (projectDir: string, local: string) => {
  const absolute = resolvePath(projectDir, local);
  if (!existsSync(absolute)) {
    throw new SilentError(`Path does not exist: ${local}`);
  }
};
