import { Paper, PaperAccessType } from './types';

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

export function accessTone(accessType?: PaperAccessType): string {
  switch (accessType) {
    case 'open_pdf':
    case 'core_download':
    case 'user_uploaded':
      return 'border-status-success/35 bg-status-success-bg text-status-success';
    case 'open_landing':
      return 'border-accent-base/30 bg-accent-base/15 text-accent-text';
    case 'abstract_only':
      return 'border-status-warning/35 bg-status-warning-bg text-status-warning';
    case 'paywalled':
      return 'border-status-error/35 bg-status-error-bg text-status-error';
    default:
      return 'border-border-subtle bg-bg-secondary text-text-secondary';
  }
}

export function canReadPaper(paper: Paper): boolean {
  return (
    paper.fullTextStatus === 'available' ||
    paper.accessType === 'open_pdf' ||
    paper.accessType === 'core_download' ||
    paper.accessType === 'user_uploaded' ||
    Boolean(paper.pdfUrl)
  );
}

