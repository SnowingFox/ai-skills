import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installSkills } from '../../src/install';
import type { CloneSource } from '../../src/types';

let tempRoot: string;

const writeSkill = async (
  sourceRoot: string,
  skillPath: string,
  body: string
) => {
  const skillDir = join(sourceRoot, skillPath);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), body);
  await writeFile(join(skillDir, 'notes.txt'), 'extra file');
};

beforeEach(async () => {
  tempRoot = await mkdtemp();
});

afterEach(async () => {
  await rmTemp(tempRoot);
});

describe('installSkills', () => {
  it('copies explicit GitHub and GitLab skill paths into .agents/skills', async () => {
    const projectDir = join(tempRoot, 'project');
    const githubRoot = join(tempRoot, 'github-source');
    const gitlabRoot = join(tempRoot, 'gitlab-source');
    await mkdir(projectDir, { recursive: true });
    await writeSkill(githubRoot, 'skills/find-skills', '# Find Skills');
    await writeSkill(gitlabRoot, 'packages/reviewer', '# Reviewer');

    const cloneCalls: Parameters<CloneSource>[0][] = [];
    const cloneSource: CloneSource = async (request) => {
      cloneCalls.push(request);
      if (request.provider === 'github') return githubRoot;
      return gitlabRoot;
    };

    const result = await installSkills({
      manifest: {
        skills: [
          {
            name: 'find-skills',
            provider: 'github',
            packageId: 'vercel-labs/skills',
            cloneUrl: 'https://github.com/vercel-labs/skills.git',
            ref: 'main',
            commitSha: 'df0579f85cb8a360473c921e1343359006100d3c',
            path: 'skills/find-skills',
          },
          {
            name: 'reviewer',
            provider: 'gitlab',
            packageId: 'platform/ai/agent-skills',
            cloneUrl: 'https://gitlab.com/platform/ai/agent-skills.git',
            ref: 'release',
            commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
            path: 'packages/reviewer',
          },
        ],
        plugins: [],
      },
      projectDir,
      cloneSource,
    });

    expect(result.installed).toEqual([
      {
        name: 'find-skills',
        targetDir: join(projectDir, '.agents/skills/find-skills'),
      },
      {
        name: 'reviewer',
        targetDir: join(projectDir, '.agents/skills/reviewer'),
      },
    ]);
    expect(cloneCalls).toEqual([
      {
        provider: 'github',
        packageId: 'vercel-labs/skills',
        cloneUrl: 'https://github.com/vercel-labs/skills.git',
        ref: 'main',
        commitSha: 'df0579f85cb8a360473c921e1343359006100d3c',
      },
      {
        provider: 'gitlab',
        packageId: 'platform/ai/agent-skills',
        cloneUrl: 'https://gitlab.com/platform/ai/agent-skills.git',
        ref: 'release',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
      },
    ]);
    await expect(
      readFile(join(projectDir, '.agents/skills/find-skills/SKILL.md'), 'utf-8')
    ).resolves.toBe('# Find Skills');
    await expect(
      readFile(join(projectDir, '.agents/skills/reviewer/notes.txt'), 'utf-8')
    ).resolves.toBe('extra file');
  });

  it('installs file sources and emits progress', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    const targetDir = join(tempRoot, 'target');
    await mkdir(projectDir, { recursive: true });
    await writeSkill(sourceRoot, 'skills/local', '# Local');

    const progress: string[] = [];
    const result = await installSkills({
      manifest: {
        skills: [
          {
            name: 'local',
            provider: 'file',
            packageId: '.',
            sourceRoot,
            path: 'skills/local',
          },
        ],
        plugins: [],
      },
      projectDir,
      targetDir,
      onProgress: ({ name, status }) => progress.push(`${status}:${name}`),
    });

    expect(result.installed).toEqual([
      { name: 'local', targetDir: join(targetDir, 'local') },
    ]);
    expect(progress).toEqual(['copying:local', 'installed:local']);
    await expect(
      readFile(join(targetDir, 'local/SKILL.md'), 'utf-8')
    ).resolves.toBe('# Local');
  });

  it('reuses a clone for multiple skills at the same commit and cleans it up', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    await mkdir(projectDir, { recursive: true });
    await writeSkill(sourceRoot, 'skills/one', '# One');
    await writeSkill(sourceRoot, 'skills/two', '# Two');

    let cloneCount = 0;
    let cleanupCount = 0;
    await installSkills({
      manifest: {
        skills: ['one', 'two'].map((name) => ({
          name,
          provider: 'github',
          packageId: 'owner/repo',
          cloneUrl: 'https://github.com/owner/repo.git',
          ref: 'main',
          commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
          path: `skills/${name}`,
        })),
        plugins: [],
      },
      projectDir,
      cloneSource: async () => {
        cloneCount += 1;
        return {
          rootDir: sourceRoot,
          cleanup: async () => {
            cleanupCount += 1;
          },
        };
      },
    });

    expect(cloneCount).toBe(1);
    expect(cleanupCount).toBe(1);
  });

  it('fails when the manifest path does not contain SKILL.md', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    await mkdir(join(sourceRoot, 'skills/empty'), { recursive: true });
    await mkdir(projectDir, { recursive: true });

    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'empty',
              provider: 'github',
              packageId: 'owner/repo',
              cloneUrl: 'https://github.com/owner/repo.git',
              ref: 'main',
              commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
              path: 'skills/empty',
            },
          ],
          plugins: [],
        },
        projectDir,
        cloneSource: async () => sourceRoot,
      })
    ).rejects.toThrow('does not contain SKILL.md');
  });

  it('fails when the skill path is missing or not a directory', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(join(sourceRoot, 'SKILL.md'), '# Root file');
    await mkdir(projectDir, { recursive: true });

    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'missing',
              provider: 'file',
              packageId: '.',
              sourceRoot,
              path: 'missing',
            },
          ],
          plugins: [],
        },
        projectDir,
      })
    ).rejects.toThrow('path does not exist');

    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'file',
              provider: 'file',
              packageId: '.',
              sourceRoot,
              path: 'SKILL.md',
            },
          ],
          plugins: [],
        },
        projectDir,
      })
    ).rejects.toThrow('path must be a directory');
  });

  it('rejects paths that escape the cloned source', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    await mkdir(projectDir, { recursive: true });
    await writeSkill(sourceRoot, 'skills/one', '# One');

    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'unsafe',
              provider: 'file',
              packageId: '.',
              sourceRoot,
              path: '../outside',
            },
          ],
          plugins: [],
        },
        projectDir,
      })
    ).rejects.toThrow('must stay inside the source');
  });

  it('fails when SKILL.md is present but not a file', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    await mkdir(join(sourceRoot, 'skills/bad/SKILL.md'), { recursive: true });
    await mkdir(projectDir, { recursive: true });

    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'bad',
              provider: 'file',
              packageId: '.',
              sourceRoot,
              path: 'skills/bad',
            },
          ],
          plugins: [],
        },
        projectDir,
      })
    ).rejects.toThrow('does not contain SKILL.md');
  });

  it('does not run cleanup for rejected clone promises', async () => {
    const projectDir = join(tempRoot, 'project');
    await mkdir(projectDir, { recursive: true });

    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'one',
              provider: 'github',
              packageId: 'owner/repo',
              cloneUrl: 'https://github.com/owner/repo.git',
              ref: 'main',
              commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
              path: 'skills/one',
            },
          ],
          plugins: [],
        },
        projectDir,
        cloneSource: async () => {
          throw new Error('clone failed');
        },
      })
    ).rejects.toThrow('clone failed');
  });

  it('cleans up fulfilled clones when a later skill fails', async () => {
    const projectDir = join(tempRoot, 'project');
    const sourceRoot = join(tempRoot, 'source');
    await mkdir(projectDir, { recursive: true });
    await writeSkill(sourceRoot, 'skills/one', '# One');

    let cleanupCount = 0;
    await expect(
      installSkills({
        manifest: {
          skills: [
            {
              name: 'one',
              provider: 'github',
              packageId: 'owner/repo',
              cloneUrl: 'https://github.com/owner/repo.git',
              ref: 'main',
              commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
              path: 'skills/one',
            },
            {
              name: 'missing',
              provider: 'gitlab',
              packageId: 'owner/repo',
              cloneUrl: 'https://gitlab.com/owner/repo.git',
              ref: 'main',
              commitSha: '1234567890abcdef1234567890abcdef12345678',
              path: 'skills/missing',
            },
          ],
          plugins: [],
        },
        projectDir,
        cloneSource: async () => ({
          rootDir: sourceRoot,
          cleanup: async () => {
            cleanupCount += 1;
          },
        }),
      })
    ).rejects.toThrow('path does not exist');

    expect(cleanupCount).toBe(2);
  });
});

const mkdtemp = async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  return mkdtemp(join(tmpdir(), 'ai-pkgs-test-'));
};

const rmTemp = async (dir: string) => {
  const { rm } = await import('node:fs/promises');
  await rm(dir, { force: true, recursive: true });
};
