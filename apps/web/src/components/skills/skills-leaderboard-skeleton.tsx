import { Skeleton } from '@/components/ui/skeleton';

/**
 * Suspense fallback for the leaderboard. Mirrors the shape of
 * {@link SkillsLeaderboard} so the layout does not shift on hydration.
 */
export function SkillsLeaderboardSkeleton() {
  return (
    <section className="flex flex-col gap-8 pb-24 md:pb-32">
      <div className="flex items-center gap-6 border-input border-b pb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="relative">
        <Skeleton className="h-12 w-full" />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-4 border-b border-border/50 pb-3 font-mono text-muted-foreground text-xs uppercase">
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`leaderboard-skeleton-${i}`}
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
    </section>
  );
}
