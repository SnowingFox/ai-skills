import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildLinkEntry,
  classifyWorkspaceStatus,
  computeNewVersion,
  defaultCommitMessage,
  discoverInstalledPaths,
  formatWorkspaceList,
  formatWorkspaceListJson,
  formatWorkspaceStatus,
  isPushRejected,
  resolveCloneUrl,
  resolveRemoveTarget,
} from '../../src/commands/workspace';
import type { SkillEntry, WorkspaceSkillEntry } from '../../src/types';

const VALID_SHA = 'c376dc971045eb38c094802ca43875d1cfa00ea4';

const entry = (
  overrides: Partial<WorkspaceSkillEntry> = {}
): WorkspaceSkillEntry => ({
  name: 'explain',
  local: '.cursor/skills/explain',
  provider: 'github',
  source: 'github:entireio/skills',
  packageId: 'entireio/skills',
  version: `main@${VALID_SHA}`,
  ref: 'main',
  commitSha: VALID_SHA,
  path: 'skills/explain',
  ...overrides,
});

describe('workspace list formatter', () => {
  it('formats an empty list with a header', () => {
    expect(formatWorkspaceList([])).toBe('workspace skills: 0\n');
  });

  it('lists entries sorted by name with local/source/path/version', () => {
    const text = formatWorkspaceList([
      entry({ name: 'zeta' }),
      entry({ name: 'alpha', local: '.claude/skills/alpha' }),
    ]);

    const lines = text.split('\n');
    expect(lines[0]).toBe('workspace skills: 2');
    expect(lines[1]).toBe(
      `- alpha github:entireio/skills main@${VALID_SHA.slice(0, 7)} .claude/skills/alpha -> skills/explain`
    );
    expect(lines[2]).toBe(
      `- zeta github:entireio/skills main@${VALID_SHA.slice(0, 7)} .cursor/skills/explain -> skills/explain`
    );
  });

  it('resolveRemoveTarget returns the matching workspace skill', () => {
    expect(resolveRemoveTarget([entry()], 'explain')).toEqual(entry());
  });

  it('resolveRemoveTarget throws with available names when not found', () => {
    expect(() =>
      resolveRemoveTarget([entry({ name: 'a' }), entry({ name: 'b' })], 'c')
    ).toThrow('"c" is not a workspace skill. Available: a, b');
  });

  it('resolveRemoveTarget handles an empty workspace gracefully', () => {
    expect(() => resolveRemoveTarget([], 'explain')).toThrow(
      '"explain" is not a workspace skill. Available: (none)'
    );
  });

  it('serializes entries as JSON', () => {
    const data = JSON.parse(formatWorkspaceListJson([entry()]));
    expect(data).toEqual([
      {
        name: 'explain',
        local: '.cursor/skills/explain',
        source: 'github:entireio/skills',
        path: 'skills/explain',
        version: `main@${VALID_SHA}`,
      },
    ]);
  });
});

const skillEntry = (overrides: Partial<SkillEntry> = {}): SkillEntry => ({
  name: 'explain',
  provider: 'github',
  source: 'github:entireio/skills',
  packageId: 'entireio/skills',
  version: `main@${VALID_SHA}`,
  ref: 'main',
  commitSha: VALID_SHA,
  path: 'skills/explain',
  ...overrides,
});

describe('workspace link helpers', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-link-'));
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true });
  });

  it('discoverInstalledPaths returns each agent dir that contains the skill', async () => {
    await mkdir(join(projectDir, '.cursor', 'skills', 'explain'), {
      recursive: true,
    });
    await mkdir(join(projectDir, '.claude', 'skills', 'explain'), {
      recursive: true,
    });

    const paths = await discoverInstalledPaths('explain', projectDir);
    expect(paths).toContain('.cursor/skills/explain');
    expect(paths).toContain('.claude/skills/explain');
  });

  it('discoverInstalledPaths returns an empty array when nothing matches', async () => {
    expect(await discoverInstalledPaths('explain', projectDir)).toEqual([]);
  });

  it('buildLinkEntry copies skills[] fields and adds local path', () => {
    const built = buildLinkEntry(skillEntry(), '.cursor/skills/explain');
    expect(built).toEqual<WorkspaceSkillEntry>({
      name: 'explain',
      local: '.cursor/skills/explain',
      provider: 'github',
      source: 'github:entireio/skills',
      packageId: 'entireio/skills',
      version: `main@${VALID_SHA}`,
      ref: 'main',
      commitSha: VALID_SHA,
      path: 'skills/explain',
    });
  });

  it('resolveCloneUrl maps github:owner/repo to an https URL', () => {
    expect(resolveCloneUrl(entry({ source: 'github:entireio/skills' }))).toBe(
      'https://github.com/entireio/skills.git'
    );
  });

  it('resolveCloneUrl passes gitlab raw URLs through', () => {
    expect(
      resolveCloneUrl(
        entry({
          source: 'gitlab:https://gitlab.example.com/team/repo.git',
          provider: 'gitlab',
          packageId: 'https://gitlab.example.com/team/repo.git',
        })
      )
    ).toBe('https://gitlab.example.com/team/repo.git');
  });

  it('resolveCloneUrl prefers cloneUrl override when present', () => {
    expect(
      resolveCloneUrl(entry({ cloneUrl: 'git@github.com:owner/repo.git' }))
    ).toBe('git@github.com:owner/repo.git');
  });

  it('defaultCommitMessage formats the chore prefix', () => {
    expect(defaultCommitMessage('explain')).toBe('chore: update explain');
  });

  it('classifyWorkspaceStatus returns "untracked" for the zero SHA', () => {
    expect(
      classifyWorkspaceStatus(
        entry({
          commitSha: '0000000',
          version: 'main@0000000',
        }),
        false
      )
    ).toBe('untracked');
  });

  it('classifyWorkspaceStatus returns "modified" when local differs', () => {
    expect(classifyWorkspaceStatus(entry(), true)).toBe('modified');
  });

  it('classifyWorkspaceStatus returns "clean" when local matches', () => {
    expect(classifyWorkspaceStatus(entry(), false)).toBe('clean');
  });

  it('formatWorkspaceStatus renders one line per skill', () => {
    const text = formatWorkspaceStatus([
      { entry: entry({ name: 'a' }), status: 'modified' },
      { entry: entry({ name: 'b' }), status: 'clean' },
    ]);
    expect(text).toBe(
      `a: modified main@${VALID_SHA.slice(0, 7)}\nb: clean main@${VALID_SHA.slice(0, 7)}\n`
    );
  });

  it('computeNewVersion preserves the locked branch and swaps the SHA', () => {
    const updated = computeNewVersion(
      entry(),
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    );
    expect(updated.version).toBe(
      'main@deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    );
    expect(updated.commitSha).toBe('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
    expect(updated.ref).toBe('main');
  });

  it('isPushRejected matches common Git rejection signatures', () => {
    expect(isPushRejected('! [rejected] main -> main (fetch first)')).toBe(
      true
    );
    expect(isPushRejected('non-fast-forward')).toBe(true);
    expect(isPushRejected('Updates were rejected because the remote')).toBe(
      true
    );
    expect(isPushRejected('Authentication failed')).toBe(false);
    expect(isPushRejected('')).toBe(false);
  });

  it('buildLinkEntry throws when the skill provider is file-backed', () => {
    expect(() =>
      buildLinkEntry(
        skillEntry({
          provider: 'file',
          source: 'file:./local',
          ref: undefined,
          commitSha: undefined,
          version: undefined,
        }),
        '.cursor/skills/explain'
      )
    ).toThrow('cannot be moved to workspace');
  });
});
