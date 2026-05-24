import { cache } from 'react';
import { getDb } from '@/db';
import { SkillRepository } from './skill-repository';

/**
 * Returns a request-scoped SkillRepository. Pages, API routes, and the sitemap
 * call this instead of constructing the repo themselves so the Hyperdrive-backed
 * connection is reused across the same request.
 */
export const getSkillRepository = cache(async () => {
  const db = await getDb();
  return new SkillRepository(db);
});
