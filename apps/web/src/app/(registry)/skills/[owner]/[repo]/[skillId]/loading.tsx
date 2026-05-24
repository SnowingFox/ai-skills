import { Skeleton } from '@/components/ui/skeleton';

export default function SkillLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-6 flex items-center gap-2 font-mono text-xs">
        <Skeleton className="h-4 w-12" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-24" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-24" />
        <span className="text-muted-foreground">/</span>
        <Skeleton className="h-4 w-28" />
      </div>

      <Skeleton className="mb-2 h-10 w-72" />
      <Skeleton className="h-4 w-full max-w-xl" />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="min-w-0 overflow-hidden lg:col-span-9">
          <section className="my-10 flex flex-col gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full max-w-xl rounded-md" />
          </section>

          <section className="mb-8 flex flex-col gap-4">
            <Skeleton className="h-4 w-32" />
            <div className="rounded-lg border border-border bg-muted px-6 py-4">
              <Skeleton className="h-4 w-3/4" />
              <div className="mt-3 ml-5 flex flex-col gap-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[40vh] min-h-64 w-full rounded-md" />
          </section>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          <div>
            <Skeleton className="mb-3 h-4 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>

          <div>
            <Skeleton className="mb-3 h-4 w-24" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
