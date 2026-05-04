export type SkillFrontmatter = {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export const parseSkillFrontmatter = (content: string): SkillFrontmatter => {
  if (!content.startsWith('---\n')) {
    return {};
  }

  const end = content.indexOf('\n---', 4);
  if (end < 0) {
    return {};
  }

  const raw = content.slice(4, end);
  const data: SkillFrontmatter = {};
  for (const line of raw.split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (key === 'name') {
      data.name = value;
    }
    if (key === 'description') {
      data.description = value;
    }
  }

  return data;
};
