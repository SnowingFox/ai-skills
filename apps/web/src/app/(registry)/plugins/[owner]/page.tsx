import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { listCursorPluginsByOwner } from '@/skills/get-cursor-upstream';
import { PackageIcon, PuzzleIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface PluginOwnerPageProps {
  params: Promise<{ owner: string }>;
}

export async function generateMetadata({
  params,
}: PluginOwnerPageProps): Promise<Metadata> {
  const { owner } = await params;
  return {
    title: `${owner} plugins | AI Skills`,
    description: `Cursor plugins published by ${owner}`,
  };
}

export default async function PluginOwnerPage({
  params,
}: PluginOwnerPageProps) {
  const { owner } = await params;
  const plugins = await listCursorPluginsByOwner(owner);
  if (plugins.length === 0) notFound();

  // Pick the most descriptive publisher info available. All plugins under one
  // GitHub owner usually share the same Cursor publisher, but we cope with the
  // case where they don't.
  const headerPublisher = plugins[0].publisher;
  const totalSkills = plugins.reduce((sum, p) => sum + p.skills.length, 0);

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
            <BreadcrumbLink asChild>
              <Link href="/?tab=plugins">plugins</Link>
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
          {headerPublisher.logoUrl ? (
            <AvatarImage
              src={headerPublisher.logoUrl}
              alt={`${headerPublisher.displayName ?? headerPublisher.name} avatar`}
            />
          ) : (
            <AvatarImage
              src={`https://github.com/${owner}.png`}
              alt={`${owner} avatar`}
            />
          )}
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
          <PuzzleIcon className="size-4" />
          <span>
            {plugins.length} {plugins.length === 1 ? 'plugin' : 'plugins'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <PackageIcon className="size-4" />
          <span>
            {totalSkills} {totalSkills === 1 ? 'skill' : 'skills'}
          </span>
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
          <span>Plugin</span>
          <span>Skills</span>
        </div>

        {plugins.map((plugin) => (
          <Link
            key={plugin.name}
            href={`/plugins/${encodeURIComponent(owner)}/${encodeURIComponent(plugin.name)}`}
            className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-4 transition-colors hover:bg-muted/30"
          >
            <div className="min-w-0 flex-1 pr-4">
              <div className="font-semibold text-foreground">
                {plugin.displayName}
              </div>
              {plugin.description ? (
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                  {plugin.description}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 font-mono text-sm text-muted-foreground">
              {plugin.skills.length}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
