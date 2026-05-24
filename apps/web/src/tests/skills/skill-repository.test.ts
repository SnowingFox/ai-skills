import { describe, expect, it } from 'vitest';
import { SkillRepository } from '@/skills/skill-repository';
import { withTestDb } from '@/tests/with-test-db';

const baseSummary = {
  source: 'vercel-labs/skills',
  owner: 'vercel-labs',
  repo: 'skills',
  skillId: 'find-skills',
  name: 'find-skills',
  installs: 1000,
  isOfficial: true,
};

const baseId = {
  owner: 'vercel-labs',
  repo: 'skills',
  skillId: 'find-skills',
};

describe('SkillRepository.findById', () => {
  it('returns null when skill does not exist', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const result = await repo.findById({
        owner: 'nope',
        repo: 'nope',
        skillId: 'nope',
      });
      expect(result).toBeNull();
    });
  });

  it('returns the skill when it exists', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);

      await repo.upsertSummary(baseSummary);

      const result = await repo.findById(baseId);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('find-skills');
      expect(result!.installs).toBe(1000);
      expect(result!.isOfficial).toBe(true);
      expect(result!.markdownContent).toBeNull();
    });
  });
});

describe('SkillRepository.upsertSummary', () => {
  it('updates installs and metadata on conflict', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);

      await repo.upsertSummary({ ...baseSummary, installs: 1000 });
      await repo.upsertSummary({
        ...baseSummary,
        installs: 2000,
        description: 'Updated description',
      });

      const result = await repo.findById(baseId);
      expect(result!.installs).toBe(2000);
      expect(result!.description).toBe('Updated description');
    });
  });

  it('does not overwrite existing markdownContent', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);

      await repo.upsertSummary(baseSummary);
      await repo.upsertMarkdown(baseId, '# original markdown');
      await repo.upsertSummary({ ...baseSummary, installs: 9999 });

      const result = await repo.findById(baseId);
      expect(result!.installs).toBe(9999);
      expect(result!.markdownContent).toBe('# original markdown');
    });
  });

  it('persists weeklyInstalls as JSON array', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);

      await repo.upsertSummary({
        ...baseSummary,
        weeklyInstalls: [108424, 100113, 116613],
      });

      const result = await repo.findById(baseId);
      expect(JSON.parse(result!.weeklyInstalls!)).toEqual([
        108424, 100113, 116613,
      ]);
    });
  });
});

describe('SkillRepository.listTopByInstalls', () => {
  it('returns skills sorted by installs descending', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({ ...baseSummary, skillId: 'a', installs: 100 });
      await repo.upsertSummary({ ...baseSummary, skillId: 'b', installs: 500 });
      await repo.upsertSummary({ ...baseSummary, skillId: 'c', installs: 200 });

      const rows = await repo.listTopByInstalls({ limit: 10 });
      expect(rows.map((r) => r.skillId)).toEqual(['b', 'c', 'a']);
    });
  });

  it('supports limit and offset for pagination', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      for (let i = 0; i < 5; i++) {
        await repo.upsertSummary({
          ...baseSummary,
          skillId: `s${i}`,
          installs: (5 - i) * 100,
        });
      }

      const page1 = await repo.listTopByInstalls({ limit: 2, offset: 0 });
      const page2 = await repo.listTopByInstalls({ limit: 2, offset: 2 });

      expect(page1.map((r) => r.skillId)).toEqual(['s0', 's1']);
      expect(page2.map((r) => r.skillId)).toEqual(['s2', 's3']);
    });
  });

  it('returns empty array when no skills exist', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const rows = await repo.listTopByInstalls({ limit: 10 });
      expect(rows).toEqual([]);
    });
  });
});

describe('SkillRepository.search', () => {
  it('matches name case-insensitively', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({
        ...baseSummary,
        skillId: 'find-skills',
        name: 'find-skills',
      });
      await repo.upsertSummary({
        ...baseSummary,
        skillId: 'tdd',
        name: 'tdd',
      });

      const rows = await repo.search('FIND', { limit: 10 });
      expect(rows.map((r) => r.skillId)).toEqual(['find-skills']);
    });
  });

  it('matches against source', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary(baseSummary);
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'mattpocock',
        repo: 'skills',
        skillId: 'tdd',
        source: 'mattpocock/skills',
        name: 'tdd',
      });

      const rows = await repo.search('mattpocock', { limit: 10 });
      expect(rows.map((r) => r.source)).toEqual(['mattpocock/skills']);
    });
  });

  it('matches against description', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({
        ...baseSummary,
        description: 'Find skills quickly',
      });
      await repo.upsertSummary({
        ...baseSummary,
        skillId: 'tdd',
        name: 'tdd',
        description: 'Test driven development',
      });

      const rows = await repo.search('driven', { limit: 10 });
      expect(rows.map((r) => r.skillId)).toEqual(['tdd']);
    });
  });

  it('returns empty array for empty query', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary(baseSummary);

      const rows = await repo.search('', { limit: 10 });
      expect(rows).toEqual([]);
    });
  });

  it('orders results by installs descending', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({
        ...baseSummary,
        skillId: 'low',
        name: 'find-low',
        installs: 50,
      });
      await repo.upsertSummary({
        ...baseSummary,
        skillId: 'high',
        name: 'find-high',
        installs: 500,
      });

      const rows = await repo.search('find', { limit: 10 });
      expect(rows.map((r) => r.skillId)).toEqual(['high', 'low']);
    });
  });
});

