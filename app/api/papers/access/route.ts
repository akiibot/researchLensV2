import { NextRequest, NextResponse } from 'next/server';
import { applyAccessInfo } from '@/lib/paperAccess';
import { Paper } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const papers: Paper[] = Array.isArray(body.papers)
      ? body.papers
      : body.paper
        ? [body.paper]
        : [];

    if (papers.length === 0) {
      return NextResponse.json(
        { error: 'At least one paper is required', code: 'MISSING_PAPER' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      papers: papers.map(applyAccessInfo),
    });
  } catch (error) {
    console.error('[papers/access] failed:', error);
    return NextResponse.json(
      { error: 'Failed to resolve paper access', code: 'ACCESS_RESOLUTION_ERROR' },
      { status: 500 }
    );
  }
}
