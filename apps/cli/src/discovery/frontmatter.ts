/** Minimal YAML frontmatter fields extracted from `SKILL.md`. */
export type SkillFrontmatter = {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Naive line parser for YAML frontmatter in `SKILL.md` files. Reads
 * `name` and `description` from the `---` delimited block at the top of
 * the file. Returns an empty object when no frontmatter is present.
 *
 * @example
 * parseSkillFrontmatter('---\nname: caveman\ndescription: compressed comms\n---\n...');
 * // returns: { name: 'caveman', description: 'compressed comms' }
 */
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
