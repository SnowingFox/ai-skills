import { describe, expect, it } from 'vitest';
import { GitCommandError } from '../../src/git';
import {
  formatCloneProgress,
  formatGitCloneError,
  resolveInstallScope,
} from '../../src/commands/skills';

describe('skills command clone UX', () => {
  it('resolves install scope flags', async () => {
    await expect(resolveInstallScope({ global: true }, false)).resolves.toBe(
      true
    );
    await expect(resolveInstallScope({ project: true }, false)).resolves.toBe(
      false
    );
    await expect(resolveInstallScope({}, false)).resolves.toBe(false);
    await expect(
      resolveInstallScope({ project: true, global: true }, false)
    ).rejects.toThrow('--project and --global are mutually exclusive');
  });

  it('formats clone progress events', () => {
    expect(
      formatCloneProgress({
        status: 'resolving-remote',
        cloneUrl: 'https://github.com/acme/skills.git',
      })
    ).toBe('resolving remote ref: HEAD');

    expect(
      formatCloneProgress({
        status: 'cloning',
        cloneUrl: 'https://github.com/acme/skills.git',
      })
    ).toBe('cloning repository: https://github.com/acme/skills.git');

    expect(
      formatCloneProgress({
        status: 'checking-out',
        ref: 'main',
      })
    ).toBe('checking out ref: main');

    expect(
      formatCloneProgress({
        status: 'resolved',
        ref: 'main',
        commitSha: 'abcdef1234567890',
      })
    ).toBe('resolving git pin: main@abcdef1');

    expect(
      formatCloneProgress({
        status: 'cache-hit',
        provider: 'github',
        packageId: 'acme/skills',
        ref: 'main',
        commitSha: 'abcdef1234567890',
        cachePath: '/cache/acme/skills/abcdef1234567890',
      })
    ).toContain('reusing Git cache');
  });

  it('formats auth clone failures with remediation', () => {
    const error = new GitCommandError(
      'git clone failed',
      ['clone'],
      'Authentication failed',
      'auth'
    );

    expect(formatGitCloneError(error)).toContain(
      'Authentication failed while cloning the repository.'
    );
    expect(formatGitCloneError(error)).toContain('gh auth login');
    expect(formatGitCloneError(error)).toContain('Git output:');
  });
});
