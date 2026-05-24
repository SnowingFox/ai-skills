/**
 * Sync skills.sh data into the local PostgreSQL database.
 *
 * Examples:
 *   bun run sync-skills                              # metadata only
 *   bun run sync-skills --with-markdown              # + SKILL.md for top 5000
 *   bun run sync-skills --with-markdown --limit=100  # + SKILL.md for top 100
 *   bun run sync-skills --force-markdown             # re-download markdown
 *
 * Runs against `DATABASE_URL` directly, bypassing Hyperdrive / getCloudflareContext
 * so the long-running fetch loop is not bound by the 5-minute Worker CPU limit.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { SkillRepository } from '../src/skills/skill-repository';
import { syncSkills } from '../src/skills/sync';
import { HttpSkillsShUpstream } from '../src/skills/upstream';

interface ParsedArgs {
  withMarkdown: boolean;
  limit: number;
  forceMarkdown: boolean;
  maxPages: number;
  concurrency: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    withMarkdown: false,
    limit: 5000,
    forceMarkdown: false,
    maxPages: 100,
    concurrency: 10,
  };

  for (const raw of argv) {
    if (raw === '--with-markdown') {
      args.withMarkdown = true;
    } else if (raw === '--force-markdown') {
      args.forceMarkdown = true;
    } else if (raw.startsWith('--limit=')) {
      args.limit = Number(raw.slice('--limit='.length));
    } else if (raw.startsWith('--max-pages=')) {
      args.maxPages = Number(raw.slice('--max-pages='.length));
    } else if (raw.startsWith('--concurrency=')) {
      args.concurrency = Number(raw.slice('--concurrency='.length));
    }
  }

  return args;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set, aborting.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  console.log('>>> sync-skills start', args);

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql, { schema });
  const repo = new SkillRepository(db);
  const upstream = new HttpSkillsShUpstream();

  try {
    const report = await syncSkills({
      repo,
      upstream,
      maxPages: args.maxPages,
      withMarkdown: args.withMarkdown,
      markdownLimit: args.limit,
      forceMarkdown: args.forceMarkdown,
      concurrency: args.concurrency,
    });
    console.log('<<< sync-skills done', report);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('sync-skills failed:', err);
  process.exit(1);
});
