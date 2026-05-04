import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CloneRequest, ClonedSource, MaterializedSource } from './types';

export class GitCommandError extends Error {
  constructor(
    message: string,
    readonly args: string[],
    readonly stderr: string,
    readonly kind: GitErrorKind = 'unknown'
  ) {
    super(message);
    this.name = 'GitCommandError';
  }
}

export type GitErrorKind =
  | 'timeout'
  | 'auth'
  | 'not-found'
  | 'ref'
  | 'git-missing'
  | 'unknown';

export type GitProgressEvent =
  | {
      status: 'resolving-remote';
      cloneUrl: string;
      ref?: string;
    }
  | {
      status: 'created-temp-dir';
      tempDir: string;
    }
  | {
      status: 'cloning';
      cloneUrl: string;
      ref?: string;
    }
  | {
      status: 'checking-out';
      ref?: string;
      commitSha?: string;
    }
  | {
      status: 'resolved';
      ref: string;
      commitSha: string;
    }
  | {
      status: 'cache-hit' | 'cache-refresh' | 'cache-store';
      provider: 'github' | 'gitlab';
      packageId: string;
      ref: string;
      commitSha: string;
      cachePath: string;
    };

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
  onProgress?: (event: GitProgressEvent) => void;
};

export const cloneRepository = async ({
  cloneUrl,
  ref,
  commitSha,
  onProgress,
}: CloneRepositoryOptions): Promise<MaterializedSource> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-'));
  onProgress?.({ status: 'created-temp-dir', tempDir });

  try {
    const args = ['clone'];
    if (ref && !commitSha) {
      args.push('--branch', ref);
    }
    args.push('--no-checkout', cloneUrl, tempDir);
    onProgress?.({ status: 'cloning', cloneUrl, ref });
    await runGit(args);
    onProgress?.({ status: 'checking-out', commitSha, ref });
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

export type ResolvedRemoteRef = {
  ref: string;
  commitSha: string;
};

export const resolveRemoteRef = async ({
  cloneUrl,
  ref,
}: {
  cloneUrl: string;
  ref?: string;
}): Promise<ResolvedRemoteRef> => {
  if (!ref) {
    const output = await runGit(['ls-remote', '--symref', cloneUrl, 'HEAD']);
    return parseRemoteHead(output);
  }

  const output = await runGit(['ls-remote', cloneUrl, ref]);
  const commitSha = parseRemoteRef(output, ref);
  if (!commitSha && /^[a-f0-9]{40}$/i.test(ref)) {
    return { ref, commitSha: ref };
  }
  if (!commitSha) {
    throw new GitCommandError(
      `git ls-remote ${cloneUrl} ${ref} failed: ref not found`,
      ['ls-remote', cloneUrl, ref],
      `ref not found: ${ref}`,
      'ref'
    );
  }

  return { ref, commitSha };
};

export const checkoutCommit = async (
  cwd: string,
  commitSha: string
): Promise<void> => {
  await runGit(['checkout', '--detach', commitSha], cwd);
};

export const execGit = async (args: string[], cwd?: string): Promise<string> =>
  runGit(args, cwd);

const parseRemoteHead = (output: string): ResolvedRemoteRef => {
  const lines = output.split('\n').filter(Boolean);
  const symbolic = lines.find((line) => line.startsWith('ref:'));
  const ref =
    symbolic?.match(/^ref:\s+refs\/heads\/(.+)\s+HEAD$/)?.[1] ?? 'HEAD';
  const head = lines.find((line) => /^[a-f0-9]{40}\s+HEAD$/i.test(line));
  const commitSha = head?.split(/\s+/)[0];
  if (!commitSha) {
    throw new GitCommandError(
      'git ls-remote --symref failed: HEAD not found',
      ['ls-remote', '--symref', 'HEAD'],
      output,
      'ref'
    );
  }

  return { ref, commitSha };
};

const parseRemoteRef = (output: string, ref: string): string | undefined => {
  const lines = output.split('\n').filter(Boolean);
  const exact = lines.find((line) => {
    const [, remoteRef] = line.split(/\s+/);
    return (
      remoteRef === ref ||
      remoteRef === `refs/heads/${ref}` ||
      remoteRef === `refs/tags/${ref}` ||
      remoteRef === `refs/tags/${ref}^{}`
    );
  });

  return exact?.split(/\s+/)[0];
};

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

    child.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      reject(
        new GitCommandError(
          `git ${args.join(' ')} failed: ${message}`,
          args,
          message,
          classifyGitError(args, message)
        )
      );
    });
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
          output,
          classifyGitError(args, output)
        )
      );
    });
  });
};

export const classifyGitError = (
  args: string[],
  output: string
): GitErrorKind => {
  const normalized = output.toLowerCase();
  if (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('operation timed out')
  ) {
    return 'timeout';
  }
  if (
    normalized.includes('enoent') ||
    normalized.includes('not found: git') ||
    normalized.includes('no such file or directory')
  ) {
    return 'git-missing';
  }
  if (
    normalized.includes('authentication failed') ||
    normalized.includes('could not read username') ||
    normalized.includes('permission denied') ||
    normalized.includes('publickey')
  ) {
    return 'auth';
  }
  if (
    normalized.includes('repository not found') ||
    normalized.includes('not found') ||
    normalized.includes('does not exist') ||
    normalized.includes('does not appear to be a git repository')
  ) {
    return 'not-found';
  }
  if (
    args.includes('checkout') ||
    normalized.includes('remote branch') ||
    normalized.includes('pathspec') ||
    normalized.includes('reference is not a tree') ||
    normalized.includes("couldn't find remote ref")
  ) {
    return 'ref';
  }
  return 'unknown';
};
