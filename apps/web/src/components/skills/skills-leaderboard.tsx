'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import type { SkillEntry, SkillsApiResponse } from '@/lib/skills-api';
import type { CursorPlugin } from '@/skills/cursor-upstream';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { PuzzleIcon, SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface SkillsLeaderboardProps {
  initialData: SkillsApiResponse;
  plugins: CursorPlugin[];
  defaultTab?: Tab;
}

type Tab = 'skills' | 'plugins';

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
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push(skill);
    }
  }
  return skills;
}

async function fetchSkillsPage(page: number) {
  const response = await fetch(`/api/skills/all-time/${page}`);
  if (!response.ok) throw new Error('Failed to load skills');
  return (await response.json()) as SkillsApiResponse;
}

async function fetchSearch(q: string) {
  const response = await fetch(
    `/api/skills/search?q=${encodeURIComponent(q)}&limit=100`
  );
  if (!response.ok) throw new Error('Search failed');
  return (await response.json()) as SkillsApiResponse;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function filterPlugins(plugins: CursorPlugin[], query: string): CursorPlugin[] {
  if (!query) return plugins;
  const lower = query.toLowerCase();
  return plugins.filter((plugin) => {
    return (
      plugin.name.toLowerCase().includes(lower) ||
      plugin.displayName.toLowerCase().includes(lower) ||
      plugin.description.toLowerCase().includes(lower) ||
      plugin.publisher.name.toLowerCase().includes(lower) ||
      (plugin.publisher.displayName?.toLowerCase().includes(lower) ?? false)
    );
  });
}

export function SkillsLeaderboard({
  initialData,
  plugins,
  defaultTab,
}: SkillsLeaderboardProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<Tab>(defaultTab ?? 'skills');

  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput.trim(), 300);
  const isSearching = debouncedQuery.length > 0;

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
    staleTime: 5 * 60 * 1000,
    enabled: tab === 'skills' && !isSearching,
  });

  const skillsSearchQuery = useQuery({
    queryKey: ['skills', 'search', debouncedQuery],
    queryFn: () => fetchSearch(debouncedQuery),
    staleTime: 60 * 1000,
    enabled: tab === 'skills' && isSearching,
  });

  const leaderboardPages = skillsQuery.data?.pages ?? [initialData];
  const leaderboardSkills = useMemo(
    () => flattenSkills(leaderboardPages),
    [leaderboardPages]
  );
  const skillsTotal = leaderboardPages.at(-1)?.total ?? initialData.total;
  const searchSkills = skillsSearchQuery.data?.skills ?? [];
  const visibleSkills = isSearching ? searchSkills : leaderboardSkills;

  const visiblePlugins = useMemo(
    () => filterPlugins(plugins, debouncedQuery),
    [plugins, debouncedQuery]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      !sentinel ||
      tab !== 'skills' ||
      isSearching ||
      !skillsQuery.hasNextPage
    ) {
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
  }, [skillsQuery, isSearching, tab]);

  const searchPlaceholder =
    tab === 'plugins' ? 'Search plugins...' : 'Search skills...';

  return (
    <section className="flex flex-col gap-8 pb-24 md:pb-32">
      <div className="flex items-center gap-6 border-input border-b font-mono text-xs uppercase">
        <button
          type="button"
          onClick={() => setTab('skills')}
          className={`-mb-px border-b-2 px-1 pb-3 transition-colors ${
            tab === 'skills'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Skills ({totalFormatter.format(skillsTotal)})
        </button>
        <button
          type="button"
          onClick={() => setTab('plugins')}
          className={`-mb-px border-b-2 px-1 pb-3 transition-colors ${
            tab === 'plugins'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Plugins ({totalFormatter.format(plugins.length)})
        </button>
      </div>

      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="h-12 rounded-none border-0 border-input border-b bg-transparent pr-10 pl-8 font-mono text-base focus-visible:border-foreground focus-visible:ring-0 md:text-sm"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground text-xs sm:inline-flex">
          /
        </kbd>
      </div>

      {tab === 'skills' ? (
        isSearching &&
        skillsSearchQuery.isFetching &&
        searchSkills.length === 0 ? (
          <TableSkeleton />
        ) : (
          <SkillsTable
            skills={visibleSkills}
            isSearching={isSearching}
            isSearchFetching={skillsSearchQuery.isFetching}
            debouncedQuery={debouncedQuery}
          />
        )
      ) : (
        <PluginsTable
          plugins={visiblePlugins}
          isSearching={isSearching}
          debouncedQuery={debouncedQuery}
        />
      )}

      {tab === 'skills' && !isSearching ? (
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
          {!skillsQuery.hasNextPage && leaderboardSkills.length > 0 ? (
            <p className="text-muted-foreground text-sm">All skills loaded</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface SkillsTableProps {
  skills: SkillEntry[];
  isSearching: boolean;
  isSearchFetching: boolean;
  debouncedQuery: string;
}

function SkillsTable({
  skills,
  isSearching,
  isSearchFetching,
  debouncedQuery,
}: SkillsTableProps) {
  return (
    <>
      {isSearching ? (
        <p className="font-mono text-muted-foreground text-xs uppercase">
          Search results for &ldquo;{debouncedQuery}&rdquo;
          {isSearchFetching ? ' …' : ''}
        </p>
      ) : null}
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
                      <Link
                        href={skillHref}
                        className="truncate font-medium transition-colors hover:text-foreground hover:underline"
                      >
                        {skill.name}
                      </Link>
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
                {isSearching && isSearchFetching
                  ? 'Searching…'
                  : isSearching
                    ? 'No matching skills'
                    : 'No skills available'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

interface PluginsTableProps {
  plugins: CursorPlugin[];
  isSearching: boolean;
  debouncedQuery: string;
}

function PluginsTable({
  plugins,
  isSearching,
  debouncedQuery,
}: PluginsTableProps) {
  return (
    <>
      {isSearching ? (
        <p className="font-mono text-muted-foreground text-xs uppercase">
          Search results for &ldquo;{debouncedQuery}&rdquo;
        </p>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 font-mono text-muted-foreground text-xs uppercase">
              #
            </TableHead>
            <TableHead className="font-mono text-muted-foreground text-xs uppercase">
              Plugin
            </TableHead>
            <TableHead className="hidden font-mono text-muted-foreground text-xs uppercase md:table-cell">
              Source
            </TableHead>
            <TableHead className="text-right font-mono text-muted-foreground text-xs uppercase">
              Skills
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plugins.length > 0 ? (
            plugins.map((plugin, index) => {
              const href = `/plugins/${encodeURIComponent(plugin.owner)}/${encodeURIComponent(plugin.name)}`;
              const avatarFallback = plugin.publisher.name
                .slice(0, 2)
                .toUpperCase();
              return (
                <TableRow key={`${plugin.owner}/${plugin.name}`}>
                  <TableCell className="w-12 py-3 font-mono text-muted-foreground text-sm">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-3">
                    <Link href={href} className="group flex items-center gap-3">
                      <Avatar className="size-9 shrink-0 border border-border">
                        {plugin.publisher.logoUrl ? (
                          <AvatarImage
                            src={plugin.publisher.logoUrl}
                            alt={`${plugin.publisher.name} avatar`}
                          />
                        ) : (
                          <AvatarImage
                            src={`https://github.com/${plugin.owner}.png`}
                            alt={`${plugin.owner} avatar`}
                          />
                        )}
                        <AvatarFallback className="font-mono text-xs uppercase">
                          {avatarFallback}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium transition-colors group-hover:text-foreground group-hover:underline">
                          {plugin.displayName}
                        </div>
                        <div className="truncate font-mono text-muted-foreground text-xs">
                          @{plugin.publisher.name}
                        </div>
                        {plugin.description ? (
                          <div className="mt-1 line-clamp-1 text-muted-foreground text-xs md:hidden">
                            {plugin.description}
                          </div>
                        ) : null}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-md py-3 align-middle text-muted-foreground text-xs md:table-cell">
                    <span className="line-clamp-1">{plugin.description}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <PuzzleIcon className="size-3.5 text-muted-foreground" />
                      {plugin.skills.length}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                {isSearching ? 'No matching plugins' : 'No plugins available'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={`table-skel-${i}`}
          className="flex items-center gap-4 border-b border-border/30 py-3"
        >
          <Skeleton className="h-4 w-4" />
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="ml-auto h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
