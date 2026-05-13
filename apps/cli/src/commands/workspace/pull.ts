import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve as resolvePath } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { execGit } from '../../git';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { WorkspaceSkillEntry } from '../../types';
import { computeNewVersion, resolveCloneUrl } from './git-ops';
import type { WorkspaceCommandRuntime, WorkspacePullOptions } from './types';

/**
 * Run `ai-pkgs workspace pull <name>`.
 *
 * Clones the remote at the latest commit on the locked branch and copies
 * the skill directory into the local path. Warns in TTY if the local
 * directory has diverged from the pinned commit; `--force` and `--ai`
 * always overwrite.
 *
 * @example
 * await runWorkspacePullCommand('explain', { force: true }, runtime);
 * // Side effects:
 * //   /tmp/ai-pkgs-ws-XXXXX/                  ← temp clone (cleaned up)
 * //   .cursor/skills/explain/                 ← replaced with remote content
 * //   ai-package.json                         ← workspace.skills.explain.version updated
 * // Returns: 0 on success, 1 if user cancels overwrite
 */
export const runWorkspacePullCommand = async (
  name: string | undefined,
  options: WorkspacePullOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  if (!name) {
    throw new SilentError('Usage: ai-pkgs workspace pull <name>');
  }

  const aiMode = isAICommand(options);
  const promptAllowed = canPrompt(options);

  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Workspace pull'));
  }

  const manifestScope = resolveManifestScope(runtime.cwd, options);
  const store = createManifestStore(
    manifestScope.projectDir,
    manifestScope.manifestPath
  );
  const manifest = await store.read();
  const entry = manifest.workspace.skills.find((skill) => skill.name === name);
  if (!entry) {
    throw new SilentError(`"${name}" is not a workspace skill.`);
  }

  const absoluteLocal = resolvePath(manifestScope.projectDir, entry.local);
  const cloneUrl = resolveCloneUrl(entry);
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-ws-'));

  try {
    if (aiMode) {
      process.stdout.write(
        renderAiStep(`Fetching ${entry.source} (${entry.ref})`)
      );
    } else {
      p.log.step(`Fetching ${entry.source} (${entry.ref})...`);
    }
    await execGit(['clone', '--branch', entry.ref, cloneUrl, tempDir]);

    if (await detectLocalChanges(tempDir, entry, absoluteLocal)) {
      const proceed = await confirmOverwrite({
        entry,
        force: options.force === true,
        promptAllowed,
        aiMode,
        runtime,
      });
      if (!proceed) {
        p.cancel('Workspace pull cancelled');
        return 1;
      }
    }

    await copyDirectoryInto(join(tempDir, entry.path), absoluteLocal);
    const newSha = await execGit(['rev-parse', 'HEAD'], tempDir);

    await store.addWorkspaceSkill(computeNewVersion(entry, newSha));

    if (aiMode) {
      process.stdout.write(
        renderAiDone(
          `Pulled ${entry.path} -> ${entry.local} (${entry.ref}@${newSha.slice(0, 7)})`
        )
      );
    } else {
      p.log.success(
        `Pulled ${entry.path} -> ${entry.local} (${entry.ref}@${newSha.slice(0, 7)})`
      );
    }
    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.green('Pull complete'));
    }
    return 0;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const detectLocalChanges = async (
  tempDir: string,
  entry: WorkspaceSkillEntry,
  absoluteLocal: string
): Promise<boolean> => {
  if (!existsSync(absoluteLocal)) return false;
  try {
    await execGit(
      [
        'diff',
        '--no-index',
        '--quiet',
        join(tempDir, entry.path),
        absoluteLocal,
      ],
      tempDir
    );
    return false;
  } catch {
    return true;
  }
};

const confirmOverwrite = async (args: {
  entry: WorkspaceSkillEntry;
  force: boolean;
  promptAllowed: boolean;
  aiMode: boolean;
  runtime: WorkspaceCommandRuntime;
}): Promise<boolean> => {
  if (args.force || args.aiMode) return true;
  if (!args.promptAllowed) return true;

  p.log.warn(
    `Local directory ${args.entry.local} has changes since last push.\nPulling will overwrite them.`
  );
  const confirmed = await args.runtime.confirm({
    message: 'Continue?',
    initialValue: false,
  });
  return confirmed === true;
};

const copyDirectoryInto = async (
  source: string,
  destination: string
): Promise<void> => {
  await mkdir(dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    await rm(destination, { recursive: true, force: true });
  }
  await cp(source, destination, { recursive: true });
};
