import axios from 'axios';
import {
  FullTextSource,
  Paper,
  PaperAccessInfo,
  PaperAccessType,
  PaperFullTextSections,
} from './types';
import { normalizeDoi } from './deduplicator';
import { downloadCorePdf } from './coreClient';

const MAX_PDF_BYTES = 18 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30000;

function nowIso(): string {
  return new Date().toISOString();
}

function isHttpUrl(value?: string | null): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function isPdfUrl(value?: string | null): value is string {
  if (!isHttpUrl(value)) return false;
  const clean = value.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf') || value.toLowerCase().includes('/pdf');
}

function arxivPdfUrl(paper: Paper): string | null {
  if (paper.source !== 'arxiv') return null;
  const candidate = paper.landingUrl || paper.url;
  if (!candidate) return null;
  const match = candidate.match(/arxiv\.org\/abs\/([^?#]+)/i);
  if (!match?.[1]) return null;
  return `https://arxiv.org/pdf/${match[1]}.pdf`;
}

function sourceForPaper(paper: Paper, pdfUrl?: string): FullTextSource | undefined {
  if (paper.fullTextSource) return paper.fullTextSource;
  if (paper.source === 'core') return 'core';
  if (paper.source === 'arxiv') return 'arxiv';
  if (paper.source === 'europepmc') return 'europepmc';
  if (pdfUrl && normalizeDoi(paper.doi)) return 'unpaywall';
  return undefined;
}

export function resolvePaperAccess(paper: Paper): PaperAccessInfo {
  if (paper.accessType === 'user_uploaded') {
    return {
      accessType: 'user_uploaded',
      pdfUrl: paper.pdfUrl,
      landingUrl: paper.landingUrl || paper.url || undefined,
      fullTextStatus: 'available',
      fullTextSource: 'user_upload',
      fullTextVerifiedAt: paper.fullTextVerifiedAt || nowIso(),
    };
  }

  if (paper.pdfUrl && isHttpUrl(paper.pdfUrl)) {
    return {
      accessType: paper.accessType === 'core_download' ? 'core_download' : 'open_pdf',
      pdfUrl: paper.pdfUrl,
      landingUrl: paper.landingUrl || paper.url || undefined,
      fullTextStatus: 'available',
      fullTextSource: sourceForPaper(paper, paper.pdfUrl),
      fullTextVerifiedAt: paper.fullTextVerifiedAt || nowIso(),
    };
  }

  const arxivPdf = arxivPdfUrl(paper);
  if (arxivPdf) {
    return {
      accessType: 'open_pdf',
      pdfUrl: arxivPdf,
      landingUrl: paper.landingUrl || paper.url || undefined,
      fullTextStatus: 'available',
      fullTextSource: 'arxiv',
      fullTextVerifiedAt: nowIso(),
    };
  }

  if (paper.source === 'core' && paper.coreId) {
    return {
      accessType: 'core_download',
      landingUrl: paper.landingUrl || paper.url || undefined,
      fullTextStatus: 'available',
      fullTextSource: 'core',
      fullTextVerifiedAt: paper.fullTextVerifiedAt || nowIso(),
    };
  }

  if (isPdfUrl(paper.url)) {
    return {
      accessType: paper.source === 'core' ? 'core_download' : 'open_pdf',
      pdfUrl: paper.url || undefined,
      landingUrl: paper.landingUrl || undefined,
      fullTextStatus: 'available',
      fullTextSource: sourceForPaper(paper, paper.url || undefined),
      fullTextVerifiedAt: paper.fullTextVerifiedAt || nowIso(),
    };
  }

  if (isHttpUrl(paper.url)) {
    return {
      accessType: 'open_landing',
      landingUrl: paper.url,
      fullTextStatus: 'unavailable',
    };
  }

  if (paper.abstract && paper.abstract.length > 20) {
    return {
      accessType: 'abstract_only',
      fullTextStatus: 'unavailable',
    };
  }

  return {
    accessType: 'unknown',
    fullTextStatus: 'unavailable',
  };
}

export function applyAccessInfo(paper: Paper): Paper {
  const access = resolvePaperAccess(paper);
  return {
    ...paper,
    accessType: access.accessType,
    pdfUrl: access.pdfUrl,
    landingUrl: access.landingUrl || paper.landingUrl || paper.url || undefined,
    fullTextStatus: access.fullTextStatus,
    fullTextSource: access.fullTextSource,
    fullTextVerifiedAt: access.fullTextVerifiedAt,
  };
}

export function accessLabel(accessType?: PaperAccessType): string {
  switch (accessType) {
    case 'open_pdf':
    case 'core_download':
    case 'user_uploaded':
      return 'Full text available';
    case 'open_landing':
      return 'Open link only';
    case 'abstract_only':
      return 'Abstract only';
    case 'paywalled':
      return 'Paywalled / unavailable';
    default:
      return 'Upload needed';
  }
}

export function canReadFullText(paper: Paper): boolean {
  const access = resolvePaperAccess(paper);
  return Boolean(
    access.fullTextStatus === 'available' &&
      (access.pdfUrl || (access.accessType === 'core_download' && paper.coreId))
  );
}

export async function fetchLegalPdf(paper: Paper): Promise<Buffer> {
  const access = resolvePaperAccess(paper);

  if (access.accessType === 'core_download' && !access.pdfUrl && paper.coreId) {
    const data = await downloadCorePdf(paper.coreId);
    if (!data) throw new Error('CORE PDF is unavailable for this record.');
    return Buffer.from(data);
  }

  if (!access.pdfUrl) {
    throw new Error('No legal open PDF URL is available for this paper.');
  }

  const response = await axios.get<ArrayBuffer>(access.pdfUrl, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxContentLength: MAX_PDF_BYTES,
    headers: {
      Accept: 'application/pdf,*/*',
    },
  });

  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  const buffer = Buffer.from(response.data);
  if (!contentType.includes('pdf') && buffer.subarray(0, 4).toString() !== '%PDF') {
    throw new Error('The available full-text link did not return a PDF.');
  }

  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error('PDF is too large for the current reader limit.');
  }

  return buffer;
}

function sectionSlice(text: string, startPattern: RegExp, endPatterns: RegExp[]) {
  const start = text.search(startPattern);
  if (start < 0) return undefined;
  const rest = text.slice(start);
  const endCandidates = endPatterns
    .map((pattern) => {
      const match = rest.slice(80).search(pattern);
      return match >= 0 ? match + 80 : -1;
    })
    .filter((index) => index > 0);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : 2200;
  return rest.slice(0, Math.min(end, 2600)).trim();
}

export function extractSections(text: string): PaperFullTextSections {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return {
    abstract: sectionSlice(normalized, /\babstract\b/i, [/\bintroduction\b/i]),
    introduction: sectionSlice(normalized, /\bintroduction\b/i, [/\bmethods?\b/i, /\bmethodology\b/i]),
    methods: sectionSlice(normalized, /\bmethods?\b|\bmethodology\b/i, [/\bresults?\b/i, /\bfindings?\b/i]),
    results: sectionSlice(normalized, /\bresults?\b|\bfindings?\b/i, [/\bdiscussion\b/i, /\bconclusion\b/i]),
    discussion: sectionSlice(normalized, /\bdiscussion\b|\bconclusion\b/i, [/\breferences\b/i]),
    limitations: sectionSlice(normalized, /\blimitations?\b/i, [/\bfuture\b/i, /\breferences\b/i]),
    futureWork: sectionSlice(normalized, /\bfuture work\b|\bfuture research\b/i, [/\breferences\b/i]),
    references: sectionSlice(normalized, /\breferences\b/i, []),
  };
}
