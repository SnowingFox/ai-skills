import {
  EMPTY_SKILLS_RESPONSE,
  type SkillEntry,
  type SkillsApiResponse,
} from '@/lib/skills-api';
import type {
  SkillDetailParams,
  SkillDownloadFile,
  SkillDownloadPayload,
} from '@/lib/skills';

const DEFAULT_BASE_URL = 'https://skills.sh';

/**
 * Read-only interface against skills.sh. Implementations are injected into
 * sync scripts and SSR pages so tests can substitute fakes without touching
 * the real network.
 */
export interface SkillsShUpstream {
  fetchAllTime(page: number): Promise<SkillsApiResponse>;
  fetchDownload(
    params: SkillDetailParams
  ): Promise<SkillDownloadPayload | null>;
}

export interface HttpSkillsShUpstreamOptions {
  /** Override for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Override for tests. Defaults to https://skills.sh. */
  baseUrl?: string;
}

function isSkillEntry(value: unknown): value is SkillEntry {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.source === 'string' &&
    typeof record.skillId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.installs === 'number'
  );
}

function isSkillsApiResponse(value: unknown): value is SkillsApiResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.skills) &&
    record.skills.every(isSkillEntry) &&
    typeof record.total === 'number' &&
    typeof record.hasMore === 'boolean' &&
    typeof record.page === 'number'
  );
}

function isSkillDownloadFile(value: unknown): value is SkillDownloadFile {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.path === 'string' && typeof record.contents === 'string';
}

function isSkillDownloadPayload(value: unknown): value is SkillDownloadPayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.files) &&
    record.files.every(isSkillDownloadFile) &&
    (typeof record.hash === 'string' || typeof record.hash === 'undefined')
  );
}

/**
 * Default HTTP implementation of {@link SkillsShUpstream}.
 * Returns empty / null on any failure (network, non-OK status, malformed
 * payload) so callers never have to wrap calls in try/catch.
 */
export class HttpSkillsShUpstream implements SkillsShUpstream {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: HttpSkillsShUpstreamOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  async fetchAllTime(page: number): Promise<SkillsApiResponse> {
    const empty: SkillsApiResponse = { ...EMPTY_SKILLS_RESPONSE, page };
    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/api/skills/all-time/${page}`,
        // Cache upstream responses so the read-time fallback in the home page,
        // owner page, etc. does not pay the full upstream cost on every request.
        { next: { revalidate: 3600 } } as RequestInit
      );
      if (!response.ok) return empty;
      const data: unknown = await response.json();
      return isSkillsApiResponse(data) ? data : empty;
    } catch {
      return empty;
    }
  }

  async fetchDownload(
    params: SkillDetailParams
  ): Promise<SkillDownloadPayload | null> {
    const encodedPath = [params.owner, params.repo, params.skillId]
      .map(encodeURIComponent)
      .join('/');
    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/api/download/${encodedPath}`
      );
      if (!response.ok) return null;
      const data: unknown = await response.json();
      return isSkillDownloadPayload(data) ? data : null;
    } catch {
      return null;
    }
  }
}
