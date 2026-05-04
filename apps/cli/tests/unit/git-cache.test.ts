import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearGitCache,
  getGitCachePath,
  gitCacheSourceKey,
  materializeCachedGitSource,
} from '../../src/git-cache';
import type { GitProgressEvent } from '../../src/git';

let tempRoot: string;
let previousCacheHome: string | undefined;

beforeEach(async () => {
  tempRoot = await mkdtemp();
  previousCacheHome = process.env.AI_PKGS_CACHE_HOME;
  process.env.AI_PKGS_CACHE_HOME = join(tempRoot, 'cache-home');
});

afterEach(async () => {
  if (previousCacheHome === undefined) {
    delete process.env.AI_PKGS_CACHE_HOME;
  } else {
    process.env.AI_PKGS_CACHE_HOME = previousCacheHome;
  }
  await rmTemp(tempRoot);
});

describe('git cache', () => {
  it('builds stable cache paths for provider source and commit', () => {
    expect(gitCacheSourceKey('vercel-labs/skills')).toBe('vercel-labs/skills');
    expect(
      getGitCachePath({
        provider: 'github',
        packageId: 'vercel-labs/skills',
        commitSha: 'abcdef',
      })
    ).toContain('github/vercel-labs/skills/abcdef');
  });

  it('reuses cached materialization by commit sha', async () => {
    const source = join(tempRoot, 'source');
    const commitSha = await createGitRepo(source);
    const events: GitProgressEvent[] = [];

    const first = await materializeCachedGitSource({
      provider: 'github',
      packageId: 'acme/skills',
      cloneUrl: source,
      ref: 'main',
      commitSha,
      onProgress: (event) => events.push(event),
    });
    const second = await materializeCachedGitSource({
      provider: 'github',
      packageId: 'acme/skills',
      cloneUrl: source,
      ref: 'release',
      commitSha,
      onProgress: (event) => events.push(event),
    });

    expect(second.rootDir).toBe(first.rootDir);
    expect(events.map((event) => event.status)).toContain('cache-hit');
    await expect(
      readFile(join(second.rootDir, 'skills/one/SKILL.md'), 'utf-8')
    ).resolves.toBe('# One');
  });

  it('refreshes an existing cache entry when requested', async () => {
    const source = join(tempRoot, 'refresh-source');
    const commitSha = await createGitRepo(source);
    const events: GitProgressEvent[] = [];

    const first = await materializeCachedGitSource({
      provider: 'github',
      packageId: 'acme/skills',
      cloneUrl: source,
      ref: 'main',
      commitSha,
    });
    await writeFile(join(first.rootDir, 'marker.txt'), 'stale');

    const refreshed = await materializeCachedGitSource({
      provider: 'github',
      packageId: 'acme/skills',
      cloneUrl: source,
      ref: 'main',
      commitSha,
      refresh: true,
      onProgress: (event) => events.push(event),
    });

    expect(refreshed.rootDir).toBe(first.rootDir);
    expect(events.map((event) => event.status)).toContain('cache-refresh');
    expect(events.map((event) => event.status)).toContain('cache-store');
    await expect(
      readFile(join(refreshed.rootDir, 'marker.txt'), 'utf-8')
    ).rejects.toThrow();
  });

  it('clears matching provider and source entries', async () => {
    const source = join(tempRoot, 'source');
    const commitSha = await createGitRepo(source);
    const cached = await materializeCachedGitSource({
      provider: 'github',
      packageId: 'acme/skills',
      cloneUrl: source,
      ref: 'main',
      commitSha,
    });

    await expect(
      readFile(join(cached.rootDir, 'skills/one/SKILL.md'), 'utf-8')
    ).resolves.toBe('# One');
    await expect(
      clearGitCache({ provider: 'github', source: 'acme/skills' })
    ).resolves.toBe(1);
    await expect(
      readFile(join(cached.rootDir, 'skills/one/SKILL.md'), 'utf-8')
    ).rejects.toThrow();
  });

  it('clears matching entries by clone URL metadata', async () => {
    const source = join(tempRoot, 'clone-url-source');
    const commitSha = await createGitRepo(source);
    const cached = await materializeCachedGitSource({
      provider: 'github',
      packageId: 'metadata-only/source',
      cloneUrl: source,
      ref: 'main',
      commitSha,
    });

    await expect(clearGitCache({ provider: 'github', source })).resolves.toBe(
      1
    );
    await expect(
      readFile(join(cached.rootDir, 'skills/one/SKILL.md'), 'utf-8')
    ).rejects.toThrow();
  });

  it('clears all provider roots when no filter is provided', async () => {
    const source = join(tempRoot, 'clear-all-source');
    const commitSha = await createGitRepo(source);
    await materializeCachedGitSource({
      provider: 'github',
      packageId: 'acme/skills',
      cloneUrl: source,
      ref: 'main',
      commitSha,
    });
    await materializeCachedGitSource({
      provider: 'gitlab',
      packageId: 'https://gitlab.com/acme/skills.git',
      cloneUrl: source,
      ref: 'main',
      commitSha,
    });

    await expect(clearGitCache({})).resolves.toBe(2);
  });
});

const createGitRepo = async (repoDir: string): Promise<string> => {
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
  return mkdtemp(join(tmpdir(), 'ai-pkgs-git-cache-'));
};

const rmTemp = async (dir: string) => {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { force: true, recursive: true });
};
