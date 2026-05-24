import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CST_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayCST(): string {
  return new Date(Date.now() + CST_OFFSET_MS).toISOString().slice(0, 10);
}

interface DailyData {
  pv: number;
  visitors: string[];
  paths: Record<string, { pv: number; visitors: string[] }>;
}

const EMPTY_DAY: DailyData = { pv: 0, visitors: [], paths: {} };

interface TrackBody {
  path?: string;
  visitorId?: string;
  referrer?: string;
}

export async function POST(request: Request) {
  try {
    const body: TrackBody = await request.json();
    const path = body.path || '/';
    const visitorId =
      body.visitorId || request.headers.get('x-forwarded-for') || 'unknown';
    const day = todayCST();
    const key = `daily:${day}`;

    const { env } = await getCloudflareContext({ async: true });
    const kv = env.ANALYTICS_KV;

    const existing = await kv.get<DailyData>(key, 'json');
    const data: DailyData = existing ?? { ...EMPTY_DAY, paths: {} };

    data.pv += 1;
    if (!data.visitors.includes(visitorId)) {
      data.visitors.push(visitorId);
    }

    if (!data.paths[path]) {
      data.paths[path] = { pv: 0, visitors: [] };
    }
    data.paths[path].pv += 1;
    if (!data.paths[path].visitors.includes(visitorId)) {
      data.paths[path].visitors.push(visitorId);
    }

    await kv.put(key, JSON.stringify(data), {
      expirationTtl: 100 * 24 * 60 * 60,
    });

    return NextResponse.json({ tracked: true });
  } catch (error) {
    console.error('[analytics/track]', error);
    return NextResponse.json({ tracked: false }, { status: 500 });
  }
}
