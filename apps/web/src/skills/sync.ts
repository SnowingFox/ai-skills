import { parseSkillDownloadPayload } from '@/lib/skills';
import type { SkillEntry } from '@/lib/skills-api';
import type { SkillRepository } from './skill-repository';
import type { SkillsShUpstream } from './upstream';

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_MARKDOWN_LIMIT = 5000;
const DEFAULT_CONCURRENCY = 10;

export interface SyncSkillsOptions {
  repo: SkillRepository;
  upstream: SkillsShUpstream;
  /** Hard cap on metadata pages (200 entries each). Defaults to 100. */
  maxPages?: number;
  /** If true, also backfill SKILL.md for top-N skills. */
  withMarkdown?: boolean;
  /** Top-N to backfill when withMarkdown is true. */
  markdownLimit?: number;
  /** If true, re-download markdown even for rows that already have it. */
  forceMarkdown?: boolean;
  /** Concurrency for markdown downloads. */
  concurrency?: number;
}

export interface SyncSkillsReport {
  totalFetched: number;
  pagesFetched: number;
  markdownFilled: number;
  errorCount: number;
  durationMs: number;
}

/**
 * Orchestrates a sync from the skills.sh upstream into the local database.
 *
 * Phase 1 (always): walk paginated all-time entries and upsert metadata.
 * Phase 2 (opt-in): for the top N skills by installs, download SKILL.md
 * and persist it. Skips rows that already have markdown unless forceMarkdown.
 *
 * @example
 * const report = await syncSkills({ repo, upstream });
 * console.log(report); // { totalFetched: 9800, errorCount: 0, ... }
 */
export async function syncSkills(
  options: SyncSkillsOptions
): Promise<SyncSkillsReport> {
  const {
    repo,
    upstream,
    maxPages = DEFAULT_MAX_PAGES,
    withMarkdown = false,
    markdownLimit = DEFAULT_MARKDOWN_LIMIT,
    forceMarkdown = false,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;

  const start = Date.now();
  const report: SyncSkillsReport = {
    totalFetched: 0,
    pagesFetched: 0,
    markdownFilled: 0,
    errorCount: 0,
    durationMs: 0,
  };

  for (let page = 0; page < maxPages; page++) {
    const response = await upstream.fetchAllTime(page);
    report.pagesFetched += 1;

    for (const entry of response.skills) {
      const summary = toSummary(entry);
      if (!summary) continue;
      try {
        await repo.upsertSummary(summary);
        report.totalFetched += 1;
      } catch {
        report.errorCount += 1;
      }
    }

    if (!response.hasMore) break;
  }

  if (withMarkdown) {
    const top = await repo.listTopByInstalls({ limit: markdownLimit });
    const targets = forceMarkdown
      ? top
      : top.filter((row) => !row.markdownContent);

    await runWithConcurrency(targets, concurrency, async (row) => {
      try {
        const payload = await upstream.fetchDownload({
          owner: row.owner,
          repo: row.repo,
          skillId: row.skillId,
        });
        if (!payload) {
          report.errorCount += 1;
          return;
        }
        const detail = parseSkillDownloadPayload(
          { owner: row.owner, repo: row.repo, skillId: row.skillId },
          payload
        );
        if (!detail) {
          report.errorCount += 1;
          return;
        }
        await repo.upsertMarkdown(
          { owner: row.owner, repo: row.repo, skillId: row.skillId },
          detail.skillMarkdown
        );
        report.markdownFilled += 1;
      } catch {
        report.errorCount += 1;
      }
    });
  }

  report.durationMs = Date.now() - start;
  return report;
}

function toSummary(entry: SkillEntry) {
  const [owner, repo] = entry.source.split('/');
  // skills.sh occasionally lists entries with bare hostnames (e.g.
  // "open.feishu.cn"). Those don't fit the /owner/repo/skillId route shape
  // we serve, so skip them.
  if (!owner || !repo) return null;
  return {
    source: entry.source,
    owner,
    repo,
    skillId: entry.skillId,
    name: entry.name,
    installs: entry.installs,
    weeklyInstalls: entry.weeklyInstalls,
    isOfficial: entry.isOfficial,
  };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers: Promise<void>[] = [];
  const size = Math.max(1, Math.min(limit, queue.length));

  for (let i = 0; i < size; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item === undefined) break;
          await worker(item);
        }
      })()
    );
  }

  await Promise.all(workers);
}
