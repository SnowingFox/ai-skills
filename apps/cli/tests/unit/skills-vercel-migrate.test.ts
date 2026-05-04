import { describe, expect, it, vi } from 'vitest';
import {
  mergeVercelMigrationSkills,
  normalizeLegacyVercelLockEntries,
  parseLegacyVercelSkillsLock,
  resolveMissingVercelMigrationPaths,
  resolveLockfilePath,
  resolveVercelMigrationSkills,
} from '../../src/commands/skills/vercel-migrate';
import type { DiscoveredSkill } from '../../src/discovery/discover';
import type { AiPackageManifest, RemoteSkillEntry } from '../../src/types';

const hash = 'a'.repeat(64);

describe('skills vercel-migrate helpers', () => {
  it('parses and normalizes legacy github lock entries', () => {
    const entries = parseLegacyVercelSkillsLock(
      {
        version: 1,
        skills: {
          tdd: {
            source: 'mattpocock/skills',
            sourceType: 'github',
            skillPath: 'skills/engineering/tdd/SKILL.md',
            computedHash: hash,
          },
          root: {
            source: 'mattpocock/skills',
            sourceType: 'github',
            skillPath: 'SKILL.md',
            computedHash: hash,
          },
          discovered: {
            source: 'mattpocock/skills',
            sourceType: 'github',
            computedHash: hash,
          },
        },
      },
      'skills-lock.json'
    );

    expect(entries).toHaveLength(3);
    expect(normalizeLegacyVercelLockEntries(entries)).toEqual([
      {
        name: 'tdd',
        rawSource: 'mattpocock/skills',
        path: 'skills/engineering/tdd',
      },
      {
        name: 'root',
        rawSource: 'mattpocock/skills',
        path: '.',
      },
      {
        name: 'discovered',
        rawSource: 'mattpocock/skills',
        path: undefined,
      },
    ]);
  });

  it('rejects malformed legacy lock files', () => {
    expect(() => parseLegacyVercelSkillsLock(null, 'skills-lock.json')).toThrow(
      'must be a JSON object'
    );
    expect(() =>
      parseLegacyVercelSkillsLock({ version: 2, skills: {} }, 'lock.json')
    ).toThrow('version 1');
    expect(() =>
      parseLegacyVercelSkillsLock({ version: 1, skills: [] }, 'lock.json')
    ).toThrow('"skills" object');
    expect(() =>
      parseLegacyVercelSkillsLock(
        {
          version: 1,
          skills: {
            bad: {
              source: 'owner/repo',
              sourceType: 'gitlab',
              skillPath: 'skills/bad/SKILL.md',
              computedHash: hash,
            },
          },
        },
        'lock.json'
      )
    ).toThrow('sourceType must be "github"');
    expect(() =>
      parseLegacyVercelSkillsLock(
        {
          version: 1,
          skills: {
            bad: {
              source: 'owner-only',
              sourceType: 'github',
              skillPath: 'skills/bad/SKILL.md',
              computedHash: hash,
            },
          },
        },
        'lock.json'
      )
    ).toThrow('GitHub owner/repo');
    expect(() =>
      parseLegacyVercelSkillsLock(
        {
          version: 1,
          skills: {
            bad: {
              source: 'owner/repo',
              sourceType: 'github',
              skillPath: 'skills/bad/SKILL.md',
              computedHash: 'not-a-hash',
            },
          },
        },
        'lock.json'
      )
    ).toThrow('computedHash');
  });

  it('rejects unsafe or non-skill legacy paths', () => {
    const parse = (skillPath: string) =>
      normalizeLegacyVercelLockEntries([
        {
          name: 'bad',
          source: 'owner/repo',
          sourceType: 'github',
          skillPath,
          computedHash: hash,
        },
      ]);

    expect(() => parse('../outside/SKILL.md')).toThrow(
      'must stay inside the source'
    );
    expect(() => parse('/outside/SKILL.md')).toThrow(
      'must stay inside the source'
    );
    expect(() => parse('skills/bad/README.md')).toThrow(
      'must point to SKILL.md'
    );
  });

  it('resolves each legacy source once when creating manifest entries', async () => {
    const resolveSource = vi.fn(async (rawSource: string) => ({
      provider: 'github' as const,
      source: `github:${rawSource}`,
      packageId: rawSource,
      version: 'main@abcdef1234567890abcdef1234567890abcdef12',
      ref: 'main',
      commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
    }));

    await expect(
      resolveVercelMigrationSkills(
        [
          { name: 'one', rawSource: 'owner/repo', path: 'skills/one' },
          { name: 'two', rawSource: 'owner/repo', path: 'skills/two' },
        ],
        resolveSource
      )
    ).resolves.toEqual([
      {
        name: 'one',
        provider: 'github',
        source: 'github:owner/repo',
        packageId: 'owner/repo',
        version: 'main@abcdef1234567890abcdef1234567890abcdef12',
        ref: 'main',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        path: 'skills/one',
      },
      {
        name: 'two',
        provider: 'github',
        source: 'github:owner/repo',
        packageId: 'owner/repo',
        version: 'main@abcdef1234567890abcdef1234567890abcdef12',
        ref: 'main',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        path: 'skills/two',
      },
    ]);
    expect(resolveSource).toHaveBeenCalledTimes(1);
  });

  it('fills missing paths from exact discovered skill names', async () => {
    const discoverSource = vi.fn(async () => [
      discoveredSkill('one', 'skills/one'),
      discoveredSkill('two', 'skills/two'),
    ]);

    await expect(
      resolveMissingVercelMigrationPaths(
        [
          { name: 'one', rawSource: 'owner/repo', path: undefined },
          { name: 'manual', rawSource: 'owner/repo', path: 'skills/manual' },
        ],
        discoverSource,
        { canPrompt: false }
      )
    ).resolves.toEqual([
      { name: 'one', rawSource: 'owner/repo', path: 'skills/one' },
      { name: 'manual', rawSource: 'owner/repo', path: 'skills/manual' },
    ]);
    expect(discoverSource).toHaveBeenCalledTimes(1);
  });

  it('fails non-interactive missing path resolution with candidates', async () => {
    await expect(
      resolveMissingVercelMigrationPaths(
        [{ name: 'missing', rawSource: 'owner/repo', path: undefined }],
        async () => [
          discoveredSkill('create-prd', 'skills/create-prd'),
          discoveredSkill('execute-prd', 'skills/execute-prd'),
        ],
        { canPrompt: false }
      )
    ).rejects.toThrow(
      [
        'Could not infer skillPath for legacy skill "missing".',
        'Add skillPath to skills-lock.json and rerun.',
        '',
        'Available skills:',
        '  - create-prd (skills/create-prd)',
        '  - execute-prd (skills/execute-prd)',
      ].join('\n')
    );
  });

  it('merges migrated skills with explicit conflict policies', () => {
    const existing: AiPackageManifest = {
      skills: [
        remoteSkill({
          name: 'existing',
          source: 'github:owner/old',
          packageId: 'owner/old',
          path: 'skills/existing',
        }),
      ],
    };
    const migrated = [
      remoteSkill({
        name: 'existing',
        source: 'github:owner/new',
        packageId: 'owner/new',
        path: 'skills/existing-new',
      }),
      remoteSkill({
        name: 'new',
        source: 'github:owner/new',
        packageId: 'owner/new',
        path: 'skills/new',
      }),
    ];

    expect(() =>
      mergeVercelMigrationSkills(existing, migrated, 'fail')
    ).toThrow('already contains migrated skill names');

    expect(
      mergeVercelMigrationSkills(existing, migrated, 'skip')
    ).toMatchObject({
      added: ['new'],
      skipped: ['existing'],
      overwritten: [],
      manifest: {
        skills: [
          { name: 'existing', source: 'github:owner/old' },
          { name: 'new', source: 'github:owner/new' },
        ],
      },
    });

    expect(
      mergeVercelMigrationSkills(existing, migrated, 'overwrite')
    ).toMatchObject({
      added: ['new'],
      skipped: [],
      overwritten: ['existing'],
      manifest: {
        skills: [
          { name: 'existing', source: 'github:owner/new' },
          { name: 'new', source: 'github:owner/new' },
        ],
      },
    });
  });

  it('resolves default and custom lockfile paths', () => {
    expect(resolveLockfilePath('/repo', 'skills-lock.json')).toBe(
      '/repo/skills-lock.json'
    );
    expect(resolveLockfilePath('/repo', '/tmp/skills-lock.json')).toBe(
      '/tmp/skills-lock.json'
    );
  });
});

const remoteSkill = (
  overrides: Pick<RemoteSkillEntry, 'name' | 'source' | 'packageId' | 'path'>
): RemoteSkillEntry => ({
  provider: 'github',
  version: 'main@abcdef1234567890abcdef1234567890abcdef12',
  ref: 'main',
  commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
  ...overrides,
});

const discoveredSkill = (name: string, path: string): DiscoveredSkill => ({
  name,
  path,
  absolutePath: `/repo/${path}`,
  rawSkillMd: `# ${name}`,
});
