import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildConfirmMessage,
  createInstallCommandRuntime,
  formatInstallError,
  formatProgress,
  formatSkillSummary,
  resolveConflictPolicy,
  resolveManifestPath,
  runInstallCommand,
} from '../../src/install-command';
import type {
  InstallCommandRuntime,
  InstallCommandRuntimeOverrides,
} from '../../src/install-command';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp();
});

afterEach(async () => {
  await rmTemp(tempRoot);
});

describe('install command helpers', () => {
  it('resolves relative and absolute manifest paths', () => {
    expect(resolveManifestPath('/repo', 'config/ai-package.json')).toBe(
      '/repo/config/ai-package.json'
    );
    expect(resolveManifestPath('/repo', '/tmp/ai-package.json')).toBe(
      '/tmp/ai-package.json'
    );
  });

  it('formats file and remote skill summaries', () => {
    expect(
      formatSkillSummary({
        skills: [
          {
            name: 'local',
            provider: 'file',
            packageId: '.',
            sourceRoot: '/repo',
            path: 'skills/local',
          },
          {
            name: 'remote',
            provider: 'github',
            packageId: 'owner/repo',
            cloneUrl: 'https://github.com/owner/repo.git',
            ref: 'main',
            commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
            path: 'skills/remote',
          },
        ],
      })
    ).toBe(
      [
        'local\n  file:.\n  skills/local',
        'remote\n  github:owner/repo@main\n  skills/remote',
      ].join('\n\n')
    );
  });

  it('formats confirmation and progress states', () => {
    expect(buildConfirmMessage(1)).toBe('Install 1 skill?');
    expect(buildConfirmMessage(2)).toBe('Install 2 skills?');
    expect(formatProgress({ name: 'one', status: 'cloning' })).toBe(
      'cloning: one'
    );
    expect(formatProgress({ name: 'one', status: 'copying' })).toBe(
      'copying: one'
    );
    expect(formatProgress({ name: 'one', status: 'installed' })).toBe(
      'installed: one'
    );
    expect(formatInstallError(new Error('boom'))).toBe('boom');
    expect(formatInstallError('plain failure')).toBe('plain failure');
  });

  it('normalizes install command runtime dependencies', () => {
    const defaultRuntime = createInstallCommandRuntime('/repo');
    expect(defaultRuntime.cwd).toBe('/repo');
    expect(defaultRuntime.confirm).toBeTypeOf('function');
    expect(defaultRuntime.install).toBeTypeOf('function');
    expect(defaultRuntime.readTextFile).toBeTypeOf('function');

    const confirm = async () => true;
    const install = async () => ({ installed: [] });
    const readTextFile = async () => '{"skills":{}}';
    const customRuntime = createInstallCommandRuntime('/repo', {
      confirm,
      install,
      readTextFile,
    });
    expect(customRuntime.confirm).toBe(confirm);
    expect(customRuntime.install).toBe(install);
    expect(customRuntime.readTextFile).toBe(readTextFile);
  });

  it('resolves ai mode conflicts without prompting', () => {
    expect(resolveConflictPolicy({ ai: true })).toBe('fail');
    expect(resolveConflictPolicy({ ai: true, force: true })).toBe('overwrite');
    expect(resolveConflictPolicy({ ai: true, skipExisting: true })).toBe(
      'skip'
    );
  });
});

describe('runInstallCommand', () => {
  it('skips install when the manifest has no skills', async () => {
    const calls: string[] = [];
    const code = await runInstallCommand(
      { yes: true },
      runtime({
        readTextFile: async () => '{"skills":{}}',
        install: async () => {
          calls.push('install');
          return { installed: [] };
        },
      })
    );

    expect(code).toBe(0);
    expect(calls).toEqual([]);
  });

  it('asks for confirmation and stops when declined', async () => {
    const calls: string[] = [];
    const code = await runInstallCommand(
      {},
      runtime({
        confirm: async () => false,
        install: async () => {
          calls.push('install');
          return { installed: [] };
        },
      })
    );

    expect(code).toBe(1);
    expect(calls).toEqual([]);
  });

  it('installs after confirmation', async () => {
    const calls: string[] = [];
    const code = await runInstallCommand(
      { agent: 'cursor', dir: 'workspace', manifest: 'skills.json' },
      runtime({
        confirm: async () => true,
        install: async (options) => {
          calls.push(options.projectDir);
          return {
            installed: [
              { name: 'one', targetDir: '/repo/workspace/.agents/skills/one' },
            ],
          };
        },
      })
    );

    expect(code).toBe(0);
    expect(calls).toEqual(['/repo/workspace']);
  });

  it('passes installer progress through the Clack spinner formatter', async () => {
    const code = await runInstallCommand(
      { agent: 'cursor', yes: true },
      runtime({
        install: async (options) => {
          options.onProgress?.({ name: 'one', status: 'cloning' });
          options.onProgress?.({ name: 'one', status: 'copying' });
          options.onProgress?.({ name: 'one', status: 'installed' });
          return {
            installed: [{ name: 'one', targetDir: '/repo/.agents/skills/one' }],
          };
        },
      })
    );

    expect(code).toBe(0);
  });

  it('uses real file IO and the default installer for file sources', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceDir = join(projectDir, 'skills/local');
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, 'SKILL.md'), '# Local');
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

    const code = await runInstallCommand(
      { agent: 'cursor', yes: true },
      createInstallCommandRuntime(projectDir)
    );

    expect(code).toBe(0);
  });

  it('returns a failure code for malformed manifests', async () => {
    const code = await runInstallCommand(
      { yes: true },
      runtime({ readTextFile: async () => '{"skills":' })
    );

    expect(code).toBe(1);
  });

  it('fails in ai mode instead of asking for install confirmation', async () => {
    const calls: string[] = [];
    const code = await runInstallCommand(
      { ai: true },
      runtime({
        confirm: async () => {
          calls.push('confirm');
          return true;
        },
        install: async () => {
          calls.push('install');
          return { installed: [] };
        },
      })
    );

    expect(code).toBe(1);
    expect(calls).toEqual([]);
  });
});

const runtime = (
  overrides: InstallCommandRuntimeOverrides
): InstallCommandRuntime =>
  createInstallCommandRuntime('/repo', {
    confirm: async () => true,
    readTextFile: async () =>
      JSON.stringify({
        skills: {
          one: {
            source: 'file:.',
            path: 'skills/one',
          },
        },
      }),
    install: async () => ({
      installed: [{ name: 'one', targetDir: '/repo/.agents/skills/one' }],
    }),
    ...overrides,
  });

const mkdtemp = async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  return mkdtemp(join(tmpdir(), 'ai-pkgs-install-command-'));
};

const rmTemp = async (dir: string) => {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { force: true, recursive: true });
};
