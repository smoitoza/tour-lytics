'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

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

/* ── Animated counter ── */
function Counter({ end, prefix = '', suffix = '' }: { end: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1200
          const start = performance.now()
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * end))
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end])

  return (
    <div ref={ref} className="text-[clamp(2rem,1.5rem+2vw,3.5rem)] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  )
}

/* ── Feature cards data ── */
const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    title: 'Any Survey Format',
    description: 'Upload a broker survey PDF, CSV, or spreadsheet. Our engine parses every building, deal term, and floor plan automatically.',
    badge: 'AI-Powered',
    badgeColor: '#2563eb',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    title: 'Interactive Market Maps',
    description: 'Every building plotted with real-time availability data. Click any pin for full details, financials, and direct links to survey pages.',
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
    description: 'Score, rank, and annotate every building you tour. Drag to reorder, add notes and photos, schedule visits, and invite your team.',
    badge: 'New',
    badgeColor: '#0ea5e9',
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
    badge: 'Core Feature',
    badgeColor: '#2563eb',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    title: 'AI Lease Analyst',
    description: 'Ask anything about your buildings, financials, or market. The chatbot knows your entire shortlist and scores in real time.',
    badge: 'AI-Powered',
    badgeColor: '#2563eb',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: 'Team Projects',
    description: 'Invite your entire deal team. Everyone sees the same map, scores, and financials. No more email chains with outdated attachments.',
  },
]

