import { describe, expect, it } from 'vitest';
import { GitCommandError } from '../../src/git';
import { formatCloneProgress } from '../../src/cli/clone-progress';
import {
  formatGitCloneError,
  resolveInstallScope,
  resolveRegistry,
  checkSkillUpdates,
  applySkillUpdates,
  formatSkillsList,
  formatSkillsListJson,
  formatUpdateCheckResult,
} from '../../src/commands/skills';
import type { AiPackageManifest } from '../../src/types';

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

  it('resolves source registry from shorthand and clone URLs', () => {
    expect(resolveRegistry('vercel-labs/skills')).toBe('github');
    expect(resolveRegistry('https://github.com/mattpocock/skills')).toBe(
      'github'
    );
    expect(resolveRegistry('https://gitlab.example.com/group/repo.git')).toBe(
      'gitlab'
    );
    expect(resolveRegistry('https://git.example.com/team/skills.git')).toBe(
      'gitlab'
    );
    expect(resolveRegistry('git@git.example.com:team/skills.git')).toBe(
      'gitlab'
    );
    expect(resolveRegistry('lynx/skills', 'gitlab')).toBe('gitlab');
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
    ).toContain('reusing Git cache for verified remote ref');
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

describe('skills list output', () => {
  it('formats grouped manifest skills as stable text', () => {
    expect(formatSkillsList(sampleManifest())).toContain('manifest skills: 3');
    expect(formatSkillsList(sampleManifest())).toContain(
      'source github:acme/skills main@1111111'
    );
    expect(formatSkillsList(sampleManifest())).toContain('- tdd skills/tdd');
    expect(formatSkillsList(sampleManifest())).toContain(
      'source file:local-skills'
    );
  });

  it('formats manifest skills as JSON', () => {
    const parsed = JSON.parse(formatSkillsListJson(sampleManifest())) as {
      name: string;
      source: string;
      path: string;
    }[];

    expect(parsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'tdd',
          source: 'github:acme/skills',
          path: 'skills/tdd',
        }),
      ])
    );
  });
});

describe('skills outdated checks', () => {
  it('checks all skills and groups duplicate Git source refs once', async () => {
    const calls: string[] = [];
    const result = await checkSkillUpdates(sampleManifest(), [], {
      resolveRef: async ({ packageId, ref }) => {
        calls.push(`${packageId}@${ref}`);
        return { ref, commitSha: SHA_TWO };
      },
    });

    expect(calls).toEqual(['acme/skills@main']);
    expect(result.outdated.map((item) => item.skill.name)).toEqual([
      'reviewer',
      'tdd',
    ]);
    expect(result.skipped.map((item) => item.skill.name)).toEqual(['local']);
    expect(formatUpdateCheckResult(result)).toContain(
      '- tdd main@1111111 -> main@2222222'
    );
  });

  it('supports selected skills and rejects unknown names', async () => {
    const result = await checkSkillUpdates(sampleManifest(), ['tdd'], {
      resolveRef: async ({ ref }) => ({ ref, commitSha: SHA_ONE }),
    });

    expect(result.upToDate.map((item) => item.skill.name)).toEqual(['tdd']);
    await expect(
      checkSkillUpdates(sampleManifest(), ['missing'])
    ).rejects.toThrow('Available skills: local, reviewer, tdd');
  });

  it('collects failed checks without stopping other groups', async () => {
    const result = await checkSkillUpdates(
      {
        skills: [
          ...sampleManifest().skills,
          {
            name: 'other',
            provider: 'github',
            source: 'github:other/skills',
            packageId: 'other/skills',
            version: `main@${SHA_ONE}`,
            ref: 'main',
            commitSha: SHA_ONE,
            path: 'skills/other',
          },
        ],
        plugins: [],
        workspace: { skills: [] },
      },
      [],
      {
        resolveRef: async ({ packageId, ref }) => {
          if (packageId === 'acme/skills') {
            throw new Error('network unavailable');
          }
          return { ref, commitSha: SHA_ONE };
        },
      }
    );

    expect(result.failed.map((item) => item.skill.name)).toEqual([
      'reviewer',
      'tdd',
    ]);
    expect(result.upToDate.map((item) => item.skill.name)).toEqual(['other']);
  });
});

describe('skills update manifests', () => {
  it('applies only outdated skill pins', async () => {
    const result = await checkSkillUpdates(sampleManifest(), [], {
      resolveRef: async ({ ref }) => ({ ref, commitSha: SHA_TWO }),
    });
    const updated = applySkillUpdates(sampleManifest(), result);

    expect(updated.skills.find((skill) => skill.name === 'tdd')).toMatchObject({
      version: `main@${SHA_TWO}`,
      commitSha: SHA_TWO,
    });
    expect(
      updated.skills.find((skill) => skill.name === 'local')
    ).toMatchObject({
      provider: 'file',
      path: 'local-skills',
    });
  });
});

const SHA_ONE = '1111111111111111111111111111111111111111';
const SHA_TWO = '2222222222222222222222222222222222222222';

const sampleManifest = (): AiPackageManifest => ({
  skills: [
    {
      name: 'tdd',
      provider: 'github',
      source: 'github:acme/skills',
      packageId: 'acme/skills',
      version: `main@${SHA_ONE}`,
      ref: 'main',
      commitSha: SHA_ONE,
      path: 'skills/tdd',
    },
    {
      name: 'reviewer',
      provider: 'github',
      source: 'github:acme/skills',
      packageId: 'acme/skills',
      version: `main@${SHA_ONE}`,
      ref: 'main',
      commitSha: SHA_ONE,
      path: 'skills/reviewer',
    },
    {
      name: 'local',
      provider: 'file',
      source: 'file:local-skills',
      packageId: 'local-skills',
      path: 'local-skills',
      sourceRoot: '/tmp/local-skills',
    },
  ],
  plugins: [],
  workspace: { skills: [] },
});
