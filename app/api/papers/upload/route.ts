import { NextRequest, NextResponse } from 'next/server';
import { readUploadedPdf } from '@/lib/pdfReader';
import { enforceRateLimit } from '@/lib/apiGuards';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, 'papers-upload', 10, 60_000);
    if (limited) return limited;

    const formData = await request.formData();
    const file = formData.get('file');
    const paperId = formData.get('paperId');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'PDF file is required', code: 'MISSING_FILE' },
        { status: 400 }
      );
    }

    if (file.type && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported', code: 'UNSUPPORTED_FILE_TYPE' },
        { status: 400 }
      );
    }

    // Browsers/clients can omit or spoof file.type, so also check the PDF
    // magic bytes directly rather than relying on that header alone.
    const headerBytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const header = new TextDecoder().decode(headerBytes);
    if (!header.startsWith('%PDF-')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported', code: 'UNSUPPORTED_FILE_TYPE' },
        { status: 400 }
      );
    }

    const result = await readUploadedPdf(
      file,
      typeof paperId === 'string' && paperId ? paperId : undefined
    );

    return NextResponse.json(result, {
      status: result.status === 'available' ? 200 : 422,
    });
  } catch (error) {
    console.error('[papers/upload] failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process uploaded PDF',
        code: 'PAPER_UPLOAD_ERROR',
      },
      { status: 500 }
    );
  }
}
