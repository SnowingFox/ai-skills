import { InstallCommand } from '@/components/skills/install-command';
import { SkillMarkdown } from '@/components/skills/skill-markdown';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import { constructMetadata } from '@/lib/metadata';
import { getSkillDetail } from '@/lib/skills';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { cache } from 'react';

interface SkillDetailPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    skillId: string;
  }>;
}

const getCachedSkillDetail = cache(getSkillDetail);

function formatHash(hash: string | null) {
  return hash ? hash.slice(0, 8) : 'Unknown';
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-4 border-b border-border pb-4 font-mono text-sm font-medium text-foreground uppercase">
      {children}
    </div>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-background py-6">
      <h2 className="mb-2 font-mono text-sm font-medium text-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export async function generateMetadata({
  params,
}: SkillDetailPageProps): Promise<Metadata | undefined> {
  const { owner, repo, skillId } = await params;
  const detail = await getCachedSkillDetail({ owner, repo, skillId });

  if (!detail) {
    return undefined;
  }

  return constructMetadata({
    title: `${detail.name} by ${detail.source}`,
    description: detail.description || `Read ${detail.name} on Skills.`,
    locale: 'en',
    pathname: `/skills/${owner}/${repo}/${skillId}`,
  });
}

export default async function SkillDetailPage({
  params,
}: SkillDetailPageProps) {
  const { owner, repo, skillId } = await params;
  const detail = await getCachedSkillDetail({ owner, repo, skillId });

  if (!detail) {
    notFound();
  }

  const summaryItems =
    detail.summaryItems.length > 0
      ? detail.summaryItems
      : detail.description
        ? [detail.description]
        : [];

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <main>
        <Breadcrumb>
          <BreadcrumbList className="mb-6 flex-nowrap overflow-hidden font-mono text-xs">
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink asChild>
                <Link href="/">skills</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <span className="truncate text-muted-foreground">{owner}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <span className="truncate text-muted-foreground">{repo}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">{skillId}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="mb-2 text-4xl font-semibold tracking-tight text-foreground text-pretty">
          {detail.name}
        </h1>
        <p className="max-w-2xl text-muted-foreground text-sm leading-6">
          {detail.description || `Skill package from ${detail.source}.`}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 overflow-hidden lg:col-span-9">
            <section className="my-10 flex flex-col gap-2">
              <SectionLabel>Installation</SectionLabel>
              <InstallCommand command={detail.installCommand} />
            </section>

            <section className="mb-8">
              <SectionLabel>Summary</SectionLabel>
              <div className="rounded-lg border border-border bg-muted px-6 py-4">
                <p className="font-medium text-foreground text-sm">
                  {detail.description || detail.title}
                </p>
                {summaryItems.length > 0 ? (
                  <ul className="mt-3 ml-5 flex list-disc flex-col gap-1 text-muted-foreground text-sm">
                    {summaryItems.map((item) => (
                      <li key={item} className="leading-6">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>

            <section className="bg-background">
              <SectionLabel>SKILL.md</SectionLabel>
              <div className="flex flex-col gap-5">
                <SkillMarkdown content={detail.markdownContent} />
              </div>
            </section>
          </div>

          <aside className="lg:col-span-3">
            <SidebarSection title="Repository">
              <div className="flex flex-col gap-2">
                <a
                  href={detail.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-foreground text-sm underline-offset-4 hover:underline"
                >
                  {detail.source}
                </a>
              </div>
            </SidebarSection>

            <SidebarSection title="Package">
              <div className="flex flex-col gap-3 font-mono text-sm">
                <div className="flex items-center justify-between gap-4 text-foreground">
                  <span className="text-muted-foreground">Files</span>
                  <span>{detail.fileCount}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4 text-foreground">
                  <span className="text-muted-foreground">Hash</span>
                  <span>{formatHash(detail.hash)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4 text-foreground">
                  <span className="text-muted-foreground">Skill ID</span>
                  <span className="truncate">{detail.skillId}</span>
                </div>
                {detail.license ? (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-4 text-foreground">
                      <span className="text-muted-foreground">License</span>
                      <Badge variant="secondary">{detail.license}</Badge>
                    </div>
                  </>
                ) : null}
              </div>
            </SidebarSection>
          </aside>
        </div>
      </main>
    </div>
  );
}
