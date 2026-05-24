import { describe, expect, it, vi } from 'vitest';
import { HttpSkillsShUpstream } from '@/skills/upstream';

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpSkillsShUpstream.fetchAllTime', () => {
  it('hits the all-time endpoint for the given page', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ skills: [], total: 0, hasMore: false, page: 3 })
      );

    const client = new HttpSkillsShUpstream({ fetchImpl });
    await client.fetchAllTime(3);

    expect(fetchImpl).toHaveBeenCalledOnce();
    const url = fetchImpl.mock.calls[0]?.[0];
    expect(String(url)).toBe('https://skills.sh/api/skills/all-time/3');
  });

  it('returns parsed skills entries on success', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        skills: [
          {
            source: 'vercel-labs/skills',
            skillId: 'find-skills',
            name: 'find-skills',
            installs: 1000,
            weeklyInstalls: [10, 20, 30],
            isOfficial: true,
          },
        ],
        total: 1,
        hasMore: false,
        page: 0,
      })
    );

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchAllTime(0);

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].skillId).toBe('find-skills');
    expect(result.skills[0].weeklyInstalls).toEqual([10, 20, 30]);
    expect(result.skills[0].isOfficial).toBe(true);
    expect(result.total).toBe(1);
  });

  it('returns empty response on non-OK status, not throwing', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('boom', { status: 500 }));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchAllTime(2);

    expect(result.skills).toEqual([]);
    expect(result.page).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it('returns empty response on network failure, not throwing', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network down'));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchAllTime(0);

    expect(result.skills).toEqual([]);
  });

  it('returns empty response on malformed JSON, not throwing', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ not_what_we_expect: true }));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchAllTime(0);

    expect(result.skills).toEqual([]);
  });
});

describe('HttpSkillsShUpstream.fetchDownload', () => {
  it('hits the download endpoint with url-encoded path components', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ files: [], hash: 'abc' }));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    await client.fetchDownload({
      owner: 'vercel labs',
      repo: 'skills',
      skillId: 'find-skills',
    });

    const url = fetchImpl.mock.calls[0]?.[0];
    expect(String(url)).toBe(
      'https://skills.sh/api/download/vercel%20labs/skills/find-skills'
    );
  });

  it('returns payload when files are valid', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        files: [{ path: 'SKILL.md', contents: '# hello' }],
        hash: 'abc',
      })
    );

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchDownload({
      owner: 'vercel-labs',
      repo: 'skills',
      skillId: 'find-skills',
    });

    expect(result).not.toBeNull();
    expect(result!.files).toHaveLength(1);
    expect(result!.hash).toBe('abc');
  });

  it('returns null on non-OK status', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('not found', { status: 404 }));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchDownload({
      owner: 'a',
      repo: 'b',
      skillId: 'c',
    });

    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('timeout'));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchDownload({
      owner: 'a',
      repo: 'b',
      skillId: 'c',
    });

    expect(result).toBeNull();
  });

  it('returns null on malformed payload', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ wrong: 'shape' }));

    const client = new HttpSkillsShUpstream({ fetchImpl });
    const result = await client.fetchDownload({
      owner: 'a',
      repo: 'b',
      skillId: 'c',
    });

    expect(result).toBeNull();
  });
});
