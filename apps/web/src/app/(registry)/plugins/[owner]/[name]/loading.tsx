import { Skeleton } from '@/components/ui/skeleton';

export default function PluginDetailLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs">
        <Skeleton className="h-4 w-12" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-16" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-24" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="mb-6 flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <Skeleton className="mb-8 h-10 w-full max-w-md rounded-md" />

      <Skeleton className="mb-2 h-4 w-full max-w-2xl" />
      <Skeleton className="mb-10 h-4 w-3/4 max-w-xl" />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-9">
          <Skeleton className="mb-4 h-4 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`plugin-skill-${i}`}
              className="flex items-start justify-between gap-4 border-b border-border/50 px-4 py-4"
            >
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-2 h-3 w-full max-w-md" />
              </div>
              <Skeleton className="h-5 w-5 shrink-0" />
            </div>
          ))}
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          <div>
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div>
            <Skeleton className="mb-3 h-4 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}
