import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), 'ai-pkgs-ws-e2e-'));
});

afterEach(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

describe('ai-pkgs workspace e2e', () => {
  it('list prints an empty workspace section as plain text', async () => {
    const projectDir = await createProject({
      workspace: { skills: {} },
      skills: { stub: { source: 'file:.', path: 'skills/stub' } },
    });

    const result = await runCli(projectDir, ['workspace', 'list', '--ai']);

    expect(result.code).toBe(0);
    expect(result.output).toContain('workspace skills: 0');
  });

  it('list prints workspace entries with --json', async () => {
    const projectDir = await createProject({
      workspace: {
        skills: {
          explain: {
            local: '.cursor/skills/explain',
            source: 'github:entireio/skills',
            path: 'skills/explain',
            version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
          },
        },
      },
    });

    const result = await runCli(projectDir, [
      'workspace',
      'list',
      '--json',
      '--ai',
    ]);

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.output) as unknown[];
    expect(parsed).toEqual([
      {
        name: 'explain',
        local: '.cursor/skills/explain',
        source: 'github:entireio/skills',
        path: 'skills/explain',
        version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
      },
    ]);
  });

  it('list aliased as ws prints empty workspace', async () => {
    const projectDir = await createProject({
      workspace: { skills: {} },
      skills: { stub: { source: 'file:.', path: 'skills/stub' } },
    });

    const result = await runCli(projectDir, ['ws', 'list', '--ai']);

    expect(result.code).toBe(0);
    expect(result.output).toContain('workspace skills: 0');
  });

  it('link moves an installed skill from skills[] into workspace.skills', async () => {
    const projectDir = await createProject({
      skills: {
        explain: {
          source: 'github:entireio/skills',
          path: 'skills/explain',
          version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
        },
      },
    });
    await mkdir(join(projectDir, '.cursor', 'skills', 'explain'), {
      recursive: true,
    });
    await writeFile(
      join(projectDir, '.cursor', 'skills', 'explain', 'SKILL.md'),
      '# Explain skill'
    );

    const result = await runCli(projectDir, [
      'workspace',
      'link',
      'explain',
      '--local',
      '.cursor/skills/explain',
      '--ai',
    ]);

    expect(result.code).toBe(0);
    const manifest = JSON.parse(
      await readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    );
    expect(manifest.skills).toBeUndefined();
    expect(manifest.workspace.skills.explain).toMatchObject({
      local: '.cursor/skills/explain',
      source: 'github:entireio/skills',
      path: 'skills/explain',
    });
  });

  it('link fails when the skill is not in skills[]', async () => {
    const projectDir = await createProject({
      skills: { stub: { source: 'file:.', path: 'skills/stub' } },
    });

    const result = await runCli(
      projectDir,
      [
        'workspace',
        'link',
        'missing',
        '--local',
        '.cursor/skills/missing',
        '--ai',
      ],
      { allowFailure: true }
    );

    expect(result.code).not.toBe(0);
    expect(result.output).toContain('"missing" is not in skills');
  });

  it('remove --yes deletes the workspace entry and local files', async () => {
    const projectDir = await createProject({
      workspace: {
        skills: {
          explain: {
            local: '.cursor/skills/explain',
            source: 'github:entireio/skills',
            path: 'skills/explain',
            version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
          },
        },
      },
    });
    const localDir = join(projectDir, '.cursor', 'skills', 'explain');
    await mkdir(localDir, { recursive: true });
    await writeFile(join(localDir, 'SKILL.md'), '# Explain skill');

    const result = await runCli(projectDir, [
      'workspace',
      'remove',
      'explain',
      '--yes',
      '--ai',
    ]);

    expect(result.code).toBe(0);
    const manifest = JSON.parse(
      await readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    );
    expect(manifest.workspace).toBeUndefined();
    await expect(
      readFile(join(localDir, 'SKILL.md'), 'utf-8')
    ).rejects.toThrow();
  });

  it('remove without --yes fails in --ai mode', async () => {
    const projectDir = await createProject({
      workspace: {
        skills: {
          explain: {
            local: '.cursor/skills/explain',
            source: 'github:entireio/skills',
            path: 'skills/explain',
            version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
          },
        },
      },
    });

    const result = await runCli(
      projectDir,
      ['workspace', 'remove', 'explain', '--ai'],
      { allowFailure: true }
    );

    expect(result.code).not.toBe(0);
    expect(result.output).toContain(
      'Pass --yes to confirm removal in non-interactive mode.'
    );
  });

  it('remove fails when the skill is not in workspace', async () => {
    const projectDir = await createProject({
      workspace: { skills: {} },
      skills: { stub: { source: 'file:.', path: 'skills/stub' } },
    });

    const result = await runCli(
      projectDir,
      ['workspace', 'remove', 'missing', '--yes', '--ai'],
      { allowFailure: true }
    );

    expect(result.code).not.toBe(0);
    expect(result.output).toContain('"missing" is not a workspace skill');
  });

  it('status reports untracked for the zero SHA sentinel', async () => {
    const projectDir = await createProject({
      workspace: {
        skills: {
          explain: {
            local: '.cursor/skills/explain',
            source: 'github:entireio/skills',
            path: 'skills/explain',
            version: 'main@0000000',
          },
        },
      },
    });

    const result = await runCli(projectDir, [
      'workspace',
      'status',
      'explain',
      '--ai',
    ]);

    expect(result.code).toBe(0);
    expect(result.output).toContain('explain: untracked main@0000000');
  });

  it('push/pull round-trip via git insteadOf redirecting to a local repo', async () => {
    // Build a working remote repo with skills/explain/SKILL.md.
    const remoteDir = join(tempRoot, 'remote-repo');
    await mkdir(join(remoteDir, 'skills', 'explain'), { recursive: true });
    await writeFile(
      join(remoteDir, 'skills', 'explain', 'SKILL.md'),
      '# Initial version'
    );
    await runGit(remoteDir, ['init', '--initial-branch=main']);
    await runGit(remoteDir, ['config', 'user.email', 'test@example.com']);
    await runGit(remoteDir, ['config', 'user.name', 'Test User']);
    await runGit(remoteDir, [
      'config',
      'receive.denyCurrentBranch',
      'updateInstead',
    ]);
    await runGit(remoteDir, ['add', '.']);
    await runGit(remoteDir, ['commit', '-m', 'initial']);
    const initialSha = (
      await runGit(remoteDir, ['rev-parse', 'HEAD'])
    ).output.trim();

    // Redirect a fake gitlab URL to the local repo using GIT_CONFIG_GLOBAL.
    const fakeSource = 'https://gitlab.example.com/team/repo.git';
    const gitConfigPath = join(tempRoot, 'gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[user]`,
        `\temail = test@example.com`,
        `\tname = Test User`,
        `[url "${pathToFileURL(remoteDir).href}"]`,
        `\tinsteadOf = ${fakeSource}`,
      ].join('\n')
    );

    const projectDir = await createProject({
      workspace: {
        skills: {
          explain: {
            local: '.cursor/skills/explain',
            source: `gitlab:${fakeSource}`,
            path: 'skills/explain',
            version: `main@${initialSha}`,
          },
        },
      },
    });

    // Local edits to push.
    const localDir = join(projectDir, '.cursor', 'skills', 'explain');
    await mkdir(localDir, { recursive: true });
    await writeFile(join(localDir, 'SKILL.md'), '# Updated version');

    const pushResult = await runCli(
      projectDir,
      ['workspace', 'push', 'explain', '-m', 'chore: e2e update', '--ai'],
      { gitConfigPath }
    );

    expect(pushResult.code).toBe(0);
    expect(pushResult.output).toContain('Pushed main@');

    // Remote working tree should now reflect the local content
    // (receive.denyCurrentBranch=updateInstead updates the working tree on push).
    const remoteContent = await readFile(
      join(remoteDir, 'skills', 'explain', 'SKILL.md'),
      'utf-8'
    );
    expect(remoteContent).toBe('# Updated version');

    // Manifest version should be updated to the new commit.
    const manifestAfterPush = JSON.parse(
      await readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    );
    expect(manifestAfterPush.workspace.skills.explain.version).not.toBe(
      `main@${initialSha}`
    );

    // Drive a fresh remote commit and pull it.
    await writeFile(
      join(remoteDir, 'skills', 'explain', 'SKILL.md'),
      '# Remote-driven update'
    );
    await runGit(remoteDir, ['add', '.']);
    await runGit(remoteDir, ['commit', '-m', 'remote: update']);

    const pullResult = await runCli(
      projectDir,
      ['workspace', 'pull', 'explain', '--force', '--ai'],
      { gitConfigPath }
    );

    expect(pullResult.code).toBe(0);
    expect(pullResult.output).toContain('Pulled');
    const pulledContent = await readFile(join(localDir, 'SKILL.md'), 'utf-8');
    expect(pulledContent).toBe('# Remote-driven update');
  });
});

