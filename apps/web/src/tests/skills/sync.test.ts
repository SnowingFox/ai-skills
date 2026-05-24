import { describe, expect, it } from 'vitest';
import type { SkillDetailParams } from '@/lib/skills';
import type { SkillEntry, SkillsApiResponse } from '@/lib/skills-api';
import type { SkillDownloadPayload } from '@/lib/skills';
import { SkillRepository } from '@/skills/skill-repository';
import { syncSkills } from '@/skills/sync';
import type { SkillsShUpstream } from '@/skills/upstream';
import { withTestDb } from '@/tests/with-test-db';

class FakeUpstream implements SkillsShUpstream {
  public allTimeCalls: number[] = [];
  public downloadCalls: SkillDetailParams[] = [];

  constructor(
    private readonly pages: Map<number, SkillsApiResponse>,
    private readonly downloads: Map<string, SkillDownloadPayload | null>
  ) {}

  async fetchAllTime(page: number): Promise<SkillsApiResponse> {
    this.allTimeCalls.push(page);
    return (
      this.pages.get(page) ?? {
        skills: [],
        total: 0,
        hasMore: false,
        page,
      }
    );
  }

  async fetchDownload(
    params: SkillDetailParams
  ): Promise<SkillDownloadPayload | null> {
    this.downloadCalls.push(params);
    const key = `${params.owner}/${params.repo}/${params.skillId}`;
    return this.downloads.get(key) ?? null;
  }
}

function entry(source: string, skillId: string, installs: number): SkillEntry {
  const [owner, repo] = source.split('/');
  void owner;
  void repo;
  return { source, skillId, name: skillId, installs };
}

describe('syncSkills metadata sweep', () => {
  it('writes all entries from all pages into the database', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: true,
              total: 3,
              skills: [
                entry('vercel-labs/skills', 'find-skills', 1000),
                entry('mattpocock/skills', 'tdd', 500),
              ],
            },
          ],
          [
            1,
            {
              page: 1,
              hasMore: false,
              total: 3,
              skills: [entry('vercel-labs/skills', 'foo', 200)],
            },
          ],
        ]),
        new Map()
      );

      const report = await syncSkills({ repo, upstream });

      expect(report.totalFetched).toBe(3);
      expect(report.errorCount).toBe(0);
      expect(upstream.allTimeCalls).toEqual([0, 1]);

      const stored = await repo.listTopByInstalls({ limit: 10 });
      expect(stored.map((s) => s.skillId).sort()).toEqual(
        ['find-skills', 'foo', 'tdd'].sort()
      );
    });
  });

  it('stops paging when hasMore is false', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: false,
              total: 1,
              skills: [entry('vercel-labs/skills', 's1', 1)],
            },
          ],
        ]),
        new Map()
      );

      await syncSkills({ repo, upstream });
      expect(upstream.allTimeCalls).toEqual([0]);
    });
  });

  it('respects a maxPages safety cap', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      // upstream always says hasMore=true
      const pages = new Map<number, SkillsApiResponse>();
      for (let i = 0; i < 100; i++) {
        pages.set(i, {
          page: i,
          hasMore: true,
          total: 999,
          skills: [entry('vercel-labs/skills', `s${i}`, i)],
        });
      }
      const upstream = new FakeUpstream(pages, new Map());

      await syncSkills({ repo, upstream, maxPages: 3 });
      expect(upstream.allTimeCalls).toEqual([0, 1, 2]);
    });
  });

  it('is idempotent — second run does not duplicate rows', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: false,
              total: 1,
              skills: [entry('vercel-labs/skills', 's1', 10)],
            },
          ],
        ]),
        new Map()
      );

      await syncSkills({ repo, upstream });
      await syncSkills({ repo, upstream });

      const stored = await repo.listTopByInstalls({ limit: 10 });
      expect(stored).toHaveLength(1);
    });
  });
});

