import { PDFParse } from 'pdf-parse';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { Paper, PaperFullTextResult } from './types';
import { extractSections, fetchLegalPdf, resolvePaperAccess } from './paperAccess';

const MAX_EXTRACTED_TEXT_CHARS = 120000;
let workerConfigured = false;

function normalizeExtractedText(text: string): string {
  return text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function ensurePdfWorker() {
  if (workerConfigured) return;
  const workerPath = path.join(
    process.cwd(),
    'node_modules',
    'pdf-parse',
    'dist',
    'pdf-parse',
    'esm',
    'pdf.worker.mjs'
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerConfigured = true;
}

export async function readPaperPdf(paper: Paper): Promise<PaperFullTextResult> {
  const access = resolvePaperAccess(paper);

  if (access.fullTextStatus !== 'available') {
    return {
      paperId: paper.id,
      status: 'unavailable',
      access,
      message: 'ResearchLens does not have legal full-text access for this paper yet.',
    };
  }

  try {
    const buffer = await fetchLegalPdf(paper);
    ensurePdfWorker();
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = normalizeExtractedText(parsed.text || '');

    if (text.length < 400) {
      return {
        paperId: paper.id,
        status: 'failed',
        access: { ...access, fullTextStatus: 'failed' },
        title: paper.title,
        pageCount: parsed.total,
        message: 'PDF text extraction produced too little text. This may be a scanned PDF that needs OCR.',
      };
    }

    const trimmedText = text.slice(0, MAX_EXTRACTED_TEXT_CHARS);

    return {
      paperId: paper.id,
      status: 'available',
      access,
      title: paper.title,
      text: trimmedText,
      sections: extractSections(trimmedText),
      pageCount: parsed.total,
    };
  } catch (error) {
    return {
      paperId: paper.id,
      status: 'failed',
      access: { ...access, fullTextStatus: 'failed' },
      title: paper.title,
      message: error instanceof Error ? error.message : 'PDF extraction failed.',
    };
  }
}

export async function readUploadedPdf(
  file: File,
  paperId = `uploaded:${crypto.randomUUID()}`
): Promise<PaperFullTextResult> {
  if (file.size > 18 * 1024 * 1024) {
    return {
      paperId,
      status: 'failed',
      access: {
        accessType: 'user_uploaded',
        fullTextStatus: 'failed',
        fullTextSource: 'user_upload',
      },
      message: 'Uploaded PDF is too large for the current reader limit.',
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    ensurePdfWorker();
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const text = normalizeExtractedText(parsed.text || '');

    if (text.length < 400) {
      return {
        paperId,
        status: 'failed',
        access: {
          accessType: 'user_uploaded',
          fullTextStatus: 'failed',
          fullTextSource: 'user_upload',
          fullTextVerifiedAt: new Date().toISOString(),
        },
        title: file.name.replace(/\.pdf$/i, ''),
        pageCount: parsed.total,
        message: 'Uploaded PDF appears scanned or text extraction failed. OCR is not available in V1.',
      };
    }

    const trimmedText = text.slice(0, MAX_EXTRACTED_TEXT_CHARS);

    return {
      paperId,
      status: 'available',
      access: {
        accessType: 'user_uploaded',
        fullTextStatus: 'available',
        fullTextSource: 'user_upload',
        fullTextVerifiedAt: new Date().toISOString(),
      },
      title: file.name.replace(/\.pdf$/i, ''),
      text: trimmedText,
      sections: extractSections(trimmedText),
      pageCount: parsed.total,
    };
  } catch (error) {
    return {
      paperId,
      status: 'failed',
      access: {
        accessType: 'user_uploaded',
        fullTextStatus: 'failed',
        fullTextSource: 'user_upload',
      },
      message: error instanceof Error ? error.message : 'Uploaded PDF extraction failed.',
    };
  }
}
