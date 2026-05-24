import type { SkillEntry, SkillsApiResponse } from '@/lib/skills-api';
import { getSkillRepository } from '@/skills/get-skill-repository';
import {
  shouldCacheResponse,
  shouldUseCachedResponse,
} from '@/skills/kv-cache';
import { searchUpstream } from '@/skills/upstream-fallback';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10);
  const offsetParam = Number.parseInt(searchParams.get('offset') ?? '', 10);

  const limit = Number.isSafeInteger(limitParam)
    ? Math.max(1, Math.min(limitParam, MAX_LIMIT))
    : DEFAULT_LIMIT;
  const offset =
    Number.isSafeInteger(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  const empty: SkillsApiResponse = {
    skills: [],
    total: 0,
    hasMore: false,
    page: 0,
  };

  if (!q) {
    return NextResponse.json(empty, { headers: CACHE_HEADERS });
  }

  const kvKey = `skills:search:${q}:${limit}:${offset}`;

  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.SKILLS_KV) {
      const cached = await env.SKILLS_KV.get<SkillsApiResponse>(kvKey, 'json');
      if (shouldUseCachedResponse(cached)) {
        return NextResponse.json(cached, { headers: CACHE_HEADERS });
      }
    }
  } catch {}

  try {
    const repo = await getSkillRepository();
    const rows = await repo.search(q, { limit, offset });

    if (rows.length > 0) {
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
        hasMore: rows.length === limit,
        page: Math.floor(offset / limit),
      };

      if (shouldCacheResponse(response)) {
        try {
          const { env, ctx } = await getCloudflareContext({ async: true });
          if (env.SKILLS_KV) {
            ctx.waitUntil(
              env.SKILLS_KV.put(kvKey, JSON.stringify(response), {
                expirationTtl: 3600,
              })
            );
          }
        } catch {}
      }

      return NextResponse.json(response, { headers: CACHE_HEADERS });
    }
  } catch (error) {
    console.warn('[search] DB read failed', error);
  }

  const upstream: SkillEntry[] = await searchUpstream(q);
  const window = upstream.slice(offset, offset + limit);
  const response: SkillsApiResponse = {
    skills: window,
    total: window.length,
    hasMore: upstream.length > offset + limit,
    page: Math.floor(offset / limit),
  };

  if (shouldCacheResponse(response)) {
    try {
      const { env, ctx } = await getCloudflareContext({ async: true });
      if (env.SKILLS_KV) {
        ctx.waitUntil(
          env.SKILLS_KV.put(kvKey, JSON.stringify(response), {
            expirationTtl: 3600,
          })
        );
      }
    } catch {}
  }

  return NextResponse.json(response, { headers: CACHE_HEADERS });
}
