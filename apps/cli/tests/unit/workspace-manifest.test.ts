import { describe, expect, it } from 'vitest';
import { parseAiPackageManifest, serializeManifest } from '../../src/manifest';
import type { AiPackageManifest } from '../../src/types';

const VALID_SHA = 'c376dc971045eb38c094802ca43875d1cfa00ea4';

const validEntry = () => ({
  local: '.cursor/skills/explain',
  source: 'github:entireio/skills',
  path: 'skills/explain',
  version: `main@${VALID_SHA}`,
});

const wrap = (entry: Record<string, unknown>) => ({
  workspace: {
    skills: { explain: entry },
  },
});

describe('parseAiPackageManifest workspace', () => {
  it('parses a workspace.skills entry', () => {
    const manifest = parseAiPackageManifest(
      {
        skills: {
          tdd: {
            source: 'github:mattpocock/skills',
            version: 'main@b843cb5ea74b1fe5e58a0fc23cddef9e66076fb8',
            path: 'skills/engineering/tdd',
          },
        },
        workspace: {
          skills: {
            explain: {
              local: '.cursor/skills/explain',
              source: 'github:entireio/skills',
              path: 'skills/explain',
              version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
            },
          },
        },
      },
      'ai-package.json'
    );

    expect(manifest.workspace.skills).toEqual([
      {
        name: 'explain',
        local: '.cursor/skills/explain',
        provider: 'github',
        source: 'github:entireio/skills',
        packageId: 'entireio/skills',
        path: 'skills/explain',
        version: 'main@c376dc971045eb38c094802ca43875d1cfa00ea4',
        ref: 'main',
        commitSha: 'c376dc971045eb38c094802ca43875d1cfa00ea4',
      },
    ]);
  });

  it('returns an empty workspace.skills when the section is missing', () => {
    const manifest = parseAiPackageManifest(
      {
        skills: {
          tdd: {
            source: 'github:owner/repo',
            version: `main@${VALID_SHA}`,
            path: 'skills/tdd',
          },
        },
      },
      'ai-package.json'
    );

    expect(manifest.workspace).toEqual({ skills: [] });
  });

  it('accepts workspace as the only top-level section', () => {
    const manifest = parseAiPackageManifest(
      wrap(validEntry()),
      'ai-package.json'
    );

    expect(manifest.skills).toEqual([]);
    expect(manifest.plugins).toEqual([]);
    expect(manifest.workspace.skills).toHaveLength(1);
  });

  it('rejects when workspace is not an object', () => {
    expect(() =>
      parseAiPackageManifest({ workspace: 'oops' }, 'ai-package.json')
    ).toThrow('top-level "workspace" must be an object');
  });

  it('rejects when workspace.skills is not an object', () => {
    expect(() =>
      parseAiPackageManifest({ workspace: { skills: [] } }, 'ai-package.json')
    ).toThrow('"workspace.skills" must be an object');
  });

  it('rejects a workspace skill missing local', () => {
    const entry = { ...validEntry() } as Record<string, unknown>;
    delete entry.local;
    expect(() =>
      parseAiPackageManifest(wrap(entry), 'ai-package.json')
    ).toThrow('Workspace skill "explain" local path is required');
  });

  it('rejects a workspace skill missing source', () => {
    const entry = { ...validEntry() } as Record<string, unknown>;
    delete entry.source;
    expect(() =>
      parseAiPackageManifest(wrap(entry), 'ai-package.json')
    ).toThrow('Workspace skill "explain" source is required');
  });

  it('rejects a workspace skill missing path', () => {
    const entry = { ...validEntry() } as Record<string, unknown>;
    delete entry.path;
    expect(() =>
      parseAiPackageManifest(wrap(entry), 'ai-package.json')
    ).toThrow('Workspace skill "explain" path is required');
  });

  it('rejects a workspace skill with a file source', () => {
    expect(() =>
      parseAiPackageManifest(
        wrap({ ...validEntry(), source: 'file:./local-skills' }),
        'ai-package.json'
      )
    ).toThrow('source must be github or gitlab');
  });

  it('rejects a workspace skill with an invalid version', () => {
    expect(() =>
      parseAiPackageManifest(
        wrap({ ...validEntry(), version: 'not-a-version' }),
        'ai-package.json'
      )
    ).toThrow('version must use <ref>@<commitSha>');
  });

  it('round-trips through serializeManifest', () => {
    const manifest: AiPackageManifest = {
      skills: [],
      plugins: [],
      workspace: {
        skills: [
          {
            name: 'explain',
            local: '.cursor/skills/explain',
            provider: 'github',
            source: 'github:entireio/skills',
            packageId: 'entireio/skills',
            version: `main@${VALID_SHA}`,
            ref: 'main',
            commitSha: VALID_SHA,
            path: 'skills/explain',
          },
        ],
      },
    };

    const json = JSON.parse(serializeManifest(manifest)) as Record<
      string,
      unknown
    >;
    expect(json).toEqual({
      workspace: {
        skills: {
          explain: {
            local: '.cursor/skills/explain',
            source: 'github:entireio/skills',
            path: 'skills/explain',
            version: `main@${VALID_SHA}`,
          },
        },
      },
    });
  });

  it('serializes workspace.skills sorted by name', () => {
    const manifest: AiPackageManifest = {
      skills: [],
      plugins: [],
      workspace: {
        skills: [
          {
            name: 'zeta',
            local: '.cursor/skills/zeta',
            provider: 'github',
            source: 'github:owner/repo',
            packageId: 'owner/repo',
            version: `main@${VALID_SHA}`,
            ref: 'main',
            commitSha: VALID_SHA,
            path: 'skills/zeta',
          },
          {
            name: 'alpha',
            local: '.cursor/skills/alpha',
            provider: 'github',
            source: 'github:owner/repo',
            packageId: 'owner/repo',
            version: `main@${VALID_SHA}`,
            ref: 'main',
            commitSha: VALID_SHA,
            path: 'skills/alpha',
          },
        ],
      },
    };

    const json = serializeManifest(manifest);
    const alphaIdx = json.indexOf('"alpha"');
    const zetaIdx = json.indexOf('"zeta"');
    expect(alphaIdx).toBeGreaterThan(0);
    expect(alphaIdx).toBeLessThan(zetaIdx);
  });

  it('rejects when a name appears in both skills and workspace.skills', () => {
    expect(() =>
      parseAiPackageManifest(
        {
          skills: {
            explain: {
              source: 'github:entireio/skills',
              version: `main@${VALID_SHA}`,
              path: 'skills/explain',
            },
          },
          ...wrap(validEntry()),
        },
        'ai-package.json'
      )
    ).toThrow(
      'Workspace skill "explain" must not also appear in top-level "skills"'
    );
  });
});
