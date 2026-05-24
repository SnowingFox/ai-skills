import { fetchAllTimeSkills, type SkillsApiResponse } from '@/lib/skills-api';
import { getSkillRepository } from '@/skills/get-skill-repository';
import { NextResponse } from 'next/server';

const PAGE_SIZE = 200;

interface RouteContext {
  params: Promise<{
    page: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { page } = await context.params;
  const pageNumber = Number.parseInt(page, 10);

  if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }

  try {
    const repo = await getSkillRepository();
    const rows = await repo.listTopByInstalls({
      limit: PAGE_SIZE,
      offset: pageNumber * PAGE_SIZE,
    });

    // Bootstrap fallback: while the local DB is being populated, defer to the
    // upstream API so the leaderboard isn't empty in production.
    if (rows.length === 0 && pageNumber === 0) {
      const upstream = await fetchAllTimeSkills(0);
      return NextResponse.json(upstream);
    }

    const response: SkillsApiResponse = {
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
      hasMore: rows.length === PAGE_SIZE,
      page: pageNumber,
    };

    return NextResponse.json(response);
  } catch (error) {
    // Bootstrap or DB failure: fall back to upstream so the UI keeps working
    // while the database is being prepared / migrated.
    console.warn('[all-time] DB read failed, falling back to upstream', error);
    const upstream = await fetchAllTimeSkills(pageNumber);
    return NextResponse.json(upstream);
  }
}
