import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitCommandError, cloneRemoteSource } from '../../src/git';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp();
});

afterEach(async () => {
  await rmTemp(tempRoot);
});

describe('cloneRemoteSource', () => {
  it('clones a local git repository and checks out the pinned commit', async () => {
    const repo = join(tempRoot, 'source');
    const commitSha = await createRepo(repo);

    const cloned = await cloneRemoteSource({
      provider: 'github',
      packageId: 'owner/repo',
      cloneUrl: pathToFileURL(repo).href,
      ref: 'main',
      commitSha,
    });

    expect(typeof cloned).not.toBe('string');
    const rootDir = typeof cloned === 'string' ? cloned : cloned.rootDir;
    await expect(
      readFile(join(rootDir, 'skills/one/SKILL.md'), 'utf-8')
    ).resolves.toBe('# One');
    if (typeof cloned !== 'string') {
      await cloned.cleanup?.();
      await expect(
        readFile(join(rootDir, 'skills/one/SKILL.md'), 'utf-8')
      ).rejects.toThrow();
    }
  });

  it('throws GitCommandError for clone failures', async () => {
    await expect(
      cloneRemoteSource({
        provider: 'gitlab',
        packageId: 'missing/repo',
        cloneUrl: join(tempRoot, 'missing.git'),
        ref: 'main',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
      })
    ).rejects.toBeInstanceOf(GitCommandError);
  });
});

const createRepo = async (repoDir: string): Promise<string> => {
  await mkdir(join(repoDir, 'skills/one'), { recursive: true });
  await writeFile(join(repoDir, 'skills/one/SKILL.md'), '# One');
  await runCommand('git', ['init', '--initial-branch=main'], repoDir);
  await runCommand(
    'git',
    ['config', 'user.email', 'test@example.com'],
    repoDir
  );
  await runCommand('git', ['config', 'user.name', 'Test User'], repoDir);
  await runCommand('git', ['add', '.'], repoDir);
  await runCommand('git', ['commit', '-m', 'add skill'], repoDir);
  const result = await runCommand('git', ['rev-parse', 'HEAD'], repoDir);
  return result.output.trim();
};

const runCommand = async (
  command: string,
  args: string[],
  cwd: string
): Promise<{ output: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => stdout.push(chunk));
    child.stderr.on('data', (chunk: string) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const output = `${stdout.join('')}${stderr.join('')}`;
      if (code !== 0) {
        reject(new Error(output));
        return;
      }
      resolve({ output });
    });
  });

const mkdtemp = async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  return mkdtemp(join(tmpdir(), 'ai-pkgs-git-'));
};

const rmTemp = async (dir: string) => {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { force: true, recursive: true });
};
