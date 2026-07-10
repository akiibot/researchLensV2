/**
 * @file Root Layout
 *
 * Provides the global layout shell for ResearchLens:
 * - Dark navy header with logo and tagline
 * - Geist font family (clean, modern sans-serif)
 * - Dark theme background
 * - SEO metadata
 *
 * @layout
 */

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ResearchLens — Find Your Research Gap',
  description:
    'AI-powered research gap finder for thesis students. Get evidence-backed pivots from real academic papers.',
  openGraph: {
    title: 'ResearchLens — Find Your Research Gap',
    description:
      'AI-powered research gap finder for thesis students. Get evidence-backed pivots from real academic papers.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-[family-name:var(--font-geist-sans)]">
        {/* Collapsed top bar */}
        <header className="app-topbar group sticky top-0 z-40 h-2 overflow-hidden border-b border-border-subtle bg-bg-primary/85 backdrop-blur-sm transition-[height] duration-300 hover:h-14 focus-within:h-14">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#493f82] text-2xl font-black leading-none text-white shadow-[0_0_24px_var(--shadow-accent)]">
                <span className="-mt-1 font-serif">r</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Research<span className="text-accent-base">Lens</span>
                </h1>
              </div>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/reports"
                className="text-xs text-text-tertiary hover:text-text-primary font-medium transition-colors"
              >
                Reports
              </Link>
              <Link
                href="/faculty"
                className="text-xs text-text-tertiary hover:text-text-primary font-medium transition-colors"
              >
                Faculty Directory
              </Link>
              <Link
                href="/funding"
                className="text-xs text-text-tertiary hover:text-text-primary font-medium transition-colors"
              >
                Funding
              </Link>
              <p className="hidden sm:block text-xs text-text-tertiary font-medium">
                Find the gap. Fill the gap. Skip the wasted months.
              </p>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-border-subtle py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-xs text-text-tertiary">
              ResearchLens searches multiple open scholarly, thesis, dissertation,
              and repository metadata sources to estimate novelty risk and identify
              research gaps. It does not claim 100% global coverage.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
