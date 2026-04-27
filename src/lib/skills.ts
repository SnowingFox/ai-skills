export interface SkillDetailParams {
  owner: string;
  repo: string;
  skillId: string;
}

export interface SkillDownloadFile {
  path: string;
  contents: string;
}

export interface SkillDetail {
  owner: string;
  repo: string;
  skillId: string;
  source: string;
  name: string;
  title: string;
  description: string;
  installCommand: string;
  repositoryUrl: string;
  skillMarkdown: string;
  markdownContent: string;
  summaryItems: string[];
  files: SkillDownloadFile[];
  fileCount: number;
  license: string | null;
  hash: string | null;
}

interface SkillDownloadPayload {
  files: SkillDownloadFile[];
  hash?: string;
}

interface ParsedFrontmatter {
  metadata: Record<string, string>;
  content: string;
}

const SKILL_DOWNLOAD_API_BASE_URL = 'https://skills.sh/api/download';
const SKILL_FILE_NAME = 'SKILL.md';

function isSkillDownloadFile(value: unknown): value is SkillDownloadFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.path === 'string' && typeof record.contents === 'string';
}

function isSkillDownloadPayload(value: unknown): value is SkillDownloadPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.files) &&
    record.files.every(isSkillDownloadFile) &&
    (typeof record.hash === 'string' || typeof record.hash === 'undefined')
  );
}

function buildSkillDownloadUrl({ owner, repo, skillId }: SkillDetailParams) {
  const encodedPath = [owner, repo, skillId].map(encodeURIComponent).join('/');
  return `${SKILL_DOWNLOAD_API_BASE_URL}/${encodedPath}`;
}

function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith('---\n')) {
    return { metadata: {}, content: markdown.trim() };
  }

  const endIndex = markdown.indexOf('\n---', 4);
  if (endIndex === -1) {
    return { metadata: {}, content: markdown.trim() };
  }

  const frontmatter = markdown.slice(4, endIndex);
  const content = markdown.slice(endIndex + 4).trim();
  const metadata: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  function flushBlock() {
    if (!currentKey) {
      return;
    }

    metadata[currentKey] = currentValue.join('\n').trim();
    currentKey = null;
    currentValue = [];
  }

  for (const line of frontmatter.split('\n')) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);

    if (keyMatch) {
      flushBlock();
      const [, key, rawValue] = keyMatch;

      if (rawValue === '|') {
        currentKey = key;
        currentValue = [];
      } else {
        metadata[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
      }
      continue;
    }

    if (currentKey) {
      currentValue.push(line.replace(/^\s{1,2}/, ''));
    }
  }

  flushBlock();

  return { metadata, content };
}

function extractTitle(markdownContent: string, fallback: string) {
  const titleLine = markdownContent
    .split('\n')
    .find((line) => line.startsWith('# '));

  return titleLine?.replace(/^#\s+/, '').trim() || fallback;
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

function extractFirstBulletList(markdownContent: string) {
  const items: string[] = [];
  let collecting = false;

  for (const line of markdownContent.split('\n')) {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);

    if (bulletMatch) {
      collecting = true;
      items.push(stripInlineMarkdown(bulletMatch[1]));
      continue;
    }

    if (collecting && line.trim() !== '') {
      break;
    }
  }

  return items.slice(0, 6);
}

function detectLicense(files: SkillDownloadFile[]) {
  const licenseFile = files.find((file) =>
    file.path.toLowerCase().startsWith('license')
  );

  if (!licenseFile) {
    return null;
  }

  if (/mit license/i.test(licenseFile.contents)) {
    return 'MIT';
  }

  return licenseFile.contents.split('\n')[0]?.trim() || null;
}

export function parseSkillDownloadPayload(
  params: SkillDetailParams,
  payload: unknown
): SkillDetail | null {
  if (!isSkillDownloadPayload(payload)) {
    return null;
  }

  const skillFile = payload.files.find(
    (file) => file.path.toLowerCase() === SKILL_FILE_NAME.toLowerCase()
  );

  if (!skillFile) {
    return null;
  }

  const { metadata, content } = parseFrontmatter(skillFile.contents);
  const name = metadata.name || params.skillId;
  const description = metadata.description || '';
  const source = `${params.owner}/${params.repo}`;
  const repositoryUrl = `https://github.com/${source}`;

  return {
    ...params,
    source,
    name,
    title: extractTitle(content, name),
    description,
    installCommand: `npx skills add ${repositoryUrl} --skill ${params.skillId}`,
    repositoryUrl,
    skillMarkdown: skillFile.contents,
    markdownContent: content,
    summaryItems: extractFirstBulletList(content),
    files: payload.files,
    fileCount: payload.files.length,
    license: detectLicense(payload.files),
    hash: payload.hash ?? null,
  };
}

export async function getSkillDetail(params: SkillDetailParams) {
  try {
    const response = await fetch(buildSkillDownloadUrl(params), {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    return parseSkillDownloadPayload(params, payload);
  } catch {
    return null;
  }
}
