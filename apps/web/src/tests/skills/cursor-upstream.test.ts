import { describe, expect, it, vi } from 'vitest';
import { HttpCursorMarketplaceUpstream } from '@/skills/cursor-upstream';

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

const samplePlugin = {
  name: 'modern-web-guidance',
  displayName: 'Modern Web Guidance',
  description: 'Best practices for the modern web platform.',
  repositoryUrl: 'https://github.com/GoogleChrome/modern-web-guidance',
  publisher: {
    name: 'google-chrome',
    displayName: 'Chrome Modern Web Guidance',
    logoUrl: 'https://example.com/logo.png',
    websiteUrl: 'https://developer.chrome.com/',
  },
  skills: [
    {
      name: 'chrome-extensions',
      description: 'Build Chrome extensions.',
      sourceUrl: 'https://github.com/example/SKILL.md',
    },
  ],
};

describe('HttpCursorMarketplaceUpstream.listPlugins', () => {
  it('returns plugins with derived owner/repo from repositoryUrl', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ plugins: [samplePlugin] }));

    const upstream = new HttpCursorMarketplaceUpstream({ fetchImpl });
    const plugins = await upstream.listPlugins();

    expect(plugins).toHaveLength(1);
    expect(plugins[0].owner).toBe('GoogleChrome');
    expect(plugins[0].repo).toBe('modern-web-guidance');
    expect(plugins[0].displayName).toBe('Modern Web Guidance');
    expect(plugins[0].publisher.logoUrl).toBe('https://example.com/logo.png');
    expect(plugins[0].skills).toHaveLength(1);
  });

  it('POSTs to the marketplace endpoint with an empty tags filter', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ plugins: [] }));

    const upstream = new HttpCursorMarketplaceUpstream({ fetchImpl });
    await upstream.listPlugins();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      'https://cursor.com/api/dashboard/list-marketplace-plugins'
    );
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ tags: [] }));
  });

  it('returns empty array on non-OK responses', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('nope', { status: 500 }));

    const upstream = new HttpCursorMarketplaceUpstream({ fetchImpl });
    expect(await upstream.listPlugins()).toEqual([]);
  });

  it('returns empty array on network failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'));

    const upstream = new HttpCursorMarketplaceUpstream({ fetchImpl });
    expect(await upstream.listPlugins()).toEqual([]);
  });

  it('returns empty array on malformed payload', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ not_plugins: true }));

    const upstream = new HttpCursorMarketplaceUpstream({ fetchImpl });
    expect(await upstream.listPlugins()).toEqual([]);
  });

  it('skips plugins without a parseable repositoryUrl', async () => {
    const broken = { ...samplePlugin, name: 'broken', repositoryUrl: '' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ plugins: [broken, samplePlugin] }));

    const upstream = new HttpCursorMarketplaceUpstream({ fetchImpl });
    const plugins = await upstream.listPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('modern-web-guidance');
  });
});
