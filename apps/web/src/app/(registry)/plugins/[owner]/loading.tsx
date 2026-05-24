import { Skeleton } from '@/components/ui/skeleton';

export default function PluginOwnerLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs">
        <Skeleton className="h-4 w-12" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-16" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-9 w-48" />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>

      <div className="border-t border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>

        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`plugin-owner-${i}`}
            className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-4"
          >
            <div className="min-w-0 flex-1 pr-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-3 w-72" />
            </div>
            <Skeleton className="h-5 w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
