'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

/* ── SVG Logo ── */
function Logo({ className = '', size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-label="Tour-Lytics logo"
      className={className}
    >
      <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="10" r="2" fill="#2563eb" />
      <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Feature cards data ── */
const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: 'Interactive Market Map',
    description: 'Every building in your market, plotted with real-time availability data. Click any pin for full details, financials, and survey links.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    title: 'GAAP-Ready Financials',
    description: 'Cash flow, straight-line P&L, and OpEx rolled up the way your CFO wants to see them. Not the way your broker formats them.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    title: 'Smart Tour Book',
    description: 'Score, rank, and annotate every building you tour. Drag to reorder, add notes, schedule visits, and invite your team with one click.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: 'AI Lease Analyst',
    description: 'Ask anything about your buildings, financials, or market. The chatbot knows your entire shortlist and scores in real time.',
  },
]

/* ── How It Works ── */
const steps = [
  { num: '01', title: 'Upload Your Market', desc: 'Drop in a broker survey, CSV, or just tell us the market. We structure every building instantly.' },
  { num: '02', title: 'Analyze & Score', desc: 'Interactive map, GAAP financials, scoring criteria. All connected. All live.' },
  { num: '03', title: 'Tour & Decide', desc: 'Build your tour book, schedule visits, invite your team. Go from analysis to signed lease.' },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen">
      {/* ── NAV ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-navy-200'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 no-underline text-navy-900">
            <Logo size={32} />
            <span className="font-[var(--font-display)] font-bold text-lg tracking-tight">
              Tour<span className="text-accent">-Lytics</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors no-underline">Features</a>
            <a href="#how" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors no-underline">How It Works</a>
            <Link href="/investors" className="text-sm font-medium text-navy-600 hover:text-navy-900 transition-colors no-underline">Investors</Link>
            <Link
              href="/login"
              className="bg-accent text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-all hover:-translate-y-px no-underline"
            >
              Sign In
            </Link>
          </div>
          <Link
            href="/login"
            className="md:hidden bg-accent text-white px-4 py-2 rounded-lg font-semibold text-sm no-underline"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-[calc(80px+5rem)] pb-16 bg-gradient-to-b from-navy-900 to-navy-950 relative overflow-hidden">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(37,99,235,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-[1200px] mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/[0.08] border border-white/[0.12] px-4 py-1 rounded-full text-xs text-navy-300 uppercase tracking-wider font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Commercial Real Estate Intelligence
          </div>

          <h1 className="text-[clamp(2rem,1.2rem+2.5vw,3.5rem)] font-extrabold text-white tracking-tight mb-6 max-w-[900px] mx-auto leading-[1.1]">
            Your CFO wants <span className="text-accent">GAAP financials</span>.<br />
            Your broker sends spreadsheets.
          </h1>

          <p className="text-[clamp(1.125rem,1rem+0.75vw,1.5rem)] text-navy-400 max-w-[600px] mx-auto mb-10 leading-relaxed">
            Tour-Lytics bridges the gap between broker market data and the financial
            reporting your leadership team actually needs.
          </p>

          {/* CTAs */}
          <div className="flex gap-4 justify-center flex-wrap mb-16">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-all hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(37,99,235,0.3)] no-underline"
            >
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 bg-transparent text-navy-300 px-8 py-3 border border-white/15 rounded-lg font-medium text-sm hover:bg-white/[0.06] hover:text-white hover:border-white/25 transition-all no-underline"
            >
              See the Product
            </a>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-12 pt-10 border-t border-white/[0.08] flex-wrap">
            {[
              { value: '33', label: 'Buildings Analyzed' },
              { value: '2.8M+', label: 'Sq Ft Mapped' },
              { value: '<5 min', label: 'To Full Financials' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-[var(--font-display)] text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-navy-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT DEMO SCREENSHOT ── */}
      <section id="demo" className="py-20 bg-navy-50">
        <div className="max-w-[1200px] mx-auto px-6">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Live Product
          </span>
          <h2 className="text-[clamp(1.5rem,1.2rem+1.5vw,2.5rem)] font-bold text-navy-900 tracking-tight mb-3">
            See It In Action
          </h2>
          <p className="text-base text-navy-500 mb-10 max-w-[600px]">
            Interactive map with 33 buildings, full financial models, scoring, and an
            AI chatbot that understands your entire market.
          </p>

          {/* Browser frame */}
          <div className="rounded-2xl overflow-hidden shadow-xl border border-navy-200 bg-white">
            <div className="flex items-center gap-2 px-4 py-3 bg-navy-100 border-b border-navy-200">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="flex-1 ml-4 bg-white rounded-md px-3 py-1 text-xs text-navy-400 border border-navy-200">
                tour-lytics.com/project/sf-office-search
              </span>
            </div>
            {/* Map screenshot placeholder -- will show actual app screenshot */}
            <div className="relative bg-navy-50">
              <div className="aspect-[16/9] flex items-center justify-center bg-gradient-to-br from-navy-100 to-navy-50">
                <div className="text-center p-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-navy-800 mb-2">Interactive SF Market Map</h3>
                  <p className="text-sm text-navy-500 max-w-md mx-auto mb-4">
                    33 buildings with availability, pricing, and direct links to survey details.
                    Full financial models for every option.
                  </p>
                  <div className="flex gap-3 justify-center flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-navy-200 text-xs font-medium text-navy-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Map View
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-navy-200 text-xs font-medium text-navy-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent" /> Financials
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-navy-200 text-xs font-medium text-navy-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" /> Tour Book
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-navy-200 text-xs font-medium text-navy-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> AI Chat
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PAIN POINT QUOTE ── */}
      <section className="py-20 bg-white">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-6 text-accent/20">
            <path d="M10 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2l-2 4h2l2-4V8h-4zm8 0c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2l-2 4h2l2-4V8h-4z" fill="currentColor" />
          </svg>
          <blockquote className="text-[clamp(1.125rem,1rem+0.5vw,1.375rem)] font-medium text-navy-800 leading-relaxed mb-6">
            &ldquo;Tell me the last time a broker has sent you a spreadsheet that matches what your CFO
            really wants to see...cash flow, straight-line P&L, GAAP format...it doesn&apos;t happen.
            Brokers only care about the pay day, they don&apos;t care about your financial reports.&rdquo;
          </blockquote>
          <div className="text-sm text-navy-500">The problem Tour-Lytics solves</div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-navy-50">
        <div className="max-w-[1200px] mx-auto px-6">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Platform
          </span>
          <h2 className="text-[clamp(1.5rem,1.2rem+1.5vw,2.5rem)] font-bold text-navy-900 tracking-tight mb-12">
            Everything Your Team Needs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-xl p-8 border border-navy-200 hover:border-accent/30 hover:shadow-lg transition-all duration-200 group"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-5 group-hover:bg-accent group-hover:text-white transition-all duration-200">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-2">{f.title}</h3>
                <p className="text-sm text-navy-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Process
          </span>
          <h2 className="text-[clamp(1.5rem,1.2rem+1.5vw,2.5rem)] font-bold text-navy-900 tracking-tight mb-12">
            Three Steps to Better Decisions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                  <span className="text-xl font-bold text-accent">{s.num}</span>
                </div>
                <h3 className="text-lg font-bold text-navy-900 mb-3">{s.title}</h3>
                <p className="text-sm text-navy-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-gradient-to-b from-navy-900 to-navy-950 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37,99,235,0.1) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 max-w-[600px] mx-auto px-6 text-center">
          <h2 className="text-[clamp(1.5rem,1.2rem+1.5vw,2.5rem)] font-bold text-white tracking-tight mb-6">
            Ready to see your market differently?
          </h2>
          <p className="text-navy-400 mb-10">
            Join the corporate real estate teams replacing broker spreadsheets
            with real financial intelligence.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-accent text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-all hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(37,99,235,0.3)] no-underline"
          >
            Get Started
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 bg-navy-950 border-t border-white/[0.05]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size={24} className="text-navy-400" />
            <span className="text-sm text-navy-500">Tour-Lytics</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-navy-500">
            <Link href="/investors" className="hover:text-navy-300 transition-colors no-underline text-navy-500">Investors</Link>
            <span className="text-navy-700">|</span>
            <a
              href="https://www.perplexity.ai/computer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-navy-300 transition-colors no-underline text-navy-500"
            >
              Created with Perplexity Computer
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
