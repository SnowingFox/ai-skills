import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCli,
  formatCliError,
  resolveCliResult,
  runCli,
} from '../../src/cli';
import {
  createInstallCommandRuntime,
  type InstallCommandRuntime,
} from '../../src/install-command';

describe('buildCli', () => {
  it('parses install options with cac', () => {
    const cli = buildCli(createInstallCommandRuntime('/repo'));
    cli.parse(
      [
        'node',
        'ai-pkgs',
        'install',
        '--manifest',
        'config/ai-package.json',
        '--dir',
        '/tmp/project',
        '--agent',
        'cursor',
        '--yes',
      ],
      { run: false }
    );

    expect(cli.matchedCommandName).toBe('install');
    expect(cli.options).toMatchObject({
      manifest: 'config/ai-package.json',
      dir: '/tmp/project',
      agent: 'cursor',
      yes: true,
    });
  });

  it('parses skills subcommands through the skills dispatcher', () => {
    const cli = buildCli(createInstallCommandRuntime('/repo'));
    cli.parse(['node', 'ai-pkgs', 'skills', 'list'], { run: false });

    expect(cli.matchedCommandName).toBe('skills');
    expect(cli.args).toEqual(['list']);
  });

  it('parses install-only skills add options', () => {
    const cli = buildCli(createInstallCommandRuntime('/repo'));
    cli.parse(
      [
        'node',
        'ai-pkgs',
        'skills',
        'add',
        'owner/repo',
        '--install-only',
        '--all',
        '--global',
        '--refresh',
        '--agent',
        'cursor',
      ],
      { run: false }
    );

    expect(cli.matchedCommandName).toBe('skills');
    expect(cli.args).toEqual(['add', 'owner/repo']);
    expect(cli.options).toMatchObject({
      installOnly: true,
      all: true,
      global: true,
      refresh: true,
      agent: 'cursor',
    });
  });

  it('parses cache clear options through the cache dispatcher', () => {
    const cli = buildCli(createInstallCommandRuntime('/repo'));
    cli.parse(
      [
        'node',
        'ai-pkgs',
        'cache',
        'clear',
        '--provider',
        'github',
        '--source',
        'owner/repo',
      ],
      { run: false }
    );

    expect(cli.matchedCommandName).toBe('cache');
    expect(cli.args).toEqual(['clear']);
    expect(cli.options).toMatchObject({
      provider: 'github',
      source: 'owner/repo',
    });
  });

  it('parses the global ai mode flag', () => {
    const cli = buildCli(createInstallCommandRuntime('/repo'));
    cli.parse(
      [
        'node',
        'ai-pkgs',
        '--ai',
        'skills',
        'add',
        'owner/repo',
        '--install-only',
        '--agent',
        'cursor',
      ],
      { run: false }
    );

    expect(cli.matchedCommandName).toBe('skills');
    expect(cli.options).toMatchObject({
      ai: true,
      installOnly: true,
      agent: 'cursor',
    });
  });
});

