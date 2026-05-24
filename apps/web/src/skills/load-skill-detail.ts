import { cache } from 'react';
import {
  parseSkillDownloadPayload,
  type SkillDetail,
  type SkillDetailParams,
} from '@/lib/skills';
import { getSkillRepository } from './get-skill-repository';
import { HttpSkillsShUpstream, type SkillsShUpstream } from './upstream';
import type { SkillRepository } from './skill-repository';

const defaultUpstream = new HttpSkillsShUpstream();

/**
 * Loads a fully-rendered SkillDetail using a database-first strategy:
 * 1. Look up the row by id. If markdown is present, render from the DB only.
 * 2. If the row is missing markdown, fetch upstream and persist the markdown
 *    back to the DB before rendering.
 * 3. If the row does not exist, fetch upstream, persist summary + markdown,
 *    then render.
 *
 * Returns null when the skill cannot be found in either layer.
 */
async function loadSkillDetailInner(
  params: SkillDetailParams,
  deps?: { repo?: SkillRepository; upstream?: SkillsShUpstream }
): Promise<SkillDetail | null> {
  const upstream = deps?.upstream ?? defaultUpstream;
  let repo: SkillRepository | null = deps?.repo ?? null;

  try {
    if (!repo) repo = await getSkillRepository();
  } catch {
    repo = null;
  }

  let row: Awaited<ReturnType<SkillRepository['findById']>> | null = null;
  if (repo) {
    try {
      row = await repo.findById(params);
    } catch (error) {
      console.warn('[loadSkillDetail] findById failed', error);
      // Treat as missing — we'll fetch from upstream below.
    }
  }

  if (row?.markdownContent) {
    return buildDetailFromMarkdown(params, row.markdownContent);
  }

  const payload = await upstream.fetchDownload(params);
  if (!payload) return null;

  const detail = parseSkillDownloadPayload(params, payload);
  if (!detail) return null;

  if (repo) {
    try {
      if (!row) {
        await repo.upsertSummary({
          source: detail.source,
          owner: detail.owner,
          repo: detail.repo,
          skillId: detail.skillId,
          name: detail.name,
          description: detail.description || null,
          installs: 0,
        });
      }
      await repo.upsertMarkdown(params, detail.skillMarkdown);
    } catch {
      // best-effort cache write — fall through to serve the detail anyway
    }
  }

  return detail;
}

function buildDetailFromMarkdown(
  params: SkillDetailParams,
  rawMarkdown: string
): SkillDetail | null {
  return parseSkillDownloadPayload(params, {
    files: [{ path: 'SKILL.md', contents: rawMarkdown }],
  });
}

/**
 * Request-scoped cache wrapper for {@link loadSkillDetailInner}. Identical params
 * within the same request resolve to the same promise — important because
 * generateMetadata and the page body both load the detail.
 */
export const loadSkillDetail = cache((params: SkillDetailParams) =>
  loadSkillDetailInner(params)
);
