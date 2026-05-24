import { fetchAllTimeSkills, type SkillsApiResponse } from '@/lib/skills-api';
import { getSkillRepository } from '@/skills/get-skill-repository';
import {
  shouldCacheResponse,
  shouldUseCachedResponse,
} from '@/skills/kv-cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

const PAGE_SIZE = 200;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
  'CDN-Cache-Control': 'public, s-maxage=10800, stale-while-revalidate=86400',
};

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

  const kvKey = `skills:all-time:${pageNumber}`;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = env.SKILLS_KV;

    if (kv) {
      const cached = await kv.get<SkillsApiResponse>(kvKey, 'json');
      if (shouldUseCachedResponse(cached)) {
        return NextResponse.json(cached, { headers: CACHE_HEADERS });
      }
    }
  } catch {}

  try {
    const repo = await getSkillRepository();
    const rows = await repo.listTopByInstalls({
      limit: PAGE_SIZE,
      offset: pageNumber * PAGE_SIZE,
    });

    if (rows.length === 0 && pageNumber === 0) {
      const upstream = await fetchAllTimeSkills(0);
      return NextResponse.json(upstream, { headers: CACHE_HEADERS });
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

    if (shouldCacheResponse(response)) {
      try {
        const { env, ctx } = await getCloudflareContext({ async: true });
        if (env.SKILLS_KV) {
          ctx.waitUntil(
            env.SKILLS_KV.put(kvKey, JSON.stringify(response), {
              expirationTtl: 10800,
            })
          );
        }
      } catch {}
    }

    return NextResponse.json(response, { headers: CACHE_HEADERS });
  } catch (error) {
    console.warn('[all-time] DB read failed, falling back to upstream', error);
    const upstream = await fetchAllTimeSkills(pageNumber);
    return NextResponse.json(upstream, { headers: CACHE_HEADERS });
  }
}