describe('runCli', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the explicit install command with injected IO', async () => {
    const installed: Parameters<
      NonNullable<InstallCommandRuntime['install']>
    >[0][] = [];
    const code = await runCli(
      ['node', 'ai-pkgs', 'install', '--yes', '--agent', 'cursor'],
      '/repo',
      {
        readTextFile: async () =>
          JSON.stringify({
            skills: {
              one: {
                source: 'file:.',
                path: 'skills/one',
              },
            },
          }),
        install: async (options) => {
          installed.push(options);
          return {
            installed: [{ name: 'one', targetDir: '/repo/.agents/skills/one' }],
          };
        },
      }
    );

    expect(code).toBe(0);
    expect(installed).toHaveLength(1);
    expect(installed[0]?.projectDir).toBe('/repo');
    expect(installed[0]?.manifest.skills[0]).toMatchObject({
      name: 'one',
      provider: 'file',
      path: 'skills/one',
    });
  });

  it('prints help instead of installing for the bare command', async () => {
    const installed: Parameters<
      NonNullable<InstallCommandRuntime['install']>
    >[0][] = [];
    const output: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });

    const code = await runCli(['node', 'ai-pkgs'], '/repo', {
      readTextFile: async () =>
        JSON.stringify({
          skills: {
            one: {
              source: 'file:.',
              path: 'skills/one',
            },
          },
        }),
      install: async (options) => {
        installed.push(options);
        return {
          installed: [{ name: 'one', targetDir: '/repo/.agents/skills/one' }],
        };
      },
    });

    expect(code).toBe(0);
    expect(installed).toHaveLength(0);
    expect(stripAnsi(output.join(''))).toContain('█████╗ ██╗');
    expect(stripAnsi(output.join(''))).toContain('Usage:');
    expect(stripAnsi(output.join(''))).toContain('Commands:');
  });

  it('returns a non-zero code for unknown commands', async () => {
    const code = await runCli(['node', 'ai-pkgs', 'publish'], '/repo');

    expect(code).toBe(1);
  });

  it('rejects install-only with an explicit manifest path', async () => {
    const errors: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      errors.push(String(chunk));
      return true;
    });

    const code = await runCli(
      [
        'node',
        'ai-pkgs',
        'skills',
        'add',
        'file:.',
        '--install-only',
        '--manifest',
        'custom.json',
      ],
      '/repo'
    );

    expect(code).toBe(1);
    expect(errors.join('')).toContain('--install-only');
    expect(errors.join('')).toContain('--manifest');
  });

  it('rejects invalid cache providers with detailed usage', async () => {
    const errors: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      errors.push(String(chunk));
      return true;
    });

    const code = await runCli(
      ['node', 'ai-pkgs', 'cache', 'clear', '--provider', 'marketplace'],
      '/repo'
    );

    expect(code).toBe(1);
    expect(errors.join('')).toContain(
      '--provider must be one of: github, gitlab'
    );
    expect(errors.join('')).toContain('Run ai-pkgs cache -h');
  });

  it('rejects mutually exclusive skills add selectors before cloning', async () => {
    const errors: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      errors.push(String(chunk));
      return true;
    });

    const code = await runCli(
      ['node', 'ai-pkgs', 'skills', 'add', 'file:.', '--all', '--skill', 'tdd'],
      '/repo'
    );

    expect(code).toBe(1);
    expect(errors.join('')).toContain('--all cannot be used with --skill');
  });

  it('runs install in ai mode without prompt allowance or spinner output', async () => {
    const installed: Parameters<
      NonNullable<InstallCommandRuntime['install']>
    >[0][] = [];
    const output: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });

    const code = await runCli(
      ['node', 'ai-pkgs', '--ai', 'install', '--yes', '--agent', 'cursor'],
      '/repo',
      {
        readTextFile: async () =>
          JSON.stringify({
            skills: {
              one: {
                source: 'file:.',
                path: 'skills/one',
              },
            },
          }),
        install: async (options) => {
          installed.push(options);
          options.onProgress?.({ name: 'one', status: 'copying' });
          options.onProgress?.({ name: 'one', status: 'installed' });
          return {
            installed: [{ name: 'one', targetDir: '/repo/.cursor/skills/one' }],
          };
        },
      }
    );

    expect(code).toBe(0);
    expect(installed[0]?.canPrompt).toBe(false);
    expect(stripAnsi(output.join(''))).toContain('◇  Installing skills');
    expect(stripAnsi(output.join(''))).toContain('◇  copying: one');
    expect(stripAnsi(output.join(''))).toContain('◆  Installed 1 skill(s)');
  });
});

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const stripAnsi = (value: string) => value.replace(ANSI_RE, '');

describe('cli result helpers', () => {
  it('normalizes sync, async, and empty cac action results', async () => {
    await expect(resolveCliResult(Promise.resolve(3))).resolves.toBe(3);
    await expect(resolveCliResult(2)).resolves.toBe(2);
    await expect(resolveCliResult(undefined)).resolves.toBe(0);
    const nonPromise = Object.fromEntries([['then', 'not a function']]);
    await expect(resolveCliResult(nonPromise)).resolves.toBe(0);
    await expect(resolveCliResult(null)).resolves.toBe(0);
  });

  it('formats Error and non-Error thrown values', () => {
    expect(formatCliError(new Error('boom'))).toBe('boom');
    expect(formatCliError('plain failure')).toBe('plain failure');
  });
});