describe('syncSkills malformed entries', () => {
  it('skips entries whose source does not contain an owner/repo separator', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: false,
              total: 3,
              skills: [
                entry('open.feishu.cn', 'whatever', 5),
                entry('vercel-labs/skills', 'find-skills', 1000),
                entry('', 'empty', 1),
              ],
            },
          ],
        ]),
        new Map()
      );

      const report = await syncSkills({ repo, upstream });

      expect(report.totalFetched).toBe(1);
      expect(report.errorCount).toBe(0);
      const stored = await repo.listTopByInstalls({ limit: 10 });
      expect(stored.map((s) => s.skillId)).toEqual(['find-skills']);
    });
  });
});

describe('syncSkills markdown backfill', () => {
  it('downloads markdown for top N skills by installs', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: false,
              total: 3,
              skills: [
                entry('vercel-labs/skills', 'find-skills', 1000),
                entry('mattpocock/skills', 'tdd', 500),
                entry('vercel-labs/skills', 'low', 1),
              ],
            },
          ],
        ]),
        new Map<string, SkillDownloadPayload>([
          [
            'vercel-labs/skills/find-skills',
            { files: [{ path: 'SKILL.md', contents: '# find-skills' }] },
          ],
          [
            'mattpocock/skills/tdd',
            { files: [{ path: 'SKILL.md', contents: '# tdd' }] },
          ],
          [
            'vercel-labs/skills/low',
            { files: [{ path: 'SKILL.md', contents: '# low' }] },
          ],
        ])
      );

      const report = await syncSkills({
        repo,
        upstream,
        withMarkdown: true,
        markdownLimit: 2,
      });

      expect(report.markdownFilled).toBe(2);

      // top 2 by installs should have markdown
      const findSkills = await repo.findById({
        owner: 'vercel-labs',
        repo: 'skills',
        skillId: 'find-skills',
      });
      expect(findSkills!.markdownContent).toContain('# find-skills');

      const tdd = await repo.findById({
        owner: 'mattpocock',
        repo: 'skills',
        skillId: 'tdd',
      });
      expect(tdd!.markdownContent).toContain('# tdd');

      // bottom one should not
      const low = await repo.findById({
        owner: 'vercel-labs',
        repo: 'skills',
        skillId: 'low',
      });
      expect(low!.markdownContent).toBeNull();
    });
  });

  it('skips skills that already have markdown when force is false', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      await repo.upsertSummary({
        source: 'vercel-labs/skills',
        owner: 'vercel-labs',
        repo: 'skills',
        skillId: 'find-skills',
        name: 'find-skills',
        installs: 1000,
      });
      await repo.upsertMarkdown(
        {
          owner: 'vercel-labs',
          repo: 'skills',
          skillId: 'find-skills',
        },
        '# already here'
      );

      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: false,
              total: 1,
              skills: [entry('vercel-labs/skills', 'find-skills', 1000)],
            },
          ],
        ]),
        new Map<string, SkillDownloadPayload>([
          [
            'vercel-labs/skills/find-skills',
            { files: [{ path: 'SKILL.md', contents: '# fresh' }] },
          ],
        ])
      );

      await syncSkills({
        repo,
        upstream,
        withMarkdown: true,
        markdownLimit: 5,
      });

      expect(upstream.downloadCalls).toHaveLength(0);

      const row = await repo.findById({
        owner: 'vercel-labs',
        repo: 'skills',
        skillId: 'find-skills',
      });
      expect(row!.markdownContent).toBe('# already here');
    });
  });

  it('continues when a single download fails and reports errorCount', async () => {
    await withTestDb(async (db) => {
      const repo = new SkillRepository(db);
      const upstream = new FakeUpstream(
        new Map<number, SkillsApiResponse>([
          [
            0,
            {
              page: 0,
              hasMore: false,
              total: 2,
              skills: [
                entry('vercel-labs/skills', 'find-skills', 1000),
                entry('mattpocock/skills', 'tdd', 500),
              ],
            },
          ],
        ]),
        // tdd download missing -> returns null
        new Map<string, SkillDownloadPayload>([
          [
            'vercel-labs/skills/find-skills',
            { files: [{ path: 'SKILL.md', contents: '# fs' }] },
          ],
        ])
      );

      const report = await syncSkills({
        repo,
        upstream,
        withMarkdown: true,
        markdownLimit: 10,
      });

      expect(report.markdownFilled).toBe(1);
      expect(report.errorCount).toBe(1);
    });
  });
});
