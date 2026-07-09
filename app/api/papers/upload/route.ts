import { NextRequest, NextResponse } from 'next/server';
import { readUploadedPdf } from '@/lib/pdfReader';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
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
