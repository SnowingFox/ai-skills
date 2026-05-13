import { describe, expect, it } from 'vitest';
import { parseAiPackageManifest } from '../../src/manifest';

describe('parseAiPackageManifest', () => {
  it('parses github and gitlab skill entries from ai-package.json', () => {
    const manifest = parseAiPackageManifest(
      {
        skills: {
          'find-skills': {
            source: 'github:vercel-labs/skills',
            version: 'main@df0579f85cb8a360473c921e1343359006100d3c',
            path: 'skills/find-skills',
          },
          reviewer: {
            source:
              'gitlab:https://gitlab.example.com/platform/ai/agent-skills.git',
            version: 'release@abcdef1234567890abcdef1234567890abcdef12',
            path: 'packages/reviewer',
          },
        },
      },
      'ai-package.json'
    );

    expect(manifest.skills).toEqual([
      {
        name: 'find-skills',
        provider: 'github',
        source: 'github:vercel-labs/skills',
        packageId: 'vercel-labs/skills',
        version: 'main@df0579f85cb8a360473c921e1343359006100d3c',
        ref: 'main',
        commitSha: 'df0579f85cb8a360473c921e1343359006100d3c',
        path: 'skills/find-skills',
      },
      {
        name: 'reviewer',
        provider: 'gitlab',
        source:
          'gitlab:https://gitlab.example.com/platform/ai/agent-skills.git',
        packageId: 'https://gitlab.example.com/platform/ai/agent-skills.git',
        version: 'release@abcdef1234567890abcdef1234567890abcdef12',
        ref: 'release',
        commitSha: 'abcdef1234567890abcdef1234567890abcdef12',
        path: 'packages/reviewer',
      },
    ]);
  });

  it('rejects the old singular skill key', () => {
    expect(() =>
      parseAiPackageManifest(
        {
          skill: {
            legacy: {
              source: 'github:owner/repo',
              version: 'main@abcdef1234567890abcdef1234567890abcdef12',
              path: 'skills/legacy',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('top-level "skills" object');
  });

  it('rejects malformed manifest roots', () => {
    expect(() => parseAiPackageManifest(null, 'ai-package.json')).toThrow(
      'must be a JSON object'
    );
    expect(() => parseAiPackageManifest({}, 'ai-package.json')).toThrow(
      'top-level "skills", "plugins", or "workspace" object'
    );
    expect(() =>
      parseAiPackageManifest({ skills: [] }, 'ai-package.json')
    ).toThrow('"skills" must be an object');
  });

  it('parses file sources relative to the manifest directory', () => {
    const manifest = parseAiPackageManifest(
      {
        skills: {
          local: {
            source: 'file:.',
            path: './.agents/skills/local',
          },
        },
      },
      '/repo/config/ai-package.json'
    );

    expect(manifest.skills).toEqual([
      {
        name: 'local',
        provider: 'file',
        source: 'file:.',
        packageId: '.',
        sourceRoot: '/repo/config',
        path: '.agents/skills/local',
      },
    ]);
  });

  it('requires remote versions to include ref and commit sha', () => {
    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            missing: {
              source: 'github:owner/repo',
              path: 'skills/missing',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('version is required');

    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            bad: {
              source: 'gitlab:https://gitlab.example.com/owner/repo.git',
              version: 'main',
              path: 'skills/bad',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('<ref>@<commitSha>');
  });

  it('rejects missing and unsafe skill paths', () => {
    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            missing: {
              source: 'github:owner/repo',
              version: 'main@abcdef1234567890abcdef1234567890abcdef12',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('path is required');

    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            unsafe: {
              source: 'github:owner/repo',
              version: 'main@abcdef1234567890abcdef1234567890abcdef12',
              path: '../outside',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('must stay inside the source');

    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            absolute: {
              source: 'github:owner/repo',
              version: 'main@abcdef1234567890abcdef1234567890abcdef12',
              path: '/outside',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('must stay inside the source');
  });

  it('rejects invalid skill entries and sources', () => {
    expect(() =>
      parseAiPackageManifest({ skills: { bad: null } }, 'ai-package.json')
    ).toThrow('must be an object');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('source is required');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { source: 'github:owner/repo', path: '' } } },
        'ai-package.json'
      )
    ).toThrow('path is required');
    expect(() =>
      parseAiPackageManifest(
        { skills: { 'bad/name': { source: 'file:.', path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('Invalid skill name');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { source: 'github', path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('<provider>:<package-id>');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { source: 'github:', path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('package id is required');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { source: 'github:owner', path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('github:owner/repo');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { source: 'gitlab:owner', path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('gitlab:https://host/group/repo.git');
    expect(() =>
      parseAiPackageManifest(
        { skills: { bad: { source: 'npm:owner/repo', path: 'skills/bad' } } },
        'ai-package.json'
      )
    ).toThrow('Unsupported source provider');
    expect(
      parseAiPackageManifest(
        {
          skills: {
            marketplace: {
              source: 'marketplace:owner/package',
              version: '2026-05-04T09:00:00Z@sha256:abc123',
              path: 'skills/bad',
            },
          },
        },
        'ai-package.json'
      ).skills[0]
    ).toMatchObject({ provider: 'marketplace' });
    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            bad: {
              source: 'github:owner/repo',
              version: 'main@not-a-sha',
              path: 'skills/bad',
            },
          },
        },
        'ai-package.json'
      )
    ).toThrow('<ref>@<commitSha>');
  });

  it('keeps absolute file sources absolute', () => {
    const manifest = parseAiPackageManifest(
      {
        skills: {
          local: {
            source: 'file:/tmp/shared-skills',
            path: 'skills/local',
          },
        },
      },
      '/repo/ai-package.json'
    );

    expect(manifest.skills[0]).toMatchObject({
      provider: 'file',
      source: 'file:/tmp/shared-skills',
      sourceRoot: '/tmp/shared-skills',
    });
  });
});
