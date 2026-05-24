import { InstallCommand } from '@/components/skills/install-command';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getSkillRepository } from '@/skills/get-skill-repository';
import { listByRepoUpstream } from '@/skills/upstream-fallback';
import { PackageIcon, TrendingUpIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface RepoSkillView {
  id: string;
  skillId: string;
  name: string;
  description: string | null;
  installs: number;
}

interface RepoPageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export async function generateMetadata({
  params,
}: RepoPageProps): Promise<Metadata> {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} | AI Skills`,
    description: `Skills in ${owner}/${repo}`,
  };
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { owner, repo } = await params;
  let skills: RepoSkillView[] = [];
  try {
    const repository = await getSkillRepository();
    const rows = await repository.listByRepo(owner, repo, { limit: 200 });
    skills = rows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      name: row.name,
      description: row.description,
      installs: row.installs,
    }));
  } catch (error) {
    console.warn('[repo page] DB read failed', error);
  }

  if (skills.length === 0) {
    try {
      const upstreamSkills = await listByRepoUpstream(owner, repo);
      skills = upstreamSkills.map((entry) => ({
        id: `${owner}/${repo}/${entry.skillId}`,
        skillId: entry.skillId,
        name: entry.name,
        description: null,
        installs: entry.installs,
      }));
    } catch (error) {
      console.warn('[repo page] upstream fallback failed', error);
    }
  }

  if (skills.length === 0) {
    notFound();
  }

  const totalInstalls = skills.reduce((sum, s) => sum + s.installs, 0);
  const installCommand = `npx ai-pkgs skills add ${owner}/${repo}`;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <Breadcrumb>
        <BreadcrumbList className="mb-6 flex-nowrap overflow-hidden font-mono text-xs">
          <BreadcrumbItem className="shrink-0">
            <BreadcrumbLink asChild>
              <Link href="/">skills</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbLink asChild>
              <Link
                className="truncate text-muted-foreground"
                href={`/skills/${encodeURIComponent(owner)}`}
              >
                {owner}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{repo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground text-pretty">
        {owner}/{repo}
      </h1>

      <div className="mb-6 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <PackageIcon className="size-4" />
          <span>
            {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUpIcon className="size-4" />
          <span>{compactFormatter.format(totalInstalls)} total installs</span>
        </div>
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          GitHub
        </a>
      </div>

      <section className="mb-8">
        <InstallCommand command={installCommand} />
      </section>

      <div className="border-t border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span>Skill</span>
          <span>Installs</span>
        </div>

        {skills.map((skill) => (
          <Link
            key={skill.id}
            href={`/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(skill.skillId)}`}
            className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-4 transition-colors hover:bg-muted/30"
          >
            <div className="min-w-0 flex-1 pr-4">
              <div className="font-semibold text-foreground">{skill.name}</div>
              {skill.description ? (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {skill.description}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 font-mono text-sm text-muted-foreground">
              {compactFormatter.format(skill.installs)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
