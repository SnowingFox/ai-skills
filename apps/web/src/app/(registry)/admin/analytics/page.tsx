'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Eye, TrendingUp, Users } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';

interface TrendRecord {
  date: string;
  pv: number;
  uv: number;
}

interface PathRecord {
  path: string;
  pv: number;
  uv: number;
}

interface SummaryData {
  todayPV: number;
  todayUV: number;
  totalPV: number;
  totalUV: number;
  period: string;
  trend: TrendRecord[];
  topPaths: PathRecord[];
}

type Period = '7' | '30' | '90';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
];

const chartConfig = {
  uv: { label: 'UV', color: 'var(--chart-1)' },
  pv: { label: 'PV', color: 'var(--chart-2)' },
  uvAvg7: { label: 'UV 7d Avg', color: 'var(--chart-4)' },
} satisfies ChartConfig;

function rolling7dAvg(
  data: TrendRecord[]
): (TrendRecord & { uvAvg7: number | null })[] {
  return data.map((item, i) => {
    if (i < 6) return { ...item, uvAvg7: null };
    const window = data.slice(i - 6, i + 1);
    const avg = Math.round(window.reduce((s, r) => s + r.uv, 0) / 7);
    return { ...item, uvAvg7: avg };
  });
}

interface StatCardProps {
  title: string;
  value: number | string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}

const StatCard = memo(function StatCard({
  title,
  value,
  description,
  icon: Icon,
  loading,
}: StatCardProps) {
  return (
    <Card className="justify-between h-36">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-sm font-medium">
          {title}
        </CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <div className="text-2xl font-bold tabular-nums">{value}</div>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
});

const UvPvChart = memo(function UvPvChart({
  data,
  loading,
}: {
  data: TrendRecord[];
  loading: boolean;
}) {
  const chartData = useMemo(() => rolling7dAvg(data), [data]);
  const peakUV = useMemo(
    () => (data.length ? Math.max(...data.map((d) => d.uv)) : 0),
    [data]
  );
  const avg7UV = useMemo(() => {
    const last7 = data.slice(-7);
    return last7.length
      ? Math.round(last7.reduce((s, r) => s + r.uv, 0) / last7.length)
      : 0;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>PV / UV Trend</CardTitle>
            <CardDescription>
              Daily visitors with 7-day rolling average
            </CardDescription>
          </div>
          {!loading && data.length > 0 && (
            <div className="text-right text-xs text-muted-foreground font-mono leading-relaxed">
              <div>
                7d avg UV{' '}
                <span className="text-foreground font-semibold">
                  {avg7UV.toLocaleString()}
                </span>
              </div>
              <div>
                Peak UV{' '}
                <span className="text-foreground font-semibold">
                  {peakUV.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="aspect-auto h-[300px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No UV/PV data yet. Events will appear once tracking begins.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[300px] w-full"
          >
            <ComposedChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 12, right: 12 }}
            >
              <defs>
                <linearGradient id="uvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-uv)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-uv)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-pv)"
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-pv)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                interval="preserveEnd"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="pv"
                stroke="var(--color-pv)"
                fillOpacity={1}
                fill="url(#pvGrad)"
                strokeWidth={1.5}
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="uv"
                stroke="var(--color-uv)"
                fillOpacity={1}
                fill="url(#uvGrad)"
                strokeWidth={2}
                animationDuration={500}
              />
              <Line
                type="monotone"
                dataKey="uvAvg7"
                stroke="var(--color-uvAvg7)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                connectNulls={false}
                animationDuration={500}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
});

export default function AnalyticsPage() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<Period>('30');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (period: Period) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      const res = await fetch(`/api/analytics/summary?days=${period}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SummaryData = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[analytics] fetch failed', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
    const interval = setInterval(() => fetchData(days), 60_000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [days, fetchData]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.period ? `${data.period}` : 'Site traffic overview'}
            </p>
          </div>
          <Tabs
            value={days}
            onValueChange={(v) => setDays(v as Period)}
            className="shrink-0"
          >
            <TabsList className="h-8">
              {PERIOD_OPTIONS.map((opt) => (
                <TabsTrigger
                  key={opt.value}
                  value={opt.value}
                  className="h-6 px-2.5 text-xs"
                >
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-3 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Today UV"
            value={data?.todayUV?.toLocaleString() ?? '0'}
            description="Unique visitors today"
            icon={Users}
            loading={loading}
          />
          <StatCard
            title="Today PV"
            value={data?.todayPV?.toLocaleString() ?? '0'}
            description="Page views today"
            icon={Eye}
            loading={loading}
          />
          <StatCard
            title="Total UV"
            value={data?.totalUV?.toLocaleString() ?? '0'}
            description={`In ${days}d period`}
            icon={TrendingUp}
            loading={loading}
          />
          <StatCard
            title="Total PV"
            value={data?.totalPV?.toLocaleString() ?? '0'}
            description={`In ${days}d period`}
            icon={Eye}
            loading={loading}
          />
        </div>

        <UvPvChart data={data?.trend ?? []} loading={loading} />

        <Card>
          <CardHeader>
            <CardTitle>Top Pages</CardTitle>
            <CardDescription>
              Most visited paths in the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={`path-skel-${i}`} className="h-9 w-full" />
                ))}
              </div>
            ) : !data?.topPaths?.length ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>No page view data yet.</p>
                <p className="mt-1 text-xs">
                  Events appear once users start browsing.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">#</th>
                      <th className="pb-2 pr-4 font-medium">Path</th>
                      <th className="pb-2 font-medium text-right">PV</th>
                      <th className="pb-2 pl-4 font-medium text-right">UV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPaths.map((r, idx) => (
                      <tr
                        key={r.path}
                        className={cn(
                          'border-b border-border/40 transition-colors hover:bg-muted/30'
                        )}
                      >
                        <td className="py-2 pr-4 tabular-nums text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="max-w-[400px] truncate py-2 pr-4 font-mono text-xs">
                          {r.path}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums">
                          {r.pv.toLocaleString()}
                        </td>
                        <td className="py-2 pl-4 text-right font-mono tabular-nums text-muted-foreground">
                          {r.uv.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
