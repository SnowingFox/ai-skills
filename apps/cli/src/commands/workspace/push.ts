import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve as resolvePath } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { canPrompt, isAICommand } from '../../cli/ai-mode';
import { renderAiDone, renderAiStep } from '../../cli/ai-output';
import { SilentError } from '../../errors';
import { execGit, GitCommandError } from '../../git';
import { createManifestStore, resolveManifestScope } from '../../manifest';
import type { WorkspaceSkillEntry } from '../../types';
import {
  defaultCommitMessage,
  isPushRejected,
  resolveCloneUrl,
} from './git-ops';
import type { WorkspaceCommandRuntime, WorkspacePushOptions } from './types';

/**
 * Run `ai-pkgs workspace push <name>`.
 *
 * Clones the remote at the locked branch, copies the local skill directory
 * into the clone at the configured `path`, commits, and pushes. On push
 * rejection: TTY shows a force-push vs resolve-locally selector;
 * `--accept-my-change` force-pushes without prompting; `--ai` without the
 * flag fails with a bail-out message pointing at the temp clone.
 *
 * @example
 * await runWorkspacePushCommand('explain', { message: 'feat: improve examples' }, runtime);
 * // Side effects:
 * //   /tmp/ai-pkgs-ws-XXXXX/                  ← temp clone (cleaned up on success)
 * //   git push origin <branch>                ← spawns Git subprocesses
 * //   ai-package.json                         ← workspace.skills.explain.version updated
 * // Returns: 0 on success, 1 on push rejection without --accept-my-change
 */
