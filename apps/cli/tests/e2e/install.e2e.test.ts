import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp();
});

afterEach(async () => {
  await rmTemp(tempRoot);
});

describe('ai-pkgs install e2e', () => {
  it('prints help for the bare CLI without reading ai-package.json', async () => {
    const projectDir = join(tempRoot, 'empty-project');
    await mkdir(projectDir, { recursive: true });

    const result = await runCliProcess(projectDir, {}, []);

    expect(result.code).toBe(0);
    expect(stripAnsi(result.output)).toContain('█████╗ ██╗');
    expect(stripAnsi(result.output)).toContain('Usage:');
    expect(stripAnsi(result.output)).toContain('Commands:');
    expect(stripAnsi(result.output)).not.toContain('ENOENT');
  });

  it('lists manifest skills through the skills dispatcher', async () => {
    const projectDir = join(tempRoot, 'list-project');
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify(
        {
          skills: {
            local: {
              source: 'file:.',
              path: 'skills/local',
            },
          },
        },
        null,
        2
      )
    );

    const result = await runCliProcess(projectDir, {}, ['skills', 'list']);

    expect(result.code).toBe(0);
    expect(result.output).toContain('local');
    expect(result.output).toContain('file:.');
    expect(result.output).toContain('skills/local');
  });

  it('installs a source directly without writing ai-package.json', async () => {
    const projectDir = join(tempRoot, 'install-only-project');
    const sourceDir = join(tempRoot, 'install-only-source');
    await mkdir(join(projectDir), { recursive: true });
    await mkdir(join(sourceDir, 'skills/tdd'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/tdd/SKILL.md'), '# TDD');

    const result = await runCliProcess(projectDir, {}, [
      'skills',
      'add',
      sourceDir,
      '--install-only',
      '--yes',
      '--agent',
      'cursor',
      '--force',
    ]);

    expect(result.code).toBe(0);
    await expect(
      readFile(join(projectDir, '.cursor/skills/tdd/SKILL.md'), 'utf-8')
    ).resolves.toBe('# TDD');
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('installs all discovered skills into project scope', async () => {
    const projectDir = join(tempRoot, 'all-project');
    const sourceDir = join(tempRoot, 'all-source');
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(sourceDir, 'skills/one'), { recursive: true });
    await mkdir(join(sourceDir, 'skills/two'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/one/SKILL.md'), '# One');
    await writeFile(join(sourceDir, 'skills/two/SKILL.md'), '# Two');

    const result = await runCliProcess(projectDir, {}, [
      'skills',
      'add',
      sourceDir,
      '--install-only',
      '--all',
      '--project',
      '--yes',
      '--agent',
      'cursor',
      '--force',
    ]);

    expect(result.code).toBe(0);
    await expect(
      readFile(join(projectDir, '.cursor/skills/one/SKILL.md'), 'utf-8')
    ).resolves.toBe('# One');
    await expect(
      readFile(join(projectDir, '.cursor/skills/two/SKILL.md'), 'utf-8')
    ).resolves.toBe('# Two');
  });

  it('fails ai mode installs that would need agent selection', async () => {
    const projectDir = join(tempRoot, 'ai-mode-project');
    const sourceDir = join(tempRoot, 'ai-mode-source');
    await mkdir(join(projectDir), { recursive: true });
    await mkdir(join(sourceDir, 'skills/tdd'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/tdd/SKILL.md'), '# TDD');

    const result = await runCliProcess(
      projectDir,
      {},
      [
        '--ai',
        'skills',
        'add',
        sourceDir,
        '--install-only',
        '--yes',
        '--skill',
        'tdd',
        '--force',
      ],
      { allowFailure: true }
    );

    expect(result.code).toBe(1);
    expect(result.output).toContain('No agents specified');
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('lists available skills when ai mode requests a missing skill', async () => {
    const projectDir = join(tempRoot, 'ai-missing-skill-project');
    const sourceDir = join(tempRoot, 'ai-missing-skill-source');
    await mkdir(join(projectDir), { recursive: true });
    await mkdir(join(sourceDir, 'skills/create-prd'), { recursive: true });
    await mkdir(join(sourceDir, 'skills/execute-prd'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/create-prd/SKILL.md'), '# Create');
    await writeFile(
      join(sourceDir, 'skills/execute-prd/SKILL.md'),
      '# Execute'
    );

    const result = await runCliProcess(
      projectDir,
      {},
      [
        '--ai',
        'skills',
        'add',
        sourceDir,
        '--install-only',
        '--yes',
        '--skill',
        'write-a-prd',
        '--agent',
        'cursor',
        '--force',
      ],
      { allowFailure: true }
    );

    expect(result.code).toBe(1);
    expect(result.output).toContain(
      'No matching skills found for: write-a-prd'
    );
    expect(result.output).toContain('Available skills:');
    expect(result.output).toContain('create-prd');
    expect(result.output).toContain('execute-prd');
    expect(result.output).toContain(
      'Run ai-pkgs skills -h for detailed usage.'
    );
  });

  it('uses static ai output when restoring a manifest', async () => {
    const projectDir = join(tempRoot, 'ai-restore-project');
    const sourceDir = join(projectDir, 'skills/tdd');
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, 'SKILL.md'), '# TDD');
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify({
        skills: {
          tdd: {
            source: 'file:.',
            path: 'skills/tdd',
          },
        },
      })
    );

    const result = await runCliProcess(projectDir, {}, [
      '--ai',
      'install',
      '--yes',
      '--agent',
      'cursor',
      '--force',
    ]);

    expect(result.code).toBe(0);
    expect(stripAnsi(result.output)).toContain('◇  Installing skills');
    expect(stripAnsi(result.output)).toContain('◆  Installed 1 skill(s)');
  });

  it('prints static clone progress for ai mode skills add from git', async () => {
    const githubRepo = join(tempRoot, 'ai-github-repo');
    const projectDir = join(tempRoot, 'ai-git-project');
    await mkdir(projectDir, { recursive: true });
    await createGitRepo(githubRepo, 'skills/github-skill', '# GitHub Skill');

    const gitConfigPath = join(tempRoot, 'ai-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/skills.git',
        '',
      ].join('\n')
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      [
        '--ai',
        'skills',
        'add',
        'acme/skills',
        '--install-only',
        '--yes',
        '--skill',
        'github-skill',
        '--agent',
        'cursor',
        '--force',
      ]
    );

    const output = stripAnsi(result.output);
    expect(result.code).toBe(0);
    expect(output).toContain('◇  resolving remote ref: HEAD');
    expect(output).toContain('◇  resolving git pin: main@');
    expect(output).toContain(
      '◇  cloning repository: https://github.com/acme/skills.git'
    );
    expect(output).toContain('◇  checking out commit:');
    expect(output).toContain('◇  stored Git cache:');
    expect(output).toContain('◆  Repository cloned (main@');
    await expect(
      readFile(
        join(projectDir, '.cursor/skills/github-skill/SKILL.md'),
        'utf-8'
      )
    ).resolves.toBe('# GitHub Skill');

    const cachedResult = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      [
        '--ai',
        'skills',
        'add',
        'acme/skills',
        '--install-only',
        '--yes',
        '--skill',
        'github-skill',
        '--agent',
        'cursor',
        '--force',
      ]
    );

    const cachedOutput = stripAnsi(cachedResult.output);
    expect(cachedResult.code).toBe(0);
    expect(cachedOutput).toContain('◇  reusing Git cache');
    expect(cachedOutput).toContain('source: github:acme/skills');
    expect(cachedOutput).toContain('cache-home/ai-pkgs/git');

    const clearResult = await runCliProcess(projectDir, {}, [
      'cache',
      'clear',
      '--provider',
      'github',
      '--source',
      'acme/skills',
    ]);
    expect(clearResult.code).toBe(0);
    expect(clearResult.output).toContain('Cleared 1 Git cache entry');
  });

  it('installs pinned github and gitlab skills through the CLI', async () => {
    const githubRepo = join(tempRoot, 'github-repo');
    const gitlabRepo = join(tempRoot, 'gitlab-repo');
    const projectDir = join(tempRoot, 'project');
    await mkdir(projectDir, { recursive: true });

    const githubCommit = await createGitRepo(
      githubRepo,
      'skills/github-skill',
      '# GitHub Skill'
    );
    const gitlabCommit = await createGitRepo(
      gitlabRepo,
      'nested/gitlab-skill',
      '# GitLab Skill'
    );

    const gitConfigPath = join(tempRoot, 'gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/skills.git',
        `[url "${pathToFileURL(gitlabRepo).href}"]`,
        '\tinsteadOf = https://gitlab.com/team/platform/skills.git',
        '',
      ].join('\n')
    );

    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify(
        {
          skills: {
            'github-installed': {
              source: 'github:acme/skills',
              version: `main@${githubCommit}`,
              path: 'skills/github-skill',
            },
            'gitlab-installed': {
              source: 'gitlab:https://gitlab.com/team/platform/skills.git',
              version: `main@${gitlabCommit}`,
              path: 'nested/gitlab-skill',
            },
          },
        },
        null,
        2
      )
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['install', '--yes', '--agent', 'cursor', '--force']
    );

    expect(result.code).toBe(0);
    expect(result.output).toContain('Skills install complete');
    await expect(
      readFile(
        join(projectDir, '.cursor/skills/github-installed/SKILL.md'),
        'utf-8'
      )
    ).resolves.toBe('# GitHub Skill');
    await expect(
      readFile(
        join(projectDir, '.cursor/skills/gitlab-installed/SKILL.md'),
        'utf-8'
      )
    ).resolves.toBe('# GitLab Skill');
  });
});

const createGitRepo = async (
  repoDir: string,
  skillPath: string,
  skillContent: string
): Promise<string> => {
  const skillDir = join(repoDir, skillPath);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), skillContent);
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

const runCliProcess = async (
  cwd: string,
  env: Record<string, string>,
  args: string[],
  options: { allowFailure?: boolean } = {}
): Promise<{ code: number; output: string }> => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const cliPath = join(currentDir, '../../src/cli.ts');
  return runCommand('bun', [cliPath, ...args], cwd, env, options);
};

const runCommand = async (
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
  options: { allowFailure?: boolean } = {}
): Promise<{ code: number; output: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        AI_PKGS_CACHE_HOME: join(tempRoot, 'cache-home'),
        ...env,
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

const mkdtemp = async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  return mkdtemp(join(tmpdir(), 'ai-pkgs-e2e-'));
};

const rmTemp = async (dir: string) => {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { force: true, recursive: true });
};

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const stripAnsi = (value: string) => value.replace(ANSI_RE, '');
