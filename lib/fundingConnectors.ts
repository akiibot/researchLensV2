/**
 * Single source of truth for external funding-connector URLs, shared by the
 * /funding page and the degraded-analysis fallback FundingFit in app/page.tsx
 * so the same connector's URL can't drift out of sync between the two.
 */
export interface FundingConnector {
  name: string;
  url: string;
  type: string;
  purpose: string;
}

export const FUNDING_CONNECTORS: FundingConnector[] = [
  {
    name: 'Grants.gov',
    url: 'https://www.grants.gov/search-grants',
    type: 'Government grants',
    purpose: 'Search US federal funding opportunities by keyword.',
  },
  {
    name: 'NIH RePORTER',
    url: 'https://reporter.nih.gov/',
    type: 'Funded project index',
    purpose: 'Find funded biomedical, behavioral, and public health precedents.',
  },
  {
    name: 'CORDIS',
    url: 'https://cordis.europa.eu/projects',
    type: 'EU project database',
    purpose: 'Study EU-funded research topics, abstracts, and consortium framing.',
  },
  {
    name: 'UKRI Gateway to Research',
    url: 'https://gtr.ukri.org/',
    type: 'Research council index',
    purpose: 'Browse UK-funded project records and fundable language.',
  },
  {
    name: 'World Bank Projects',
    url: 'https://projects.worldbank.org/',
    type: 'Development projects',
    purpose: 'Explore development-oriented project priorities and impact framing.',
  },
];

export function getFundingConnectorUrl(name: string): string {
  const found = FUNDING_CONNECTORS.find((c) => c.name === name);
  if (!found) throw new Error(`Unknown funding connector: ${name}`);
  return found.url;
}
