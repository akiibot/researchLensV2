import { NextRequest, NextResponse } from 'next/server';
import { fetchLegalPdf, resolvePaperAccess } from '@/lib/paperAccess';
import { Paper } from '@/lib/types';

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

    const access = resolvePaperAccess(paper);
    if (access.fullTextStatus !== 'available') {
      return NextResponse.json(
        {
          error: 'No legal open PDF is available for this paper.',
          code: 'FULL_TEXT_UNAVAILABLE',
          access,
        },
        { status: 403 }
      );
    }

    const pdf = await fetchLegalPdf(paper);
    const filename = `${paper.title || 'paper'}`.replace(/[^\w\s.-]/g, '').slice(0, 90) || 'paper';

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[papers/download] failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to download paper',
        code: 'PAPER_DOWNLOAD_ERROR',
      },
      { status: 500 }
    );
  }
}
