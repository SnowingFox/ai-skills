import { parseRepositoryUrl } from './parse-repository-url';

export interface CursorPluginSkill {
  name: string;
  description: string;
  sourceUrl?: string;
  sourcePath?: string;
}

export interface CursorPluginPublisher {
  name: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface CursorPlugin {
  /** Cursor-side identifier — usually matches the GitHub repo name. */
  name: string;
  displayName: string;
  description: string;
  /** Owner derived from `repositoryUrl`. */
  owner: string;
  /** Repo derived from `repositoryUrl`. */
  repo: string;
  repositoryUrl: string;
  publisher: CursorPluginPublisher;
  skills: CursorPluginSkill[];
}

export interface CursorMarketplaceUpstream {
  listPlugins(): Promise<CursorPlugin[]>;
}

export interface HttpCursorMarketplaceUpstreamOptions {
  /** Override for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to https://cursor.com. */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'https://cursor.com';

/**
 * HTTP implementation of {@link CursorMarketplaceUpstream}. Mirrors the
 * {@link HttpSkillsShUpstream} pattern: any failure (network, non-OK status,
 * malformed payload, missing repositoryUrl) is swallowed into an empty array
 * so SSR callers can render without a try/catch.
 */
export class HttpCursorMarketplaceUpstream
  implements CursorMarketplaceUpstream
{
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: HttpCursorMarketplaceUpstreamOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async listPlugins(): Promise<CursorPlugin[]> {
    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/api/dashboard/list-marketplace-plugins`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: [] }),
          // SSR-side cache so repeated requests within a 1-hour window are
          // served from the Next.js fetch cache rather than re-hitting cursor.com.
          next: { revalidate: 3600 },
        } as RequestInit
      );
      if (!response.ok) return [];
      const data: unknown = await response.json();
      return parsePluginsPayload(data);
    } catch {
      return [];
    }
  }
}

function parsePluginsPayload(value: unknown): CursorPlugin[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.plugins)) return [];

  const result: CursorPlugin[] = [];
  for (const rawPlugin of record.plugins) {
    const plugin = normalisePlugin(rawPlugin);
    if (plugin) result.push(plugin);
  }
  return result;
}

function normalisePlugin(raw: unknown): CursorPlugin | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const repositoryUrl =
    typeof r.repositoryUrl === 'string' ? r.repositoryUrl : '';
  const parsedRepo = parseRepositoryUrl(repositoryUrl);
  if (!parsedRepo) return null;

  const publisherRaw =
    r.publisher && typeof r.publisher === 'object'
      ? (r.publisher as Record<string, unknown>)
      : {};

  const publisherName =
    typeof publisherRaw.name === 'string' ? publisherRaw.name : '';
  if (!publisherName) return null;

  const skillsRaw = Array.isArray(r.skills) ? r.skills : [];
  const skills: CursorPluginSkill[] = [];
  for (const s of skillsRaw) {
    if (!s || typeof s !== 'object') continue;
    const sr = s as Record<string, unknown>;
    if (typeof sr.name !== 'string') continue;
    skills.push({
      name: sr.name,
      description: typeof sr.description === 'string' ? sr.description : '',
      sourceUrl: typeof sr.sourceUrl === 'string' ? sr.sourceUrl : undefined,
      sourcePath: typeof sr.sourcePath === 'string' ? sr.sourcePath : undefined,
    });
  }

  const name = typeof r.name === 'string' ? r.name : '';
  if (!name) return null;

  return {
    name,
    displayName: typeof r.displayName === 'string' ? r.displayName : name,
    description: typeof r.description === 'string' ? r.description : '',
    owner: parsedRepo.owner,
    repo: parsedRepo.repo,
    repositoryUrl,
    publisher: {
      name: publisherName,
      displayName:
        typeof publisherRaw.displayName === 'string'
          ? publisherRaw.displayName
          : undefined,
      description:
        typeof publisherRaw.description === 'string'
          ? publisherRaw.description
          : undefined,
      logoUrl:
        typeof publisherRaw.logoUrl === 'string'
          ? publisherRaw.logoUrl
          : undefined,
      websiteUrl:
        typeof publisherRaw.websiteUrl === 'string'
          ? publisherRaw.websiteUrl
          : undefined,
    },
    skills,
  };
}
