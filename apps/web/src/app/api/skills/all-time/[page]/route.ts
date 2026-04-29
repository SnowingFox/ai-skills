import { fetchAllTimeSkills } from '@/lib/skills-api';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{
    page: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { page } = await context.params;
  const pageNumber = Number.parseInt(page, 10);

  if (!Number.isSafeInteger(pageNumber) || pageNumber < 0) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }

  const data = await fetchAllTimeSkills(pageNumber);
  return NextResponse.json(data);
}
