'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocaleLink } from '@/i18n/navigation';
import type { SkillEntry, SkillsApiResponse } from '@/lib/skills-api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

interface SkillsLeaderboardProps {
  initialData: SkillsApiResponse;
}

const totalFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function flattenSkills(pages: SkillsApiResponse[]) {
  const seen = new Set<string>();
  const skills: SkillEntry[] = [];

  for (const page of pages) {
    for (const skill of page.skills) {
      const key = `${skill.source}/${skill.skillId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      skills.push(skill);
    }
  }

  return skills;
}

async function fetchSkillsPage(page: number) {
  const response = await fetch(`/api/skills/all-time/${page}`);
  if (!response.ok) {
    throw new Error('Failed to load skills');
  }
  return (await response.json()) as SkillsApiResponse;
}

export function SkillsLeaderboard({ initialData }: SkillsLeaderboardProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const skillsQuery = useInfiniteQuery({
    queryKey: ['skills', 'all-time'],
    queryFn: ({ pageParam }) => fetchSkillsPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialData: {
      pages: [initialData],
      pageParams: [initialData.page],
    },
  });

  const pages = skillsQuery.data?.pages ?? [initialData];
  const skills = useMemo(() => flattenSkills(pages), [pages]);
  const total = pages.at(-1)?.total ?? initialData.total;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !skillsQuery.hasNextPage) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !skillsQuery.isFetchingNextPage) {
          skillsQuery.fetchNextPage();
        }
      },
      { rootMargin: '480px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [skillsQuery]);

  return (
    <section className="flex flex-col gap-8 pb-24 md:pb-32">
      <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-foreground">
        Skills Leaderboard
      </h2>

      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search skills"
          placeholder="Search skills..."
          className="h-12 rounded-none border-0 border-input border-b bg-transparent pr-10 pl-8 font-mono text-base focus-visible:border-foreground focus-visible:ring-0 md:text-sm"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground text-xs sm:inline-flex">
          /
        </kbd>
      </div>

      <Tabs defaultValue="all-time">
        <TabsList variant="line" className="-mb-px w-full justify-start">
          <TabsTrigger value="all-time">
            All Time ({totalFormatter.format(total)})
          </TabsTrigger>
          <TabsTrigger value="trending">Trending (24h)</TabsTrigger>
          <TabsTrigger value="hot">Hot</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 font-mono text-muted-foreground text-xs uppercase">
              #
            </TableHead>
            <TableHead className="font-mono text-muted-foreground text-xs uppercase">
              Skill
            </TableHead>
            <TableHead className="text-right font-mono text-muted-foreground text-xs uppercase">
              Installs
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.length > 0 ? (
            skills.map((skill, index) => {
              const skillHref = `/skills/${skill.source}/${skill.skillId}`;

              return (
                <TableRow key={`${skill.source}/${skill.skillId}`}>
                  <TableCell className="w-12 py-3 font-mono text-muted-foreground text-sm">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                      <LocaleLink
                        href={skillHref}
                        className="truncate font-medium transition-colors hover:text-foreground hover:underline"
                      >
                        {skill.name}
                      </LocaleLink>
                      <span className="truncate font-mono text-muted-foreground text-xs sm:text-sm">
                        {skill.source}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-sm">
                    {compactFormatter.format(skill.installs)}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={3}
                className="h-24 text-center text-muted-foreground"
              >
                No skills available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div
        ref={sentinelRef}
        className="flex min-h-12 items-center justify-center"
      >
        {skillsQuery.isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            Loading more skills...
          </div>
        ) : null}
        {skillsQuery.isError ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              Failed to load more skills
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => skillsQuery.fetchNextPage()}
            >
              Retry
            </Button>
          </div>
        ) : null}
        {!skillsQuery.hasNextPage && skills.length > 0 ? (
          <p className="text-muted-foreground text-sm">All skills loaded</p>
        ) : null}
      </div>
    </section>
  );
}