describe('SkillRepository.listByOwner', () => {
  it('returns only skills under the given owner, ordered by installs desc', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'vercel-labs',
        repo: 'skills',
        skillId: 'a',
        source: 'vercel-labs/skills',
        installs: 500,
      });
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'vercel-labs',
        repo: 'agent-skills',
        skillId: 'b',
        source: 'vercel-labs/agent-skills',
        installs: 200,
      });
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'mattpocock',
        repo: 'skills',
        skillId: 'c',
        source: 'mattpocock/skills',
        installs: 999,
      });

      const rows = await repo.listByOwner('vercel-labs', { limit: 10 });
      expect(rows.map((r) => r.skillId)).toEqual(['a', 'b']);
    });
  });

  it('returns empty array when owner has no skills', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const rows = await repo.listByOwner('nobody', { limit: 10 });
      expect(rows).toEqual([]);
    });
  });
});

describe('SkillRepository.summariseByOwner', () => {
  it('groups skills by repo with skill count, total installs, and sample names', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      // 3 skills in vercel-labs/next-skills
      for (const [skillId, installs] of [
        ['next-best-practices', 92600],
        ['next-cache-components', 31200],
        ['next-upgrade', 21100],
      ] as Array<[string, number]>) {
        await repo.upsertSummary({
          ...baseSummary,
          owner: 'vercel-labs',
          repo: 'next-skills',
          skillId,
          name: skillId,
          source: 'vercel-labs/next-skills',
          installs,
        });
      }
      // 1 skill in vercel-labs/skills
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'vercel-labs',
        repo: 'skills',
        skillId: 'find-skills',
        name: 'find-skills',
        source: 'vercel-labs/skills',
        installs: 1700000,
      });
      // Different owner should be excluded
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'mattpocock',
        repo: 'skills',
        skillId: 'tdd',
        source: 'mattpocock/skills',
        installs: 1,
      });

      const repos = await repo.summariseByOwner('vercel-labs');

      // sorted by totalInstalls desc
      expect(repos.map((r) => r.repo)).toEqual(['skills', 'next-skills']);

      const skillsRepo = repos[0];
      expect(skillsRepo.skillCount).toBe(1);
      expect(skillsRepo.totalInstalls).toBe(1700000);
      expect(skillsRepo.skillNames).toEqual(['find-skills']);

      const nextSkillsRepo = repos[1];
      expect(nextSkillsRepo.skillCount).toBe(3);
      expect(nextSkillsRepo.totalInstalls).toBe(92600 + 31200 + 21100);
      expect(nextSkillsRepo.skillNames).toEqual([
        'next-best-practices',
        'next-cache-components',
        'next-upgrade',
      ]);
    });
  });

  it('returns empty array for unknown owner', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const repos = await repo.summariseByOwner('nobody');
      expect(repos).toEqual([]);
    });
  });
});

describe('SkillRepository.listByRepo', () => {
  it('returns only skills under the given owner/repo, ordered by installs', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'vercel-labs',
        repo: 'next-skills',
        skillId: 'next-cache-components',
        name: 'next-cache-components',
        source: 'vercel-labs/next-skills',
        installs: 31200,
      });
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'vercel-labs',
        repo: 'next-skills',
        skillId: 'next-best-practices',
        name: 'next-best-practices',
        source: 'vercel-labs/next-skills',
        installs: 92600,
      });
      // Another owner with same repo name should be excluded
      await repo.upsertSummary({
        ...baseSummary,
        owner: 'someone-else',
        repo: 'next-skills',
        skillId: 'noise',
        source: 'someone-else/next-skills',
        installs: 999999,
      });

      const rows = await repo.listByRepo('vercel-labs', 'next-skills', {
        limit: 10,
      });
      expect(rows.map((r) => r.skillId)).toEqual([
        'next-best-practices',
        'next-cache-components',
      ]);
    });
  });

  it('returns empty array when repo has no skills', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const rows = await repo.listByRepo('nobody', 'nothing', { limit: 10 });
      expect(rows).toEqual([]);
    });
  });
});

describe('SkillRepository.upsertMarkdown', () => {
  it('sets markdownContent and markdownSyncedAt on existing row', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary(baseSummary);

      const before = new Date();
      await repo.upsertMarkdown(baseId, '# hello world');
      const after = new Date();

      const result = await repo.findById(baseId);
      expect(result!.markdownContent).toBe('# hello world');
      expect(result!.markdownSyncedAt).toBeInstanceOf(Date);
      expect(result!.markdownSyncedAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1
      );
      expect(result!.markdownSyncedAt!.getTime()).toBeLessThanOrEqual(
        after.getTime() + 1
      );
    });
  });

  it('does nothing when skill row does not exist', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);

      await repo.upsertMarkdown(baseId, '# orphan');

      const result = await repo.findById(baseId);
      expect(result).toBeNull();
    });
  });

  it('is idempotent — second call yields same content', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary(baseSummary);

      await repo.upsertMarkdown(baseId, '# v1');
      await repo.upsertMarkdown(baseId, '# v2');

      const result = await repo.findById(baseId);
      expect(result!.markdownContent).toBe('# v2');
    });
  });
});
