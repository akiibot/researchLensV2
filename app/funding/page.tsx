import Link from 'next/link';

const CONNECTORS = [
  {
    name: 'Grants.gov',
    href: 'https://www.grants.gov/search-grants',
    type: 'Government grants',
    purpose: 'Search US federal funding opportunities by keyword.',
  },
  {
    name: 'NIH RePORTER',
    href: 'https://reporter.nih.gov/',
    type: 'Funded project index',
    purpose: 'Find funded biomedical, behavioral, and public health precedents.',
  },
  {
    name: 'CORDIS',
    href: 'https://cordis.europa.eu/projects',
    type: 'EU project database',
    purpose: 'Study EU-funded research topics, abstracts, and consortium framing.',
  },
  {
    name: 'UKRI Gateway to Research',
    href: 'https://gtr.ukri.org/',
    type: 'Research council index',
    purpose: 'Browse UK-funded project records and fundable language.',
  },
  {
    name: 'World Bank Projects',
    href: 'https://projects.worldbank.org/',
    type: 'Development projects',
    purpose: 'Explore development-oriented project priorities and impact framing.',
  },
];

export default function FundingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
          Funding Fit
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary">
          Turn research ideas into fundable directions
        </h2>
        <p className="text-sm text-text-secondary mt-2 max-w-2xl">
          Use ResearchLens reports to identify funding angles, collaborator
          profiles, grant abstracts, specific aims, and relevant funding search
          routes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/" className="surface-card surface-card-hover p-5">
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
            Start analysis
          </p>
          <h3 className="text-lg font-semibold text-text-primary">
            Generate a Funding Fit section
          </h3>
          <p className="text-sm text-text-secondary mt-2">
            Run a student or faculty workflow and review the Grant / Funding Fit
            section in the report.
          </p>
        </Link>
        <Link href="/faculty" className="surface-card surface-card-hover p-5">
          <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
            Find collaborators
          </p>
          <h3 className="text-lg font-semibold text-text-primary">
            Strengthen the proposal team
          </h3>
          <p className="text-sm text-text-secondary mt-2">
            Browse researchers and shortlist collaborators who improve fundability.
          </p>
        </Link>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Useful funding search routes
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CONNECTORS.map((connector) => (
            <a
              key={connector.name}
              href={connector.href}
              target="_blank"
              rel="noopener noreferrer"
              className="surface-card surface-card-hover p-5"
            >
              <p className="text-xs uppercase tracking-wide text-accent-base font-semibold mb-2">
                {connector.type}
              </p>
              <h4 className="text-base font-semibold text-text-primary">
                {connector.name}
              </h4>
              <p className="text-sm text-text-secondary mt-2">
                {connector.purpose}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
