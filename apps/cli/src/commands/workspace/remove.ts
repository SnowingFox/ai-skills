import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { WorkspaceSkillEntry } from '../../types';
import type { WorkspaceCommandRuntime, WorkspaceRemoveOptions } from './types';

/**
 * Look up a workspace skill by name. Used by `workspace remove` to give a
 * clear "not found" message with the list of available skills.
 *
 * @throws {SilentError} when no entry with `name` exists in the array.
 *
 * @example
 * resolveRemoveTarget([{name:'a',...}], 'a'); // entry
 * resolveRemoveTarget([], 'a'); // throws "is not a workspace skill. Available: (none)"
 */
export const resolveRemoveTarget = (
  skills: WorkspaceSkillEntry[],
  name: string
): WorkspaceSkillEntry => {
  const found = skills.find((skill) => skill.name === name);
  if (found) return found;

  const available =
    skills
      .map((skill) => skill.name)
      .sort()
      .join(', ') || '(none)';
  throw new SilentError(
    `"${name}" is not a workspace skill. Available: ${available}`
  );
};

/**
 * Run `ai-pkgs workspace remove <name>`.
 *
 * Destructive operation: deletes the workspace entry from `ai-package.json`
 * AND removes the local skill directory from disk. TTY prompts for
 * confirmation; `--ai` requires `--yes`.
 *
 * @example
 * await runWorkspaceRemoveCommand('explain', { yes: true }, runtime);
 * // Side effects:
 * //   .cursor/skills/explain/                ← removed recursively
 * //   ai-package.json                        ← workspace.skills.explain key dropped
 * // Returns: 0 on success, 1 if user cancels
 */
export const runWorkspaceRemoveCommand = async (
  name: string | undefined,
  options: WorkspaceRemoveOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  if (!name) {
    throw new SilentError('Usage: ai-pkgs workspace remove <name>');
  }

  const aiMode = isAICommand(options);
  const promptAllowed = canPrompt(options);

  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Workspace remove'));
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const target = resolveRemoveTarget(manifest.workspace.skills, name);

  const absoluteLocal = resolve(manifestScope.projectDir, target.local);
  const localExists = existsSync(absoluteLocal);

  if (options.yes !== true) {
    if (!promptAllowed) {
      throw new SilentError(
        'Pass --yes to confirm removal in non-interactive mode.'
      );
    }

    if (!aiMode) {
      p.log.warn(
        `This will remove the workspace entry and delete local files:\n  ${target.local}`
      );
    }
    const confirmed = await runtime.confirm({
      message: `Delete ${target.local} and remove workspace entry?`,
      initialValue: false,
    });
    if (confirmed !== true) {
      p.cancel('Workspace remove cancelled');
      return 1;
    }
  }

  if (localExists) {
    await rm(absoluteLocal, { recursive: true, force: true });
    if (aiMode) {
      process.stdout.write(renderAiDone(`Deleted ${target.local}`));
    } else {
      p.log.success(`Deleted ${target.local}`);
    }
  } else {
    if (aiMode) {
      process.stdout.write(
        renderAiStep(`Local path ${target.local} was already missing`)
      );
    } else {
      p.log.warn(`Local path ${target.local} was already missing`);
    }
  }

  await store.removeWorkspaceSkill(name);
  if (aiMode) {
    process.stdout.write(renderAiDone(`Removed "${name}" from workspace`));
  } else {
    p.log.success(`Removed "${name}" from workspace`);
  }

  if (!aiMode && process.stdin.isTTY === true) {
    p.outro(pc.green('Remove complete'));
  }
  return 0;
};
