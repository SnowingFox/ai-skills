export interface SkillEntry {
  source: string;
  skillId: string;
  name: string;
  installs: number;
}

export interface SkillsApiResponse {
  skills: SkillEntry[];
  total: number;
  hasMore: boolean;
  page: number;
}

export const EMPTY_SKILLS_RESPONSE = {
  skills: [],
  total: 0,
  hasMore: false,
  page: 0,
} satisfies SkillsApiResponse;

const SKILLS_API_BASE_URL = 'https://skills.sh/api/skills/all-time';

function isSkillEntry(value: unknown): value is SkillEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.source === 'string' &&
    typeof record.skillId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.installs === 'number'
  );
}

function isSkillsApiResponse(value: unknown): value is SkillsApiResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.skills) &&
    record.skills.every(isSkillEntry) &&
    typeof record.total === 'number' &&
    typeof record.hasMore === 'boolean' &&
    typeof record.page === 'number'
  );
}

export async function fetchAllTimeSkills(page = 0): Promise<SkillsApiResponse> {
  try {
    const response = await fetch(`${SKILLS_API_BASE_URL}/${page}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return { ...EMPTY_SKILLS_RESPONSE, page };
    }

    const data: unknown = await response.json();
    return isSkillsApiResponse(data)
      ? data
      : { ...EMPTY_SKILLS_RESPONSE, page };
  } catch {
    return { ...EMPTY_SKILLS_RESPONSE, page };
  }
}
