import type { SkillEntry, SkillsApiResponse } from '@/lib/skills-api';
import type { RepoSummary } from './skill-repository';
import { HttpSkillsShUpstream, type SkillsShUpstream } from './upstream';

const defaultUpstream = new HttpSkillsShUpstream();

// Conservative cap so the bootstrap fallback can render within Cloudflare's
// request budget even on cold caches. ~10 pages × 200 = 2000 entries covers
// the heavily-installed skills that users are most likely to hit while the
// local DB is being seeded. Subsequent calls are served from the Next.js
// fetch cache (revalidate=3600) so the cost is amortised across requests.
const FALLBACK_PAGE_LIMIT = 10;

/**
 * Pull skill entries from the upstream all-time API. Fetches the configured
 * page window in parallel — the Next.js fetch cache (revalidate=3600 in the
 * HTTP client) keeps subsequent calls cheap, and the first cold call still
 * resolves in roughly one round-trip instead of N sequential ones.
 *
 * Used as a read-time fallback when the local database has not been seeded
 * yet, so pages still render against live data instead of returning 404.
 */
async function fetchAllUpstreamEntries(
  upstream: SkillsShUpstream,
  maxPages = FALLBACK_PAGE_LIMIT
): Promise<SkillEntry[]> {
  const pages = await Promise.all(
    Array.from({ length: maxPages }, (_, page) => upstream.fetchAllTime(page))
  );
  const collected: SkillEntry[] = [];
  for (const response of pages) {
    collected.push(...response.skills);
  }
  return collected;
}

function splitSource(source: string): { owner: string; repo: string } | null {
  const [owner, repo] = source.split('/');
  if (!owner || !repo) return null;
  return { owner, repo };
}

/**
 * Returns the list of skill entries in a given owner from the upstream API.
 * Sorted by installs descending.
 */
export async function listByOwnerUpstream(
  owner: string,
  upstream: SkillsShUpstream = defaultUpstream
): Promise<SkillEntry[]> {
  const entries = await fetchAllUpstreamEntries(upstream);
  return entries
    .filter((entry) => splitSource(entry.source)?.owner === owner)
    .sort((a, b) => b.installs - a.installs);
}

/**
 * Returns the per-repo aggregation for an owner using upstream data. Mirrors
 * {@link SkillRepository.summariseByOwner} so the owner page can render the
 * same shape regardless of data source.
 */
export async function summariseByOwnerUpstream(
  owner: string,
  upstream: SkillsShUpstream = defaultUpstream
): Promise<RepoSummary[]> {
  const entries = await listByOwnerUpstream(owner, upstream);
  const grouped = new Map<
    string,
    { skillCount: number; totalInstalls: number; skillNames: string[] }
  >();

  for (const entry of entries) {
    const split = splitSource(entry.source);
    if (!split) continue;
    const bucket = grouped.get(split.repo);
    if (bucket) {
      bucket.skillCount += 1;
      bucket.totalInstalls += entry.installs;
      bucket.skillNames.push(entry.name);
    } else {
      grouped.set(split.repo, {
        skillCount: 1,
        totalInstalls: entry.installs,
        skillNames: [entry.name],
      });
    }
  }

  return [...grouped.entries()]
    .map(([repo, summary]) => ({ repo, ...summary }))
    .sort((a, b) => b.totalInstalls - a.totalInstalls);
}

/**
 * Returns skill entries in a given owner/repo from the upstream API.
 */
export async function listByRepoUpstream(
  owner: string,
  repo: string,
  upstream: SkillsShUpstream = defaultUpstream
): Promise<SkillEntry[]> {
  const entries = await fetchAllUpstreamEntries(upstream);
  return entries
    .filter((entry) => {
      const split = splitSource(entry.source);
      return split?.owner === owner && split.repo === repo;
    })
    .sort((a, b) => b.installs - a.installs);
}

/**
 * Case-insensitive substring search across upstream entries. Used when the
 * local database is empty so the search box still produces results.
 */
export async function searchUpstream(
  query: string,
  upstream: SkillsShUpstream = defaultUpstream
): Promise<SkillEntry[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const entries = await fetchAllUpstreamEntries(upstream);
  return entries
    .filter((entry) => {
      return (
        entry.name.toLowerCase().includes(lower) ||
        entry.source.toLowerCase().includes(lower) ||
        entry.skillId.toLowerCase().includes(lower)
      );
    })
    .sort((a, b) => b.installs - a.installs);
}
