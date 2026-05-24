import { getLocalePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { generateHreflangUrls } from '@/lib/hreflang';
import { getBaseUrl } from '@/lib/urls';
import { getCursorPlugins } from '@/skills/get-cursor-upstream';
import { getSkillRepository } from '@/skills/get-skill-repository';
import { HttpSkillsShUpstream } from '@/skills/upstream';
import type { MetadataRoute } from 'next';
import type { Locale } from 'next-intl';

export const revalidate = 3600;

const SITEMAP_SKILL_LIMIT = 5000;
const UPSTREAM_PAGE_LIMIT = 25;

type Href = Parameters<typeof getLocalePathname>[0]['href'];

const staticRoutes = [
  '/',
  '/pricing',
  '/about',
  '/privacy',
  '/terms',
  '/cookie',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapList: MetadataRoute.Sitemap = [];
  const baseUrl = getBaseUrl();

  sitemapList.push(
    ...staticRoutes.flatMap((route) => {
      return routing.locales.map((locale) => ({
        url: getUrl(route, locale),
        alternates: {
          languages: generateHreflangUrls(route),
        },
      }));
    })
  );

  const skillEntries = await loadSkillEntries();

  const ownerSet = new Set<string>();
  const repoSet = new Set<string>();

  for (const { source, skillId } of skillEntries) {
    const url = getSkillUrl(source, skillId);
    if (url) sitemapList.push({ url });

    const [owner, repo] = source.split('/');
    if (owner && repo) {
      ownerSet.add(owner);
      repoSet.add(`${owner}/${repo}`);
    }
  }

  for (const owner of ownerSet) {
    sitemapList.push({ url: `${baseUrl}/skills/${encodeURIComponent(owner)}` });
  }
  for (const ownerRepo of repoSet) {
    const [owner, repo] = ownerRepo.split('/');
    sitemapList.push({
      url: `${baseUrl}/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    });
  }

  // Cursor Marketplace plugins (~140 entries). Best-effort: failure to load
  // upstream just means we ship a slightly smaller sitemap.
  try {
    const plugins = await getCursorPlugins();
    const pluginOwners = new Set<string>();
    for (const plugin of plugins) {
      pluginOwners.add(plugin.owner);
      sitemapList.push({
        url: `${baseUrl}/plugins/${encodeURIComponent(plugin.owner)}/${encodeURIComponent(plugin.name)}`,
      });
    }
    for (const owner of pluginOwners) {
      sitemapList.push({
        url: `${baseUrl}/plugins/${encodeURIComponent(owner)}`,
      });
    }
  } catch {
    // ignore — sitemap stays valid without plugin URLs
  }

  return sitemapList;
}

interface SkillSitemapEntry {
  source: string;
  skillId: string;
}

async function loadSkillEntries(): Promise<SkillSitemapEntry[]> {
  try {
    const repo = await getSkillRepository();
    const rows = await repo.listTopByInstalls({ limit: SITEMAP_SKILL_LIMIT });
    if (rows.length > 0) {
      return rows.map((row) => ({ source: row.source, skillId: row.skillId }));
    }
  } catch {
    // fall through to upstream
  }

  const upstream = new HttpSkillsShUpstream();
  const pages = await Promise.all(
    Array.from({ length: UPSTREAM_PAGE_LIMIT }, (_, page) =>
      upstream.fetchAllTime(page)
    )
  );
  const entries: SkillSitemapEntry[] = [];
  for (const page of pages) {
    for (const skill of page.skills) {
      entries.push({ source: skill.source, skillId: skill.skillId });
    }
  }
  return entries;
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getLocalePathname({ locale, href });
  return getBaseUrl() + pathname;
}

function getSkillUrl(source: string, skillId: string) {
  const [owner, repo] = source.split('/');
  if (!owner || !repo) {
    return null;
  }

  const encodedPath = [owner, repo, skillId].map(encodeURIComponent).join('/');
  return `${getBaseUrl()}/skills/${encodedPath}`;
}
