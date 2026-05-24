import { InstallCommand } from '@/components/skills/install-command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { constructMetadata } from '@/lib/metadata';
import { findCursorPlugin } from '@/skills/get-cursor-upstream';
import { ExternalLinkIcon, GithubIcon, PackageIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface PluginDetailPageProps {
  params: Promise<{ owner: string; name: string }>;
}

export async function generateMetadata({
  params,
}: PluginDetailPageProps): Promise<Metadata | undefined> {
  const { owner, name } = await params;
  const plugin = await findCursorPlugin(owner, name);
  if (!plugin) return undefined;
  return constructMetadata({
    title: `${plugin.displayName} by ${plugin.publisher.displayName ?? plugin.publisher.name}`,
    description: plugin.description || `Cursor plugin ${plugin.displayName}.`,
    locale: 'en',
    pathname: `/plugins/${owner}/${name}`,
  });
}

export default async function PluginDetailPage({
  params,
}: PluginDetailPageProps) {
  const { owner, name } = await params;
  const plugin = await findCursorPlugin(owner, name);
  if (!plugin) notFound();

  const installCommand = `npx ai-pkgs plugins add ${owner}/${plugin.repo}`;
  const avatarFallback = (
    plugin.publisher.displayName ??
    plugin.publisher.name ??
    plugin.name
  )
    .slice(0, 2)
    .toUpperCase();

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
          <BreadcrumbItem className="shrink-0">
            <BreadcrumbLink asChild>
              <Link href="/?tab=plugins">plugins</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbLink asChild>
              <Link
                className="truncate text-muted-foreground"
                href={`/plugins/${encodeURIComponent(owner)}`}
              >
                {owner}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{plugin.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex items-center gap-4">
        <Avatar className="size-14 border border-border">
          {plugin.publisher.logoUrl ? (
            <AvatarImage
              src={plugin.publisher.logoUrl}
              alt={`${plugin.publisher.displayName ?? plugin.publisher.name} avatar`}
            />
          ) : (
            <AvatarImage
              src={`https://github.com/${owner}.png`}
              alt={`${owner} avatar`}
            />
          )}
          <AvatarFallback className="font-mono text-xs uppercase">
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground text-pretty">
            {plugin.displayName}
          </h1>
          <p className="font-mono text-muted-foreground text-sm">
            @{plugin.publisher.name}
          </p>
        </div>
      </div>

      <section className="mb-8">
        <InstallCommand command={installCommand} />
      </section>

      {plugin.description ? (
        <p className="mb-10 max-w-3xl text-muted-foreground text-sm leading-6">
          {plugin.description}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 overflow-hidden lg:col-span-9">
          <section>
            <div className="flex items-center justify-between border-b border-border px-4 py-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              <span>Skill</span>
              <span>Source</span>
            </div>
            {plugin.skills.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                This plugin does not declare any skills.
              </div>
            ) : (
              plugin.skills.map((skill) => {
                const Wrapper = skill.sourceUrl ? 'a' : 'div';
                return (
                  <Wrapper
                    key={skill.name}
                    {...(skill.sourceUrl
                      ? {
                          href: skill.sourceUrl,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                        }
                      : {})}
                    className="group flex items-start justify-between gap-4 border-b border-border/50 px-4 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground transition-colors group-hover:text-primary">
                        {skill.name}
                      </div>
                      {skill.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {skill.description}
                        </p>
                      ) : null}
                    </div>
                    {skill.sourceUrl ? (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        SKILL.md
                      </span>
                    ) : null}
                  </Wrapper>
                );
              })
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Repository</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={plugin.repositoryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 break-all font-mono text-sm text-foreground underline-offset-4 hover:underline"
              >
                <GithubIcon className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  {owner}/{plugin.repo}
                </span>
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Package</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 font-mono text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Skills</span>
                  <span className="text-foreground">
                    {plugin.skills.length}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Publisher</span>
                  <span className="truncate text-foreground">
                    {plugin.publisher.displayName ?? plugin.publisher.name}
                  </span>
                </div>
                {plugin.publisher.websiteUrl ? (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Website</span>
                      <a
                        href={plugin.publisher.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-foreground underline-offset-4 hover:underline"
                      >
                        <ExternalLinkIcon className="inline size-3 mr-1" />
                        Link
                      </a>
                    </div>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
