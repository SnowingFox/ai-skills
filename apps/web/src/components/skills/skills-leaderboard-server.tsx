import { SkillsLeaderboard } from '@/components/skills/skills-leaderboard';
import { fetchAllTimeSkills, type SkillsApiResponse } from '@/lib/skills-api';
import type { CursorPlugin } from '@/skills/cursor-upstream';
import { getCursorPlugins } from '@/skills/get-cursor-upstream';
import { getSkillRepository } from '@/skills/get-skill-repository';

const INITIAL_PAGE_SIZE = 200;

async function loadInitialSkills(): Promise<SkillsApiResponse> {
  try {
    const repo = await getSkillRepository();
    const rows = await repo.listTopByInstalls({ limit: INITIAL_PAGE_SIZE });
    if (rows.length === 0) {
      return fetchAllTimeSkills(0);
    }
    return {
      skills: rows.map((row) => ({
        source: row.source,
        skillId: row.skillId,
        name: row.name,
        installs: row.installs,
        weeklyInstalls: row.weeklyInstalls
          ? (JSON.parse(row.weeklyInstalls) as number[])
          : undefined,
        isOfficial: row.isOfficial,
      })),
      total: rows.length,
      hasMore: rows.length === INITIAL_PAGE_SIZE,
      page: 0,
    };
  } catch {
    return fetchAllTimeSkills(0);
  }
}

async function loadPlugins(): Promise<CursorPlugin[]> {
  try {
    return await getCursorPlugins();
  } catch {
    return [];
  }
}

/**
 * Server-side wrapper that resolves both the skills leaderboard data and the
 * Cursor plugin catalog up front, then hydrates the client tabbed component.
 * Render inside a Suspense boundary so the rest of the home page can stream
 * without waiting on the database / upstream.
 */
export async function SkillsLeaderboardSection() {
  const [initialData, plugins] = await Promise.all([
    loadInitialSkills(),
    loadPlugins(),
  ]);
  return <SkillsLeaderboard initialData={initialData} plugins={plugins} />;
}
