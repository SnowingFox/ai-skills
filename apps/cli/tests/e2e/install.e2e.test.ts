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

  it('prints manifest skills as JSON', async () => {
    const projectDir = join(tempRoot, 'list-json-project');
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify({
        skills: {
          local: {
            source: 'file:.',
            path: 'skills/local',
          },
        },
      })
    );

    const result = await runCliProcess(projectDir, {}, [
      'skills',
      'list',
      '--json',
    ]);

    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.output) as {
      name: string;
      path: string;
    }[];
    expect(parsed).toEqual([
      expect.objectContaining({ name: 'local', path: 'skills/local' }),
    ]);
  });

  it('adds skills to the global manifest and installs globally', async () => {
    const projectDir = join(tempRoot, 'global-add-project');
    const sourceDir = join(tempRoot, 'global-add-source');
    const homeDir = join(tempRoot, 'global-home');
    await mkdir(projectDir, { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await mkdir(join(sourceDir, 'skills/tdd'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/tdd/SKILL.md'), '# TDD');

    const result = await runCliProcess(projectDir, { HOME: homeDir }, [
      'skills',
      'add',
      sourceDir,
      '--global',
      '--skill',
      'tdd',
      '--agent',
      'cursor',
      '--force',
      '--yes',
    ]);

    expect(result.code).toBe(0);
    await expect(
      readFile(join(homeDir, '.cursor/skills/tdd/SKILL.md'), 'utf-8')
    ).resolves.toBe('# TDD');
    const globalManifest = await readFile(
      join(homeDir, '.ai-pkgs/ai-package.json'),
      'utf-8'
    );
    expect(globalManifest).toContain('"tdd"');
    expect(globalManifest).toContain(`"source": "file:${sourceDir}"`);
  });

  it('supports global install-only without writing the global manifest', async () => {
    const projectDir = join(tempRoot, 'global-install-only-project');
    const sourceDir = join(tempRoot, 'global-install-only-source');
    const homeDir = join(tempRoot, 'global-install-only-home');
    await mkdir(projectDir, { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await mkdir(join(sourceDir, 'skills/tdd'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/tdd/SKILL.md'), '# TDD');

    const result = await runCliProcess(projectDir, { HOME: homeDir }, [
      'skills',
      'add',
      sourceDir,
      '--global',
      '--install-only',
      '--skill',
      'tdd',
      '--agent',
      'cursor',
      '--force',
      '--yes',
    ]);

    expect(result.code).toBe(0);
    await expect(
      readFile(join(homeDir, '.cursor/skills/tdd/SKILL.md'), 'utf-8')
    ).resolves.toBe('# TDD');
    await expect(
      readFile(join(homeDir, '.ai-pkgs/ai-package.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('restores global manifest skills with install --global', async () => {
    const projectDir = join(tempRoot, 'global-install-project');
    const sourceDir = join(tempRoot, 'global-install-source');
    const homeDir = join(tempRoot, 'global-install-home');
    await mkdir(projectDir, { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await mkdir(join(sourceDir, 'skills/tdd'), { recursive: true });
    await mkdir(join(homeDir, '.ai-pkgs'), { recursive: true });
    await writeFile(join(sourceDir, 'skills/tdd/SKILL.md'), '# TDD');
    await writeFile(
      join(homeDir, '.ai-pkgs/ai-package.json'),
      JSON.stringify({
        skills: {
          tdd: {
            source: `file:${sourceDir}`,
            path: 'skills/tdd',
          },
        },
      })
    );

    const result = await runCliProcess(projectDir, { HOME: homeDir }, [
      'install',
      '--global',
      '--agent',
      'cursor',
      '--force',
      '--yes',
    ]);

    expect(result.code).toBe(0);
    await expect(
      readFile(join(homeDir, '.cursor/skills/tdd/SKILL.md'), 'utf-8')
    ).resolves.toBe('# TDD');
  });

  it('lists and removes global manifest skills', async () => {
    const projectDir = join(tempRoot, 'global-list-project');
    const sourceDir = join(tempRoot, 'global-list-source');
    const homeDir = join(tempRoot, 'global-list-home');
    await mkdir(projectDir, { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await mkdir(join(homeDir, '.ai-pkgs'), { recursive: true });
    await writeFile(
      join(homeDir, '.ai-pkgs/ai-package.json'),
      JSON.stringify({
        skills: {
          tdd: {
            source: `file:${sourceDir}`,
            path: 'skills/tdd',
          },
        },
      })
    );

    const listed = await runCliProcess(projectDir, { HOME: homeDir }, [
      'skills',
      'list',
      '--global',
    ]);
    const removed = await runCliProcess(projectDir, { HOME: homeDir }, [
      'skills',
      'remove',
      'tdd',
      '--global',
    ]);
    const manifestAfter = await readFile(
      join(homeDir, '.ai-pkgs/ai-package.json'),
      'utf-8'
    );

    expect(listed.code).toBe(0);
    expect(listed.output).toContain('tdd');
    expect(removed.code).toBe(0);
    expect(manifestAfter).not.toContain('"tdd"');
  });

  it('reports outdated Git skills without writing the manifest', async () => {
    const repoDir = join(tempRoot, 'outdated-repo');
    const projectDir = join(tempRoot, 'outdated-project');
    await mkdir(projectDir, { recursive: true });
    const oldSha = await createGitRepo(repoDir, 'skills/tdd', '# TDD v1');
    const newSha = await commitGitRepo(
      repoDir,
      'skills/tdd/SKILL.md',
      '# TDD v2'
    );
    const gitConfigPath = await writeGitConfig({
      repoDir,
      source: 'https://github.com/acme/skills.git',
    });
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify(
        {
          skills: {
            tdd: {
              source: 'github:acme/skills',
              version: `main@${oldSha}`,
              path: 'skills/tdd',
            },
            reviewer: {
              source: 'github:acme/skills',
              version: `main@${oldSha}`,
              path: 'skills/reviewer',
            },
          },
        },
        null,
        2
      )
    );

    const result = await runCliProcess(
      projectDir,
      { GIT_CONFIG_GLOBAL: gitConfigPath },
      ['skills', 'outdated']
    );
    const manifestAfter = await readFile(
      join(projectDir, 'ai-package.json'),
      'utf-8'
    );

    expect(result.code).toBe(0);
    expect(stripAnsi(result.output)).toContain('outdated: 2');
    expect(stripAnsi(result.output)).toContain(
      `tdd main@${oldSha.slice(0, 7)} -> main@${newSha.slice(0, 7)}`
    );
    expect(manifestAfter).toContain(oldSha);
    expect(manifestAfter).not.toContain(newSha);
  });

  it('updates Git pins only when --yes confirms non-interactive writes', async () => {
    const repoDir = join(tempRoot, 'update-repo');
    const projectDir = join(tempRoot, 'update-project');
    await mkdir(projectDir, { recursive: true });
    const oldSha = await createGitRepo(repoDir, 'skills/tdd', '# TDD v1');
    const newSha = await commitGitRepo(
      repoDir,
      'skills/tdd/SKILL.md',
      '# TDD v2'
    );
    const gitConfigPath = await writeGitConfig({
      repoDir,
      source: 'https://github.com/acme/skills.git',
    });
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify(
        {
          skills: {
            tdd: {
              source: 'github:acme/skills',
              version: `main@${oldSha}`,
              path: 'skills/tdd',
            },
          },
        },
        null,
        2
      )
    );

    const denied = await runCliProcess(
      projectDir,
      { GIT_CONFIG_GLOBAL: gitConfigPath },
      ['skills', 'update', 'tdd'],
      { allowFailure: true }
    );
    const beforeYes = await readFile(
      join(projectDir, 'ai-package.json'),
      'utf-8'
    );
    const updated = await runCliProcess(
      projectDir,
      { GIT_CONFIG_GLOBAL: gitConfigPath },
      ['skills', 'update', 'tdd', '--yes']
    );
    const afterYes = await readFile(
      join(projectDir, 'ai-package.json'),
      'utf-8'
    );

    expect(denied.code).toBe(1);
    expect(denied.output).toContain('Pass --yes to update skills');
    expect(beforeYes).toContain(oldSha);
    expect(updated.code).toBe(0);
    expect(stripAnsi(updated.output)).toContain('updated: 1');
    expect(afterYes).toContain(newSha);
  });

  it('updates Git pins in the global manifest', async () => {
    const repoDir = join(tempRoot, 'global-update-repo');
    const projectDir = join(tempRoot, 'global-update-project');
    const homeDir = join(tempRoot, 'global-update-home');
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(homeDir, '.ai-pkgs'), { recursive: true });
    const oldSha = await createGitRepo(repoDir, 'skills/tdd', '# TDD v1');
    const newSha = await commitGitRepo(
      repoDir,
      'skills/tdd/SKILL.md',
      '# TDD v2'
    );
    const gitConfigPath = await writeGitConfig({
      repoDir,
      source: 'https://github.com/acme/global-skills.git',
    });
    await writeFile(
      join(homeDir, '.ai-pkgs/ai-package.json'),
      JSON.stringify(
        {
          skills: {
            tdd: {
              source: 'github:acme/global-skills',
              version: `main@${oldSha}`,
              path: 'skills/tdd',
            },
          },
        },
        null,
        2
      )
    );

    const result = await runCliProcess(
      projectDir,
      { GIT_CONFIG_GLOBAL: gitConfigPath, HOME: homeDir },
      ['skills', 'update', '--global', '--yes']
    );
    const manifestAfter = await readFile(
      join(homeDir, '.ai-pkgs/ai-package.json'),
      'utf-8'
    );

    expect(result.code).toBe(0);
    expect(stripAnsi(result.output)).toContain('updated: 1');
    expect(manifestAfter).toContain(newSha);
  });

  it('does not partially update when one selected skill check fails', async () => {
    const repoDir = join(tempRoot, 'partial-repo');
    const missingRepo = join(tempRoot, 'missing-repo');
    const projectDir = join(tempRoot, 'partial-project');
    await mkdir(projectDir, { recursive: true });
    const oldSha = await createGitRepo(repoDir, 'skills/tdd', '# TDD v1');
    const newSha = await commitGitRepo(
      repoDir,
      'skills/tdd/SKILL.md',
      '# TDD v2'
    );
    const gitConfigPath = await writeGitConfig(
      {
        repoDir,
        source: 'https://github.com/acme/skills.git',
      },
      {
        repoDir: missingRepo,
        source: 'https://github.com/missing/skills.git',
      }
    );
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify(
        {
          skills: {
            tdd: {
              source: 'github:acme/skills',
              version: `main@${oldSha}`,
              path: 'skills/tdd',
            },
            broken: {
              source: 'github:missing/skills',
              version: `main@${oldSha}`,
              path: 'skills/broken',
            },
          },
        },
        null,
        2
      )
    );

    const result = await runCliProcess(
      projectDir,
      { GIT_CONFIG_GLOBAL: gitConfigPath },
      ['skills', 'update', '--yes'],
      { allowFailure: true }
    );
    const manifestAfter = await readFile(
      join(projectDir, 'ai-package.json'),
      'utf-8'
    );

    expect(result.code).toBe(1);
    expect(stripAnsi(result.output)).toContain('failed: 1');
    expect(manifestAfter).toContain(oldSha);
    expect(manifestAfter).not.toContain(newSha);
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
    expect(stripAnsi(result.output)).toContain('◇  Materializing sources');
    expect(stripAnsi(result.output)).toContain('copy: 1 skill -> Cursor');
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
    expect(cachedOutput).toContain(
      '◇  reusing Git cache for verified remote ref'
    );
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

  it('aggregates ai install progress for repeated cached git sources', async () => {
    const githubRepo = join(tempRoot, 'ai-install-cache-repo');
    const projectDir = join(tempRoot, 'ai-install-cache-project');
    await mkdir(projectDir, { recursive: true });
    const commit = await createGitRepo(
      githubRepo,
      'skills/shared',
      '# Shared Skill'
    );

    const gitConfigPath = join(tempRoot, 'ai-install-cache-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/install-cache.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify(
        {
          skills: {
            first: {
              source: 'github:acme/install-cache',
              version: `main@${commit}`,
              path: 'skills/shared',
            },
            second: {
              source: 'github:acme/install-cache',
              version: `main@${commit}`,
              path: 'skills/shared',
            },
          },
        },
        null,
        2
      )
    );

    await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['--ai', 'install', '--yes', '--agent', 'cursor', '--force']
    );
    const cachedResult = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['--ai', 'install', '--yes', '--agent', 'cursor', '--force']
    );

    const output = stripAnsi(cachedResult.output);
    expect(cachedResult.code).toBe(0);
    expect(output).toContain('◇  reusing Git cache for verified remote ref');
    expect(output).toContain('source: github:acme/install-cache');
    expect(output).toContain('copy: 2 skills -> Cursor');
    expect(output).not.toContain('cloning: first');
    expect(output).not.toContain('cloning: second');
  });

  it('migrates a legacy Vercel skills lock into ai-package.json', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-project');
    await mkdir(projectDir, { recursive: true });
    const commit = await createGitRepo(
      githubRepo,
      'skills/migrated',
      '# Migrated Skill'
    );

    const gitConfigPath = join(tempRoot, 'vercel-migrate-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-skills.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify(
        {
          version: 1,
          skills: {
            migrated: {
              source: 'acme/vercel-skills',
              sourceType: 'github',
              skillPath: 'skills/migrated/SKILL.md',
              computedHash: 'a'.repeat(64),
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
      ['--ai', 'skills', 'vercel-migrate', '--skip-existing', '--yes']
    );

    const output = stripAnsi(result.output);
    expect(result.code).toBe(0);
    expect(output).toContain('updated:');
    expect(output).toContain('◆  Vercel skills migration complete');
    await expect(
      readFile(join(projectDir, 'skills-lock.json'), 'utf-8')
    ).resolves.toContain('computedHash');
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).resolves.toBe(
      `${JSON.stringify(
        {
          skills: {
            migrated: {
              source: 'github:acme/vercel-skills',
              path: 'skills/migrated',
              version: `main@${commit}`,
            },
          },
        },
        null,
        2
      )}\n`
    );
  });

  it('migrates a legacy lock without skillPath by matching discovered names', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-discover-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-discover-project');
    await mkdir(projectDir, { recursive: true });
    const commit = await createGitRepo(
      githubRepo,
      'skills/migrated',
      '# Migrated Skill'
    );

    const gitConfigPath = join(tempRoot, 'vercel-migrate-discover-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-discover.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          migrated: {
            source: 'acme/vercel-discover',
            sourceType: 'github',
            computedHash: 'f'.repeat(64),
          },
        },
      })
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['--ai', 'skills', 'vercel-migrate', '--skip-existing', '--yes']
    );

    expect(result.code).toBe(0);
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).resolves.toBe(
      `${JSON.stringify(
        {
          skills: {
            migrated: {
              source: 'github:acme/vercel-discover',
              path: 'skills/migrated',
              version: `main@${commit}`,
            },
          },
        },
        null,
        2
      )}\n`
    );
  });

  it('fails non-interactive missing skillPath resolution without a name match', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-no-match-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-no-match-project');
    await mkdir(projectDir, { recursive: true });
    await createGitRepo(githubRepo, 'skills/available', '# Available Skill');

    const gitConfigPath = join(tempRoot, 'vercel-migrate-no-match-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-no-match.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          missing: {
            source: 'acme/vercel-no-match',
            sourceType: 'github',
            computedHash: '1'.repeat(64),
          },
        },
      })
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['--ai', 'skills', 'vercel-migrate', '--skip-existing', '--yes'],
      { allowFailure: true }
    );

    expect(result.code).toBe(1);
    expect(result.output).toContain(
      'Could not infer skillPath for legacy skill "missing".'
    );
    expect(result.output).toContain('available (skills/available)');
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('migrates and installs the final manifest when requested', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-install-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-install-project');
    await mkdir(projectDir, { recursive: true });
    await createGitRepo(githubRepo, 'skills/migrated', '# Migrated Skill');

    const gitConfigPath = join(tempRoot, 'vercel-migrate-install-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-install.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          migrated: {
            source: 'acme/vercel-install',
            sourceType: 'github',
            skillPath: 'skills/migrated/SKILL.md',
            computedHash: 'b'.repeat(64),
          },
        },
      })
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      [
        '--ai',
        'skills',
        'vercel-migrate',
        '--install',
        '--agent',
        'cursor',
        '--force',
        '--yes',
      ]
    );

    const output = stripAnsi(result.output);
    expect(result.code).toBe(0);
    expect(output).toContain('◆  Vercel skills migration complete');
    expect(output).toContain('◇  Materializing sources');
    expect(output).toContain('◆  Installed 1 skill(s)');
    await expect(
      readFile(join(projectDir, '.cursor/skills/migrated/SKILL.md'), 'utf-8')
    ).resolves.toBe('# Migrated Skill');
  });

  it('fails migration conflicts in ai mode without an explicit policy', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-conflict-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-conflict-project');
    await mkdir(projectDir, { recursive: true });
    await createGitRepo(githubRepo, 'skills/migrated', '# Migrated Skill');

    const gitConfigPath = join(tempRoot, 'vercel-migrate-conflict-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-conflict.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          migrated: {
            source: 'acme/vercel-conflict',
            sourceType: 'github',
            skillPath: 'skills/migrated/SKILL.md',
            computedHash: 'c'.repeat(64),
          },
        },
      })
    );
    await writeFile(
      join(projectDir, 'ai-package.json'),
      JSON.stringify({
        skills: {
          migrated: {
            source: 'file:.',
            path: 'skills/local',
          },
        },
      })
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['--ai', 'skills', 'vercel-migrate', '--yes'],
      { allowFailure: true }
    );

    expect(result.code).toBe(1);
    expect(result.output).toContain('Pass --force to overwrite');
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).resolves.toContain('file:.');
  });

  it('removes the legacy lock only after a successful manifest write', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-remove-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-remove-project');
    await mkdir(projectDir, { recursive: true });
    await createGitRepo(githubRepo, 'skills/migrated', '# Migrated Skill');

    const gitConfigPath = join(tempRoot, 'vercel-migrate-remove-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-remove.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          migrated: {
            source: 'acme/vercel-remove',
            sourceType: 'github',
            skillPath: 'skills/migrated/SKILL.md',
            computedHash: 'd'.repeat(64),
          },
        },
      })
    );

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      [
        '--ai',
        'skills',
        'vercel-migrate',
        '--remove-lock',
        '--skip-existing',
        '--yes',
      ]
    );

    expect(result.code).toBe(0);
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).resolves.toContain('github:acme/vercel-remove');
    await expect(
      readFile(join(projectDir, 'skills-lock.json'), 'utf-8')
    ).rejects.toThrow();
  });

  it('does not replace malformed existing manifests during migration', async () => {
    const githubRepo = join(tempRoot, 'vercel-migrate-malformed-repo');
    const projectDir = join(tempRoot, 'vercel-migrate-malformed-project');
    await mkdir(projectDir, { recursive: true });
    await createGitRepo(githubRepo, 'skills/migrated', '# Migrated Skill');

    const gitConfigPath = join(tempRoot, 'vercel-migrate-malformed-gitconfig');
    await writeFile(
      gitConfigPath,
      [
        `[url "${pathToFileURL(githubRepo).href}"]`,
        '\tinsteadOf = https://github.com/acme/vercel-malformed.git',
        '',
      ].join('\n')
    );
    await writeFile(
      join(projectDir, 'skills-lock.json'),
      JSON.stringify({
        version: 1,
        skills: {
          migrated: {
            source: 'acme/vercel-malformed',
            sourceType: 'github',
            skillPath: 'skills/migrated/SKILL.md',
            computedHash: 'e'.repeat(64),
          },
        },
      })
    );
    await writeFile(join(projectDir, 'ai-package.json'), '{"skills":');

    const result = await runCliProcess(
      projectDir,
      {
        GIT_CONFIG_GLOBAL: gitConfigPath,
      },
      ['--ai', 'skills', 'vercel-migrate', '--force', '--yes'],
      { allowFailure: true }
    );

    expect(result.code).toBe(1);
    await expect(
      readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    ).resolves.toBe('{"skills":');
    await expect(
      readFile(join(projectDir, 'skills-lock.json'), 'utf-8')
    ).resolves.toContain('computedHash');
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
    expect(result.output).toContain('Install complete');
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

const commitGitRepo = async (
  repoDir: string,
  relativePath: string,
  content: string
): Promise<string> => {
  await writeFile(join(repoDir, relativePath), content);
  await runCommand('git', ['add', '.'], repoDir);
  await runCommand('git', ['commit', '-m', 'update skill'], repoDir);
  const result = await runCommand('git', ['rev-parse', 'HEAD'], repoDir);
  return result.output.trim();
};

const writeGitConfig = async (
  ...mappings: { repoDir: string; source: string }[]
): Promise<string> => {
  const gitConfigPath = join(tempRoot, `gitconfig-${mappings.length}`);
  await writeFile(
    gitConfigPath,
    mappings
      .map(({ repoDir, source }) =>
        [
          `[url "${pathToFileURL(repoDir).href}"]`,
          `\tinsteadOf = ${source}`,
        ].join('\n')
      )
      .join('\n')
  );
  return gitConfigPath;
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
