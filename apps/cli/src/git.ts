import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CloneRequest, ClonedSource, MaterializedSource } from './types';

export class GitCommandError extends Error {
  constructor(
    message: string,
    readonly args: string[],
    readonly stderr: string
  ) {
    super(message);
    this.name = 'GitCommandError';
  }
}

export const cloneRemoteSource = async (
  request: CloneRequest
): Promise<ClonedSource> => {
  return cloneRepository({
    cloneUrl: request.cloneUrl,
    commitSha: request.commitSha,
  });
};

export type CloneRepositoryOptions = {
  cloneUrl: string;
  ref?: string;
  commitSha?: string;
};

export const cloneRepository = async ({
  cloneUrl,
  ref,
  commitSha,
}: CloneRepositoryOptions): Promise<MaterializedSource> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-'));

  try {
    const args = ['clone'];
    if (ref && !commitSha) {
      args.push('--branch', ref);
    }
    args.push('--no-checkout', cloneUrl, tempDir);
    await runGit(args);
    if (commitSha) {
      await checkoutCommit(tempDir, commitSha);
    } else {
      await runGit(['checkout'], tempDir);
    }
  } catch (error) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }

  return {
    rootDir: tempDir,
    cleanup: async () => {
      await rm(tempDir, { force: true, recursive: true });
    },
  };
};

export const resolveHeadSha = async (cwd: string): Promise<string> =>
  runGit(['rev-parse', 'HEAD'], cwd);

export const resolveDefaultBranch = async (cwd: string): Promise<string> => {
  const symbolicRef = await runGit(
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    cwd
  ).catch(() => '');
  if (symbolicRef) {
    return symbolicRef;
  }

  const remoteHead = await runGit(
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    cwd
  ).catch(() => '');
  return remoteHead.replace(/^origin\//, '') || 'HEAD';
};

export const checkoutCommit = async (
  cwd: string,
  commitSha: string
): Promise<void> => {
  await runGit(['checkout', '--detach', commitSha], cwd);
};

export const execGit = async (args: string[], cwd?: string): Promise<string> =>
  runGit(args, cwd);

const runGit = async (args: string[], cwd?: string): Promise<string> => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return new Promise<string>((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_LFS_SKIP_SMUDGE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout.push(chunk);
    });
    child.stderr.setEncoding('utf-8');
    child.stderr.on('data', (chunk: string) => {
      stderr.push(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.join('').trim());
        return;
      }

      const output = stderr.join('').trim();
      reject(
        new GitCommandError(
          `git ${args.join(' ')} failed: ${output}`,
          args,
          output
        )
      );
    });
  });
};
