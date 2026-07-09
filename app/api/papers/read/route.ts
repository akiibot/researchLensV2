import { NextRequest, NextResponse } from 'next/server';
import { readPaperPdf } from '@/lib/pdfReader';
import { Paper } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const paper = body.paper as Paper | undefined;

    if (!paper?.id) {
      return NextResponse.json(
        { error: 'Paper is required', code: 'MISSING_PAPER' },
        { status: 400 }
      );
    }

    const result = await readPaperPdf(paper);
    const status = result.status === 'unavailable' ? 403 : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error('[papers/read] failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to read paper',
        code: 'PAPER_READ_ERROR',
      },
      { status: 500 }
    );
  }
}