const createProject = async (
  manifest: Record<string, unknown>
): Promise<string> => {
  const projectDir = join(
    tempRoot,
    `project-${Math.random().toString(36).slice(2, 8)}`
  );
  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, 'ai-package.json'),
    JSON.stringify(manifest, null, 2)
  );
  return projectDir;
};

type RunOptions = { allowFailure?: boolean; gitConfigPath?: string };

const runCli = async (
  cwd: string,
  args: string[],
  options: RunOptions = {}
): Promise<{ code: number; output: string }> => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const cliPath = join(currentDir, '../../src/cli.ts');
  return runCommand('bun', [cliPath, ...args], cwd, options);
};

const runGit = (
  cwd: string,
  args: string[]
): Promise<{ code: number; output: string }> => runCommand('git', args, cwd);

const runCommand = (
  command: string,
  args: string[],
  cwd: string,
  options: RunOptions = {}
): Promise<{ code: number; output: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        AI_PKGS_CACHE_HOME: join(tempRoot, 'cache-home'),
        GIT_TERMINAL_PROMPT: '0',
        ...(options.gitConfigPath
          ? {
              GIT_CONFIG_GLOBAL: options.gitConfigPath,
              GIT_CONFIG_SYSTEM: '/dev/null',
            }
          : {}),
      },
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
      if (code !== 0 && options.allowFailure !== true) {
        reject(new Error(`${command} ${args.join(' ')} failed:\n${output}`));
        return;
      }
      resolve({ code: code ?? 0, output });
    });
  });