/* ── How It Works ── */
const steps = [
  {
    num: '01',
    title: 'Upload Your Market',
    desc: 'Drop in a broker survey PDF, CSV, or just tell us the market. We parse and structure every building, every deal term, every floor plan.',
  },
  {
    num: '02',
    title: 'Analyze & Score',
    desc: 'Interactive map, GAAP financials, weighted scoring criteria. All connected, all live. Compare buildings side by side in seconds.',
  },
  {
    num: '03',
    title: 'Tour & Decide',
    desc: 'Build your tour book, schedule visits, invite your team. Go from broker survey to signed lease with full financial visibility.',
  },
]

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* ── NAV ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0f172a]/95 backdrop-blur-md shadow-lg border-b border-white/[0.06]'
            : 'bg-transparent'
        }`}
      >
        <div className="py-4 flex items-center justify-between" style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <Link href="/" className="flex items-center gap-3 no-underline text-white">
            <Logo size={32} className="text-white" />
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Tour<span className="text-[#2563eb]">-Lytics</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#demo" className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors no-underline">Map Demo</a>
            <a href="#problem" className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors no-underline">The Problem</a>
            <a href="#features" className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors no-underline">Features</a>
            <a href="#how" className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors no-underline">How It Works</a>
            <Link href="/investors" className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors no-underline">Investors</Link>
            <Link
              href="/login"
              className="bg-[#2563eb] text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#1d4ed8] transition-all hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] no-underline"
            >
              Sign In
            </Link>
          </div>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white bg-transparent border-none cursor-pointer p-2"
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0f172a]/98 backdrop-blur-lg border-t border-white/[0.06] px-6 py-6 space-y-4">
            <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="block text-base text-[#9ca3af] hover:text-white no-underline">Map Demo</a>
            <a href="#problem" onClick={() => setMobileMenuOpen(false)} className="block text-base text-[#9ca3af] hover:text-white no-underline">The Problem</a>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-base text-[#9ca3af] hover:text-white no-underline">Features</a>
            <a href="#how" onClick={() => setMobileMenuOpen(false)} className="block text-base text-[#9ca3af] hover:text-white no-underline">How It Works</a>
            <Link href="/investors" className="block text-base text-[#9ca3af] hover:text-white no-underline">Investors</Link>
            <Link href="/login" className="block bg-[#2563eb] text-white px-6 py-3 rounded-lg font-semibold text-center text-sm no-underline mt-4">Sign In</Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="pt-[180px] pb-24 bg-[#0f172a] relative overflow-hidden">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(37,99,235,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 text-center" style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] px-5 py-2 rounded-full text-xs text-[#9ca3af] uppercase tracking-[0.15em] font-medium mb-12">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Now in Private Beta
          </div>

          <h1 className="text-[clamp(2.5rem,1.5rem+4vw,4.5rem)] font-extrabold text-white tracking-tight mb-10 leading-[1.1]" style={{ fontFamily: 'var(--font-display)' }}>
            Turn static surveys into{' '}
            <span className="bg-gradient-to-r from-[#2563eb] to-[#60a5fa] bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 20px rgba(37,99,235,0.3))' }}>
              actionable intelligence
            </span>
          </h1>

          <p className="text-[clamp(1.125rem,1rem+0.75vw,1.375rem)] text-[#9ca3af] max-w-[700px] mx-auto mb-12 leading-relaxed">
            Upload your broker survey PDF. Get an interactive map with every building
            plotted, tooltips with deal terms, and linked financials - in minutes, not days.
          </p>

          {/* CTAs */}
          <div className="flex gap-4 justify-center flex-wrap mb-20">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#2563eb] text-white px-8 py-4 rounded-lg font-semibold text-base hover:bg-[#1d4ed8] transition-all hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(37,99,235,0.35)] no-underline"
            >
              Request Demo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 bg-transparent text-white px-8 py-4 border border-white/20 rounded-lg font-medium text-base hover:bg-white/[0.06] hover:border-white/30 transition-all no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              See It Live
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-white/[0.08]">
            {[
              { display: '33', label: 'Buildings Mapped' },
              { display: '4', label: 'Shortlisted' },
              { display: '$3.8M', label: 'Total Lease Value Analyzed' },
              { display: '129', label: 'PDF Pages Parsed' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-[clamp(2rem,1.5rem+2vw,3.5rem)] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {s.display}
                </div>
                <div className="text-xs text-[#6b7280] mt-2 uppercase tracking-wider font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO ── */}
      <section id="demo" className="py-24 bg-[#f9fafb]">
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold text-[#2563eb] uppercase tracking-[0.15em] mb-4">
              Live Demo
            </span>
            <h2 className="text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-bold text-[#111827] tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Interactive Survey Map
            </h2>
            <p className="text-base text-[#6b7280] max-w-[600px] mx-auto leading-relaxed">
              33 buildings with availability, pricing, and direct links to survey details.
              Full financial models for every option.
            </p>
          </div>

          {/* Browser frame with actual app screenshot */}
          <div className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[#e5e7eb] bg-white" style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Chrome bar */}
            <div className="flex items-center gap-2 px-5 py-3 bg-[#f3f4f6] border-b border-[#e5e7eb]">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="flex-1 ml-4 bg-white rounded-md px-4 py-1.5 text-xs text-[#6b7280] border border-[#e5e7eb]">
                tour-lytics.com/project/sf-office-search
              </span>
            </div>
            {/* App preview as iframe */}
            <div className="relative bg-white">
              <div className="aspect-[16/9] overflow-hidden">
                <iframe
                  src="/app/index.html"
                  className="w-full h-full border-none pointer-events-none"
                  title="Tour-Lytics App Preview"
                  loading="lazy"
                  style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section id="problem" className="py-24 bg-white">
        <div style={{ maxWidth: '1100px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold text-[#2563eb] uppercase tracking-[0.15em] mb-4">
            The Problem
          </span>
          <h2 className="text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-bold text-[#111827] tracking-tight mb-6 max-w-[800px]" style={{ fontFamily: 'var(--font-display)' }}>
            You can&apos;t build a tour list from a 129-page PDF.
          </h2>
          <p className="text-lg text-[#6b7280] leading-relaxed max-w-[700px] mb-12">
            Every corporate real estate team gets the same thing from their broker: a massive PDF
            with no map, no sorting, no filtering. You print it out, flip through it, and try to
            build a shortlist from memory. Then you do the financials by hand in Excel.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Problem card */}
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fee2e2] mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#991b1b] mb-4" style={{ fontFamily: 'var(--font-display)' }}>What brokers send you</h3>
              <ul className="space-y-3">
                {[
                  'A static 129-page PDF',
                  'No map, no sorting, no filtering',
                  'Can\'t build a tour list from it',
                  'Paper tour folders and handwritten notes',
                  'No cash flow or GAAP financials',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[#991b1b]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626] mt-2 flex-shrink-0" />
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution card */}
            <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-xl p-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#dcfce7] mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#166534] mb-4" style={{ fontFamily: 'var(--font-display)' }}>What Tour-Lytics gives you</h3>
              <ul className="space-y-3">
                {[
                  'Interactive map with every building',
                  'Click any name to jump to survey page',
                  'Build your tour list from the map',
                  'Tour Book with scores, photos, and notes',
                  'Monthly cash flow and GAAP P&L',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[#166534]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] mt-2 flex-shrink-0" />
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── PAIN POINT QUOTE ── */}
      <section className="py-20 bg-[#f9fafb]">
        <div className="text-center" style={{ maxWidth: '800px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-8 text-[#2563eb]/20">
            <path d="M10 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2l-2 4h2l2-4V8h-4zm8 0c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h2l-2 4h2l2-4V8h-4z" fill="currentColor" />
          </svg>
          <blockquote className="text-[clamp(1.25rem,1rem+1vw,1.5rem)] font-medium text-[#111827] leading-relaxed mb-8">
            &ldquo;Tell me the last time a broker has sent you a spreadsheet that matches what your CFO
            really wants to see...cash flow, straight-line P&L, GAAP format...it doesn&apos;t happen.
            Brokers only care about the pay day, they don&apos;t care about your financial reports.&rdquo;
          </blockquote>
          <div className="text-sm text-[#6b7280] font-medium">The problem Tour-Lytics solves</div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-white">
        <div style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-[#2563eb] uppercase tracking-[0.15em] mb-4">
              Platform
            </span>
            <h2 className="text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-bold text-[#111827] tracking-tight mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Built for corporate real estate teams
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-xl p-8 border border-[#e5e7eb] hover:border-[#2563eb]/30 hover:shadow-lg transition-all duration-200 group"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#dbeafe] text-[#2563eb] mb-6 group-hover:bg-[#2563eb] group-hover:text-white transition-all duration-200">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-[#111827] mb-3" style={{ fontFamily: 'var(--font-display)' }}>{f.title}</h3>
                <p className="text-sm text-[#6b7280] leading-relaxed mb-4">{f.description}</p>
                {f.badge && (
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: `${f.badgeColor}15`,
                      color: f.badgeColor,
                    }}
                  >
                    {f.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 bg-[#f9fafb]">
        <div style={{ maxWidth: '1100px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold text-[#2563eb] uppercase tracking-[0.15em] mb-4">
              How It Works
            </span>
            <h2 className="text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-bold text-[#111827] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              From PDF to insight in 3 steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="w-20 h-20 rounded-full bg-[#2563eb] flex items-center justify-center mx-auto mb-8">
                  <span className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{s.num}</span>
                </div>
                <h3 className="text-xl font-bold text-[#111827] mb-4" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</h3>
                <p className="text-base text-[#6b7280] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-28 bg-[#0f172a] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37,99,235,0.12) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 text-center" style={{ maxWidth: '600px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <h2 className="text-[clamp(1.75rem,1.2rem+2vw,3rem)] font-bold text-white tracking-tight mb-6" style={{ fontFamily: 'var(--font-display)' }}>
            Ready to see your data on a map?
          </h2>
          <p className="text-[#9ca3af] mb-10 text-lg leading-relaxed">
            Join the corporate real estate teams replacing broker spreadsheets
            with real financial intelligence.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-[#2563eb] text-white px-10 py-4 rounded-lg font-semibold text-base hover:bg-[#1d4ed8] transition-all hover:-translate-y-px hover:shadow-[0_12px_32px_rgba(37,99,235,0.35)] no-underline"
          >
            Request Demo
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
          <p className="text-sm text-[#6b7280] mt-6">
            No credit card required. We&apos;ll be in touch within 24 hours.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 bg-[#0f172a] border-t border-white/[0.05]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4" style={{ maxWidth: '1280px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="flex items-center gap-3">
            <Logo size={24} className="text-[#6b7280]" />
            <span className="text-sm text-[#6b7280]">&copy; 2026 Tour-Lytics. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-[#6b7280]">
            <Link href="/investors" className="hover:text-[#9ca3af] transition-colors no-underline text-[#6b7280]">Investors</Link>
            <span className="text-[#374151]">|</span>
            <a
              href="https://www.perplexity.ai/computer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#9ca3af] transition-colors no-underline text-[#6b7280]"
            >
              Created with Perplexity Computer
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
