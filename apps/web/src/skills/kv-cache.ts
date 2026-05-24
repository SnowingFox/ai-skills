import type { SkillsApiResponse } from '@/lib/skills-api';

/**
 * Returns true only if the KV-cached response contains actual skill data.
 * Empty or zero-skill responses should be treated as cache misses so the
 * system falls through to DB/upstream.
 */
export function shouldUseCachedResponse(
  cached: SkillsApiResponse | null
): cached is SkillsApiResponse {
  return cached !== null && cached.skills.length > 0;
}

/**
 * Returns true if the response is worth persisting to KV.
 * Empty results (from failed upstreams or empty DBs) must never be cached
 * to avoid poisoning the cache for subsequent requests.
 */
export function shouldCacheResponse(response: SkillsApiResponse): boolean {
  return response.skills.length > 0;
}