export const runWorkspacePushCommand = async (
  name: string | undefined,
  options: WorkspacePushOptions,
  runtime: WorkspaceCommandRuntime
): Promise<number> => {
  if (!name) {
    throw new SilentError('Usage: ai-pkgs workspace push <name>');
  }

  const aiMode = isAICommand(options);
  const promptAllowed = canPrompt(options);

  if (!aiMode && process.stdin.isTTY === true) {
    p.intro(pc.bold('Workspace push'));
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
  if (!existsSync(absoluteLocal)) {
    throw new SilentError(
      `Local path "${entry.local}" does not exist. Did you move or delete the skill?`
    );
  }

  const message = await resolveCommitMessage({
    name,
    optionMessage: options.message,
    promptAllowed,
    aiMode,
    runtime,
  });

  const cloneUrl = resolveCloneUrl(entry);
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-ws-'));
  let tempUsed = true;

  try {
    if (aiMode) {
      process.stdout.write(
        renderAiStep(`Fetching ${entry.source} (${entry.ref})`)
      );
    } else {
      p.log.step(`Fetching ${entry.source} (${entry.ref})...`);
    }

    await cloneAndCheckout(cloneUrl, entry.ref, tempDir);
    await copyDirectoryInto(absoluteLocal, join(tempDir, entry.path));
    await stageAndCommit(tempDir, message);

    if (aiMode) {
      process.stdout.write(renderAiDone(`Committed: ${message}`));
    } else {
      p.log.success(`Committed: ${message}`);
    }

    const pushed = await pushAndUpdateVersion({
      tempDir,
      entry,
      manifestScope,
      store,
      message,
      acceptMyChange: options.acceptMyChange === true,
      promptAllowed,
      aiMode,
      runtime,
    });

    if (!pushed.success) {
      tempUsed = false;
      printBailoutHint(tempDir, entry, aiMode);
      if (!aiMode && process.stdin.isTTY === true) {
        p.outro(pc.red('Push failed (manual resolution required)'));
      }
      return 1;
    }

    if (aiMode) {
      process.stdout.write(
        renderAiDone(`Pushed ${entry.ref}@${pushed.newSha.slice(0, 7)}`)
      );
    } else {
      p.log.success(`Pushed ${entry.ref}@${pushed.newSha.slice(0, 7)}`);
    }

    if (!aiMode && process.stdin.isTTY === true) {
      p.outro(pc.green('Push complete'));
    }
    return 0;
  } finally {
    if (tempUsed) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
};

const resolveCommitMessage = async (args: {
  name: string;
  optionMessage?: string;
  promptAllowed: boolean;
  aiMode: boolean;
  runtime: WorkspaceCommandRuntime;
}): Promise<string> => {
  if (args.optionMessage && args.optionMessage.trim().length > 0) {
    return args.optionMessage.trim();
  }
  if (args.aiMode || !args.promptAllowed) {
    return defaultCommitMessage(args.name);
  }

  const result = await p.text({
    message: 'Commit message?',
    placeholder: defaultCommitMessage(args.name),
    defaultValue: defaultCommitMessage(args.name),
  });
  if (p.isCancel(result)) {
    throw new SilentError('Workspace push cancelled');
  }
  return result.trim().length > 0 ? result : defaultCommitMessage(args.name);
};

const cloneAndCheckout = async (
  cloneUrl: string,
  ref: string,
  tempDir: string
): Promise<void> => {
  await execGit(['clone', '--branch', ref, cloneUrl, tempDir]);
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

const stageAndCommit = async (
  tempDir: string,
  message: string
): Promise<void> => {
  await execGit(['add', '--all'], tempDir);
  const status = await execGit(['status', '--porcelain'], tempDir);
  if (status.length === 0) {
    throw new SilentError(
      'No changes to push: local matches the remote at this commit.'
    );
  }
  await execGit(['commit', '-m', message], tempDir);
};

const pushAndUpdateVersion = async (args: {
  tempDir: string;
  entry: WorkspaceSkillEntry;
  manifestScope: { projectDir: string; manifestPath: string };
  store: ReturnType<typeof createManifestStore>;
  message: string;
  acceptMyChange: boolean;
  promptAllowed: boolean;
  aiMode: boolean;
  runtime: WorkspaceCommandRuntime;
}): Promise<{ success: boolean; newSha: string }> => {
  const pushArgs = args.acceptMyChange
    ? ['push', '--force-with-lease', 'origin', args.entry.ref]
    : ['push', 'origin', args.entry.ref];

  if (args.aiMode) {
    process.stdout.write(renderAiStep(`Pushing to ${args.entry.ref}`));
  } else {
    p.log.step(`Pushing to ${args.entry.ref}...`);
  }

  try {
    await execGit(pushArgs, args.tempDir);
    const newSha = await execGit(['rev-parse', 'HEAD'], args.tempDir);
    await writeNewVersion(args.entry, newSha, args.store);
    return { success: true, newSha };
  } catch (error) {
    if (error instanceof GitCommandError && isPushRejected(error.stderr)) {
      return handlePushRejection({ ...args, originalError: error });
    }
    throw error;
  }
};

const handlePushRejection = async (args: {
  tempDir: string;
  entry: WorkspaceSkillEntry;
  store: ReturnType<typeof createManifestStore>;
  acceptMyChange: boolean;
  promptAllowed: boolean;
  aiMode: boolean;
  runtime: WorkspaceCommandRuntime;
  originalError: GitCommandError;
}): Promise<{ success: boolean; newSha: string }> => {
  if (args.acceptMyChange) {
    return forcePush(args);
  }

  if (args.aiMode || !args.promptAllowed) {
    return { success: false, newSha: '' };
  }

  p.log.warn('Push failed: remote has newer commits.');
  const choice = await p.select({
    message: 'How to resolve?',
    options: [
      {
        label: 'Accept my changes (force push, overwrite remote)',
        value: 'force',
      },
      {
        label: 'Resolve locally (keep temp clone for manual merge)',
        value: 'resolve',
      },
    ],
    initialValue: 'force',
  });
  if (p.isCancel(choice) || choice === 'resolve') {
    return { success: false, newSha: '' };
  }

  return forcePush(args);
};

const forcePush = async (args: {
  tempDir: string;
  entry: WorkspaceSkillEntry;
  store: ReturnType<typeof createManifestStore>;
  aiMode: boolean;
}): Promise<{ success: boolean; newSha: string }> => {
  if (args.aiMode) {
    process.stdout.write(renderAiStep(`Force pushing to ${args.entry.ref}`));
  } else {
    p.log.step(`Force pushing to ${args.entry.ref}...`);
  }
  await execGit(
    ['push', '--force-with-lease', 'origin', args.entry.ref],
    args.tempDir
  );
  const newSha = await execGit(['rev-parse', 'HEAD'], args.tempDir);
  await writeNewVersion(args.entry, newSha, args.store);
  return { success: true, newSha };
};

const writeNewVersion = async (
  entry: WorkspaceSkillEntry,
  newSha: string,
  store: ReturnType<typeof createManifestStore>
): Promise<void> => {
  await store.addWorkspaceSkill({
    ...entry,
    version: `${entry.ref}@${newSha}`,
    commitSha: newSha,
  });
};

const printBailoutHint = (
  tempDir: string,
  entry: WorkspaceSkillEntry,
  aiMode: boolean
): void => {
  const hint = [
    `The working clone is preserved at: ${tempDir}`,
    `To resolve manually:`,
    `  cd ${tempDir}`,
    `  git pull --rebase origin ${entry.ref}`,
    `  git push origin ${entry.ref}`,
    `Then sync your local copy:`,
    `  ai-pkgs workspace pull ${entry.name}`,
  ].join('\n');
  if (aiMode) {
    for (const line of hint.split('\n')) {
      process.stdout.write(renderAiStep(line));
    }
  } else {
    p.note(hint, 'Manual resolution');
  }
};
