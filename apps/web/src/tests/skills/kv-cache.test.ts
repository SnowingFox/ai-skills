import { describe, expect, it, vi } from 'vitest';
import {
  shouldCacheResponse,
  shouldUseCachedResponse,
} from '@/skills/kv-cache';

/**
 * Tests for the KV caching layer behavior in skills API routes and SSR.
 * Validates that empty results are never cached or served from KV.
 */

interface MockKV {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

interface SkillsApiResponse {
  skills: Array<{
    source: string;
    skillId: string;
    name: string;
    installs: number;
  }>;
  total: number;
  hasMore: boolean;
  page: number;
}

function createMockKV(data: Record<string, unknown> = {}): MockKV {
  return {
    get: vi.fn(async (key: string) => data[key] ?? null),
    put: vi.fn(async () => {}),
  };
}

const VALID_RESPONSE: SkillsApiResponse = {
  skills: [
    {
      source: 'github.com/test/repo',
      skillId: 'my-skill',
      name: 'My Skill',
      installs: 100,
    },
  ],
  total: 1,
  hasMore: false,
  page: 0,
};

const EMPTY_RESPONSE: SkillsApiResponse = {
  skills: [],
  total: 0,
  hasMore: false,
  page: 0,
};

describe('KV cache guard: shouldUseCachedResponse', () => {
  it('returns true for responses with skills', () => {
    expect(shouldUseCachedResponse(VALID_RESPONSE)).toBe(true);
  });

  it('returns false for null (cache miss)', () => {
    expect(shouldUseCachedResponse(null)).toBe(false);
  });

  it('returns false for empty skills array', () => {
    expect(shouldUseCachedResponse(EMPTY_RESPONSE)).toBe(false);
  });

  it('returns false for response with zero-length skills', () => {
    const zeroSkills = { ...VALID_RESPONSE, skills: [], total: 0 };
    expect(shouldUseCachedResponse(zeroSkills)).toBe(false);
  });
});

describe('KV cache guard: shouldCacheResponse', () => {
  it('allows caching responses with skills', () => {
    expect(shouldCacheResponse(VALID_RESPONSE)).toBe(true);
  });

  it('prevents caching empty responses', () => {
    expect(shouldCacheResponse(EMPTY_RESPONSE)).toBe(false);
  });
});

describe('KV read-through integration', () => {
  it('skips KV and falls through when cached data has empty skills', async () => {
    const kv = createMockKV({ 'skills:all-time:0': EMPTY_RESPONSE });
    const cached = await kv.get('skills:all-time:0');

    if (!shouldUseCachedResponse(cached)) {
      // Would fall through to DB/upstream
      expect(true).toBe(true);
    } else {
      throw new Error('Should not use cached empty response');
    }
  });

  it('returns KV data when cached skills are non-empty', async () => {
    const kv = createMockKV({ 'skills:all-time:0': VALID_RESPONSE });
    const cached = await kv.get('skills:all-time:0');

    expect(shouldUseCachedResponse(cached)).toBe(true);
  });

  it('does not write empty results to KV', async () => {
    const kv = createMockKV();

    if (shouldCacheResponse(EMPTY_RESPONSE)) {
      await kv.put('skills:all-time:0', JSON.stringify(EMPTY_RESPONSE));
    }

    expect(kv.put).not.toHaveBeenCalled();
  });

  it('writes non-empty results to KV', async () => {
    const kv = createMockKV();

    if (shouldCacheResponse(VALID_RESPONSE)) {
      await kv.put('skills:all-time:0', JSON.stringify(VALID_RESPONSE));
    }

    expect(kv.put).toHaveBeenCalledWith(
      'skills:all-time:0',
      JSON.stringify(VALID_RESPONSE)
    );
  });
});
