'use client'

import Link from 'next/link'

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-navy-200">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 no-underline text-navy-900">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="10" r="2" fill="#2563eb" />
              <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Tour<span className="text-accent">-Lytics</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-navy-600 hover:text-navy-900 no-underline">
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="pt-[calc(80px+3rem)] pb-24 max-w-[800px] mx-auto px-6">
        <span className="inline-block text-xs font-semibold text-accent uppercase tracking-wider mb-3">
          Investor Overview
        </span>
        <h1
          className="text-[clamp(2rem,1.2rem+2.5vw,3rem)] font-extrabold text-navy-900 tracking-tight mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          The CRE Intelligence Platform
        </h1>

        {/* Problem section */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-navy-900 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            The Problem
          </h2>
          <div className="bg-navy-50 rounded-xl p-6 border border-navy-100">
            <blockquote className="text-base text-navy-700 leading-relaxed mb-4">
              &ldquo;Tell me the last time a broker has sent you a spreadsheet that matches what your CFO
              really wants to see...cash flow, straight-line P&L, GAAP format...it doesn&apos;t happen.
              Brokers only care about the pay day, they don&apos;t care about your financial reports.&rdquo;
            </blockquote>
            <p className="text-sm text-navy-500">
              Corporate real estate teams spend weeks manually converting broker spreadsheets into
              financial formats their leadership can use. Brokers provide deal-focused data.
              CFOs need GAAP-compliant financial projections. The gap costs companies time, money,
              and bad decisions.
            </p>
          </div>
        </section>

        {/* Solution section */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-navy-900 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            The Solution
          </h2>
          <p className="text-navy-600 mb-6">
            Tour-Lytics transforms raw market data into the financial intelligence corporate
            real estate teams actually need. One platform that speaks both broker and CFO.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Market Intelligence', desc: 'Interactive maps with every building, availability, and survey data linked.' },
              { title: 'GAAP Financials', desc: 'Cash flow, straight-line P&L, and all-in cost models generated instantly.' },
              { title: 'Tour Management', desc: 'Score, rank, schedule, and coordinate tours with your team in one place.' },
              { title: 'AI Analysis', desc: 'Natural language Q&A over your entire market data, financials, and tour notes.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-lg p-5 border border-navy-200">
                <h3 className="text-sm font-bold text-navy-900 mb-1">{item.title}</h3>
                <p className="text-xs text-navy-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Traction */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-navy-900 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Proof of Concept
          </h2>
          <p className="text-navy-600 mb-6">
            Built and validated with a live Fortune 500 office search across 33 buildings and 2.8M+ sq ft
            in San Francisco. The platform generates complete financial models in under 5 minutes,
            replacing weeks of manual spreadsheet work.
          </p>
          <div className="flex gap-8 flex-wrap">
            {[
              { value: '33', label: 'Buildings analyzed' },
              { value: '2.8M+', label: 'Sq ft mapped' },
              { value: '<5 min', label: 'To full financials' },
              { value: '100%', label: 'GAAP compliant' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-accent" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
                <div className="text-xs text-navy-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Market */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-navy-900 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Market Opportunity
          </h2>
          <p className="text-navy-600">
            U.S. commercial real estate represents $20+ trillion in assets. Every corporate lease
            transaction involves the same broken workflow: broker data in, manual conversion, CFO-ready
            output. Tour-Lytics automates the entire pipeline. The initial wedge is mid-market and enterprise
            tenant representation, expanding to portfolio analytics, renewal management, and
            multi-market intelligence.
          </p>
        </section>

        {/* Contact */}
        <section className="bg-navy-900 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Interested?
          </h2>
          <p className="text-navy-400 text-sm mb-6">
            We&apos;re looking for investors who understand the enterprise real estate workflow.
          </p>
          <a
            href="mailto:samoitoza@gmail.com"
            className="inline-flex items-center gap-2 bg-accent text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-all no-underline"
          >
            Get in Touch
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-navy-100 text-center text-xs text-navy-400">
        <a
          href="https://www.perplexity.ai/computer"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-navy-500 transition-colors no-underline text-navy-400"
        >
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  )
}
