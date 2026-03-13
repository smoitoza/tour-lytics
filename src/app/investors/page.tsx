'use client'

import Link from 'next/link'

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-[1100px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 no-underline text-white">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="10" r="2" fill="#2563eb" />
              <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Tour<span className="text-[#2563eb]">-Lytics</span>
            </span>
          </Link>
          <Link href="/" className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors no-underline flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-[140px] pb-16 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(37,99,235,0.12) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 max-w-[800px] mx-auto px-6 text-center">
          <span className="inline-block text-xs font-semibold text-[#2563eb] uppercase tracking-[0.15em] mb-6">
            Investor Overview
          </span>
          <h1 className="text-[clamp(2rem,1.5rem+3vw,3.5rem)] font-extrabold text-white tracking-tight mb-6 leading-[1.1]" style={{ fontFamily: 'var(--font-display)' }}>
            The CRE Intelligence Platform
          </h1>
          <p className="text-lg text-[#9ca3af] max-w-[600px] mx-auto leading-relaxed">
            Transforming how corporate real estate teams analyze markets, compare buildings, and make lease decisions.
          </p>
        </div>
      </section>

      {/* Content sections on dark bg */}
      <main className="max-w-[900px] mx-auto px-6 pb-24">

        {/* Problem section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: 'var(--font-display)' }}>
            The Problem
          </h2>
          <div className="bg-white/[0.04] backdrop-blur border border-white/[0.08] rounded-xl p-8">
            <blockquote className="text-lg text-[#e2e8f0] leading-relaxed mb-6 italic">
              &ldquo;Tell me the last time a broker has sent you a spreadsheet that matches what your CFO
              really wants to see...cash flow, straight-line P&L, GAAP format...it doesn&apos;t happen.
              Brokers only care about the pay day, they don&apos;t care about your financial reports.&rdquo;
            </blockquote>
            <p className="text-base text-[#94a3b8] leading-relaxed">
              Corporate real estate teams spend weeks manually converting broker spreadsheets into
              financial formats their leadership can use. Brokers provide deal-focused data.
              CFOs need GAAP-compliant financial projections. The gap costs companies time, money,
              and bad decisions.
            </p>
          </div>
        </section>

        {/* Solution section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            The Solution
          </h2>
          <p className="text-[#94a3b8] mb-8 text-lg leading-relaxed">
            Tour-Lytics transforms raw market data into the financial intelligence corporate
            real estate teams actually need. One platform that speaks both broker and CFO.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Market Intelligence', desc: 'Interactive maps with every building, availability, and survey data linked.', icon: '📍' },
              { title: 'GAAP Financials', desc: 'Cash flow, straight-line P&L, and all-in cost models generated instantly.', icon: '📊' },
              { title: 'Tour Management', desc: 'Score, rank, schedule, and coordinate tours with your team in one place.', icon: '📋' },
              { title: 'AI Analysis', desc: 'Natural language Q&A over your entire market data, financials, and tour notes.', icon: '🤖' },
            ].map((item) => (
              <div key={item.title} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-6 hover:border-[#2563eb]/30 transition-all">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>{item.title}</h3>
                <p className="text-sm text-[#94a3b8] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Traction */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Proof of Concept
          </h2>
          <p className="text-[#94a3b8] mb-8 text-lg leading-relaxed">
            Built and validated with a live Fortune 500 office search across 33 buildings and 2.8M+ sq ft
            in San Francisco. The platform generates complete financial models in under 5 minutes,
            replacing weeks of manual spreadsheet work.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '33', label: 'Buildings analyzed' },
              { value: '2.8M+', label: 'Sq ft mapped' },
              { value: '<5 min', label: 'To full financials' },
              { value: '100%', label: 'GAAP compliant' },
            ].map((s) => (
              <div key={s.label} className="text-center bg-white/[0.04] border border-white/[0.08] rounded-xl p-6">
                <div className="text-2xl font-bold text-[#2563eb]" style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
                <div className="text-xs text-[#6b7280] mt-2 uppercase tracking-wider font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Market */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Market Opportunity
          </h2>
          <p className="text-[#94a3b8] text-lg leading-relaxed">
            U.S. commercial real estate represents $20+ trillion in assets. Every corporate lease
            transaction involves the same broken workflow: broker data in, manual conversion, CFO-ready
            output. Tour-Lytics automates the entire pipeline. The initial wedge is mid-market and enterprise
            tenant representation, expanding to portfolio analytics, renewal management, and
            multi-market intelligence.
          </p>
        </section>

        {/* Contact CTA */}
        <section className="bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Interested?
          </h2>
          <p className="text-[#bfdbfe] mb-8">
            We&apos;re looking for investors who understand the enterprise real estate workflow.
          </p>
          <a
            href="mailto:samoitoza@gmail.com"
            className="inline-flex items-center gap-2 bg-white text-[#1e40af] px-8 py-3 rounded-lg font-semibold text-base hover:bg-[#f0f9ff] transition-all no-underline"
          >
            Get in Touch
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/[0.05]">
        <div className="max-w-[900px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#6b7280]">
          <span>&copy; 2026 Tour-Lytics. All rights reserved.</span>
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#9ca3af] transition-colors no-underline text-[#6b7280]"
          >
            Created with Perplexity Computer
          </a>
        </div>
      </footer>
    </div>
  )
}
