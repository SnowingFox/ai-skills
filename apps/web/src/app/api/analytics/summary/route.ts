import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayCST(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().slice(0, 10);
}

function daysAgoCST(days: number): string {
  const d = new Date(Date.now() + CST_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

interface DailyData {
  pv: number;
  visitors: string[];
  paths: Record<string, { pv: number; visitors: string[] }>;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const days = Math.min(Number(url.searchParams.get('days')) || 30, 90);

    const { env } = await getCloudflareContext({ async: true });
    const kv = env.ANALYTICS_KV;

    const today = todayCST();
    const fromDate = daysAgoCST(days);
    const dates = dateRange(fromDate, today);

    const entries = await Promise.all(
      dates.map(async (date) => {
        const data = await kv.get<DailyData>(`daily:${date}`, 'json');
        return { date, data };
      })
    );

    const trend = entries.map(({ date, data }) => ({
      date,
      pv: data?.pv ?? 0,
      uv: data?.visitors?.length ?? 0,
    }));

    const todayEntry = entries.find((e) => e.date === today)?.data;
    const todayPV = todayEntry?.pv ?? 0;
    const todayUV = todayEntry?.visitors?.length ?? 0;
    const totalPV = trend.reduce((sum, r) => sum + r.pv, 0);

    const allVisitors = new Set<string>();
    for (const { data } of entries) {
      if (data?.visitors) {
        for (const v of data.visitors) allVisitors.add(v);
      }
    }
    const totalUV = allVisitors.size;

    const pathAgg: Record<string, { pv: number; visitors: Set<string> }> = {};
    for (const { data } of entries) {
      if (!data?.paths) continue;
      for (const [path, stats] of Object.entries(data.paths)) {
        if (!pathAgg[path]) {
          pathAgg[path] = { pv: 0, visitors: new Set() };
        }
        pathAgg[path].pv += stats.pv;
        for (const v of stats.visitors) pathAgg[path].visitors.add(v);
      }
    }

    const topPaths = Object.entries(pathAgg)
      .map(([path, stats]) => ({
        path,
        pv: stats.pv,
        uv: stats.visitors.size,
      }))
      .sort((a, b) => b.pv - a.pv)
      .slice(0, 50);

    return NextResponse.json({
      todayPV,
      todayUV,
      totalPV,
      totalUV,
      period: `${fromDate} ~ ${today}`,
      trend,
      topPaths,
    });
  } catch (error) {
    console.error('[analytics/summary]', error);
    return NextResponse.json(
      { error: 'Failed to load analytics' },
      { status: 500 }
    );
  }
}
