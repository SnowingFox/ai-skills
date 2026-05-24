import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/postgres-js';
import { skill } from '@/db/app.schema';
import type * as schema from '@/db/schema';

export type SkillDb = ReturnType<typeof drizzle<typeof schema>>;

export interface SkillIdentifier {
  owner: string;
  repo: string;
  skillId: string;
}

export interface SkillRow {
  id: string;
  source: string;
  owner: string;
  repo: string;
  skillId: string;
  name: string;
  description: string | null;
  installs: number;
  weeklyInstalls: string | null;
  isOfficial: boolean;
  markdownContent: string | null;
  metadataSyncedAt: Date | null;
  markdownSyncedAt: Date | null;
}

export interface SkillSummary {
  source: string;
  owner: string;
  repo: string;
  skillId: string;
  name: string;
  description?: string | null;
  installs: number;
  weeklyInstalls?: number[] | null;
  isOfficial?: boolean;
}

export interface RepoSummary {
  repo: string;
  skillCount: number;
  totalInstalls: number;
  skillNames: string[];
}

function buildId({ owner, repo, skillId }: SkillIdentifier): string {
  return `${owner}/${repo}/${skillId}`;
}

/**
 * Repository for skill records. Owns the database vocabulary so callers
 * (pages, sync scripts, API routes) work in domain terms instead of SQL.
 */
export class SkillRepository {
  constructor(private readonly db: SkillDb) {}

  async findById(params: SkillIdentifier): Promise<SkillRow | null> {
    const id = buildId(params);
    const [row] = await this.db
      .select()
      .from(skill)
      .where(eq(skill.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * Returns skills ordered by install count (highest first).
   *
   * @example
   * const top10 = await repo.listTopByInstalls({ limit: 10 });
   */
  async listTopByInstalls(options: {
    limit: number;
    offset?: number;
  }): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(skill)
      .orderBy(desc(skill.installs))
      .limit(options.limit)
      .offset(options.offset ?? 0);
  }

  /**
   * Case-insensitive substring match across name / source / description,
   * ordered by installs descending. Empty query returns an empty array.
   *
   * TODO: when the table exceeds ~5000 rows consider a trigram (pg_trgm) GIN
   * index to keep ILIKE searches fast.
   */
  async search(
    query: string,
    options: { limit: number; offset?: number }
  ): Promise<SkillRow[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const pattern = `%${trimmed}%`;
    return this.db
      .select()
      .from(skill)
      .where(
        or(
          ilike(skill.name, pattern),
          ilike(skill.source, pattern),
          ilike(skill.description, pattern)
        )
      )
      .orderBy(desc(skill.installs))
      .limit(options.limit)
      .offset(options.offset ?? 0);
  }

  /**
   * Insert or update metadata-only fields. Never overwrites markdownContent
   * — that field is owned by upsertMarkdown.
   */
  async upsertSummary(input: SkillSummary): Promise<void> {
    const id = buildId(input);
    const weeklyInstalls = input.weeklyInstalls
      ? JSON.stringify(input.weeklyInstalls)
      : null;
    const now = new Date();

    await this.db
      .insert(skill)
      .values({
        id,
        source: input.source,
        owner: input.owner,
        repo: input.repo,
        skillId: input.skillId,
        name: input.name,
        description: input.description ?? null,
        installs: input.installs,
        weeklyInstalls,
        isOfficial: input.isOfficial ?? false,
        metadataSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: skill.id,
        set: {
          source: input.source,
          owner: input.owner,
          repo: input.repo,
          skillId: input.skillId,
          name: input.name,
          description: input.description ?? null,
          installs: input.installs,
          weeklyInstalls,
          isOfficial: input.isOfficial ?? false,
          metadataSyncedAt: now,
        },
      });
  }

  /**
   * Returns all skills under a given owner, ordered by installs desc.
   * Used by /skills/[owner] page when callers want a flat list.
   */
  async listByOwner(
    owner: string,
    options: { limit: number; offset?: number }
  ): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(skill)
      .where(eq(skill.owner, owner))
      .orderBy(desc(skill.installs))
      .limit(options.limit)
      .offset(options.offset ?? 0);
  }

  /**
   * Returns all skills under a given owner/repo, ordered by installs desc.
   * Used by /skills/[owner]/[repo] page.
   */
  async listByRepo(
    owner: string,
    repo: string,
    options: { limit: number; offset?: number }
  ): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(skill)
      .where(and(eq(skill.owner, owner), eq(skill.repo, repo)))
      .orderBy(desc(skill.installs))
      .limit(options.limit)
      .offset(options.offset ?? 0);
  }

  /**
   * Returns per-repo aggregation for an owner: skill count, total installs,
   * and skill names ordered by installs desc within each repo. Repos are
   * returned ordered by totalInstalls desc.
   *
   * @example
   * const repos = await repo.summariseByOwner('vercel-labs');
   * // [{ repo: 'skills', skillCount: 1, totalInstalls: 1700000, skillNames: ['find-skills'] }, ...]
   */
  async summariseByOwner(owner: string): Promise<RepoSummary[]> {
    const rows = await this.db
      .select({
        repo: skill.repo,
        name: skill.name,
        installs: skill.installs,
      })
      .from(skill)
      .where(eq(skill.owner, owner))
      .orderBy(desc(skill.installs), asc(skill.name));

    const grouped = new Map<
      string,
      { skillCount: number; totalInstalls: number; skillNames: string[] }
    >();

    for (const row of rows) {
      const existing = grouped.get(row.repo);
      if (existing) {
        existing.skillCount += 1;
        existing.totalInstalls += row.installs;
        existing.skillNames.push(row.name);
      } else {
        grouped.set(row.repo, {
          skillCount: 1,
          totalInstalls: row.installs,
          skillNames: [row.name],
        });
      }
    }

    return [...grouped.entries()]
      .map(([repo, summary]) => ({ repo, ...summary }))
      .sort((a, b) => b.totalInstalls - a.totalInstalls);
  }

  /**
   * Update the SKILL.md content for an existing skill row. No-op when the row
   * does not exist — the metadata sync owns row creation.
   */
  async upsertMarkdown(
    params: SkillIdentifier,
    markdownContent: string
  ): Promise<void> {
    const id = buildId(params);
    await this.db
      .update(skill)
      .set({
        markdownContent,
        markdownSyncedAt: new Date(),
      })
      .where(eq(skill.id, id));
  }
}
