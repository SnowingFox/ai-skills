import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createManifestStore } from '../../src/manifest';
import type { WorkspaceSkillEntry } from '../../src/types';

const VALID_SHA = 'c376dc971045eb38c094802ca43875d1cfa00ea4';

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), 'ai-pkgs-ws-store-'));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true });
});

const writeManifest = async (data: Record<string, unknown>) => {
  await writeFile(
    join(projectDir, 'ai-package.json'),
    JSON.stringify(data, null, 2)
  );
};

const workspaceEntry = (
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

describe('manifest store workspace mutations', () => {
  it('addWorkspaceSkill writes a new entry to workspace.skills', async () => {
    await writeManifest({
      skills: {
        tdd: {
          source: 'github:owner/repo',
          version: `main@${VALID_SHA}`,
          path: 'skills/tdd',
        },
      },
    });

    const store = createManifestStore(projectDir);
    const next = await store.addWorkspaceSkill(workspaceEntry());

    expect(next.workspace.skills).toHaveLength(1);
    expect(next.workspace.skills[0]!.name).toBe('explain');
    expect(next.skills).toHaveLength(1);

    const raw = JSON.parse(
      await readFile(join(projectDir, 'ai-package.json'), 'utf-8')
    );
    expect(raw.workspace.skills.explain.local).toBe('.cursor/skills/explain');
  });

  it('removeWorkspaceSkill drops the entry from workspace.skills', async () => {
    await writeManifest({
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

    const store = createManifestStore(projectDir);
    const next = await store.removeWorkspaceSkill('explain');

    expect(next.workspace.skills).toEqual([]);
  });

  it('moveSkillToWorkspace migrates a skills[] entry into workspace.skills', async () => {
    await writeManifest({
      skills: {
        explain: {
          source: 'github:entireio/skills',
          version: `main@${VALID_SHA}`,
          path: 'skills/explain',
        },
      },
    });

    const store = createManifestStore(projectDir);
    const next = await store.moveSkillToWorkspace(
      'explain',
      '.cursor/skills/explain'
    );

    expect(next.skills).toEqual([]);
    expect(next.workspace.skills).toHaveLength(1);
    expect(next.workspace.skills[0]).toMatchObject({
      name: 'explain',
      local: '.cursor/skills/explain',
      source: 'github:entireio/skills',
      path: 'skills/explain',
      version: `main@${VALID_SHA}`,
    });
  });

  it('moveSkillToWorkspace throws when the skill is not in skills[]', async () => {
    await writeManifest({ skills: {} });

    const store = createManifestStore(projectDir);
    await expect(
      store.moveSkillToWorkspace('explain', '.cursor/skills/explain')
    ).rejects.toThrow('"explain" is not in skills');
  });
});
