import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getSkillRepository } from '@/skills/get-skill-repository';
import type { RepoSummary } from '@/skills/skill-repository';
import { summariseByOwnerUpstream } from '@/skills/upstream-fallback';
import { FolderIcon, PackageIcon, TrendingUpIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 10800;

interface OwnerPageProps {
  params: Promise<{
    owner: string;
  }>;
}

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export async function generateMetadata({
  params,
}: OwnerPageProps): Promise<Metadata> {
  const { owner } = await params;
  return {
    title: `${owner} | AI Skills`,
    description: `Skills published by ${owner}`,
  };
}

export default async function OwnerPage({ params }: OwnerPageProps) {
  const { owner } = await params;
  let repos: RepoSummary[] = [];
  try {
    const repo = await getSkillRepository();
    repos = await repo.summariseByOwner(owner);
  } catch (error) {
    console.warn('[owner page] DB read failed', error);
  }

  if (repos.length === 0) {
    // Fallback to upstream skills.sh data so the page works before / during
    // the first sync.
    try {
      repos = await summariseByOwnerUpstream(owner);
    } catch (error) {
      console.warn('[owner page] upstream fallback failed', error);
    }
  }

  if (repos.length === 0) {
    notFound();
  }

  const totalSkills = repos.reduce((sum, r) => sum + r.skillCount, 0);
  const totalInstalls = repos.reduce((sum, r) => sum + r.totalInstalls, 0);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <Breadcrumb>
        <BreadcrumbList className="mb-6 font-mono text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">skills</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{owner}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex items-center gap-3">
        <Avatar className="size-10 border border-border">
          <AvatarImage
            src={`https://github.com/${owner}.png`}
            alt={`${owner} avatar`}
          />
          <AvatarFallback className="font-mono text-xs uppercase">
            {owner.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-pretty">
          {owner}
        </h1>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <FolderIcon className="size-4" />
          <span>{repos.length} sources</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PackageIcon className="size-4" />
          <span>
            {totalSkills} {totalSkills === 1 ? 'skill' : 'skills'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUpIcon className="size-4" />
          <span>{compactFormatter.format(totalInstalls)} total installs</span>
        </div>
        <a
          href={`https://github.com/${owner}`}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          GitHub
        </a>
      </div>

      <div className="border-t border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span>Source</span>
          <span>Installs</span>
        </div>

        {repos.map((entry) => {
          const preview = entry.skillNames.slice(0, 3).join(', ');
          const more = entry.skillNames.length - 3;
          return (
            <Link
              key={entry.repo}
              href={`/skills/${encodeURIComponent(owner)}/${encodeURIComponent(entry.repo)}`}
              className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-4 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground">
                  {entry.repo}
                </div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {entry.skillCount}{' '}
                  {entry.skillCount === 1 ? 'skill' : 'skills'}: {preview}
                  {more > 0 ? ` +${more} more` : ''}
                </div>
              </div>
              <div className="shrink-0 font-mono text-sm text-muted-foreground">
                {compactFormatter.format(entry.totalInstalls)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
