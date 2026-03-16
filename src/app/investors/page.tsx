/* Investors page - rebuilt 2026-03-16 with investor feedback */
'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'

/* -- SVG Logo -- */
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

/* -- Animated counter -- */
function Counter({ end, suffix = '', label, prefix = '' }: { end: number; suffix?: string; label: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1400
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
    <div ref={ref} className="text-center">
      <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em' }}>
        {prefix}{count}{suffix}
      </div>
      <div className="text-sm" style={{ color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}

export default function InvestorsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="bg-white" style={{ fontFamily: 'var(--font-body)', minHeight: '100vh' }}>
      {/* ===================== NAV ===================== */}
      <nav className="fixed top-0 inset-x-0 z-50" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center justify-between" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1.5rem', height: '64px' }}>
          <Link href="/" className="flex items-center no-underline" style={{ gap: '0.625rem' }}>
            <Logo size={28} />
            <span className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', color: '#0f172a', letterSpacing: '-0.01em' }}>Tour-Lytics</span>
          </Link>
          <div className="hidden md:flex items-center" style={{ gap: '2rem' }}>
            <Link href="/" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }}>Home</Link>
            <Link href="/#demo" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }}>Map Demo</Link>
            <Link href="/#analysis" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }}>Analysis</Link>
            <Link href="/#features" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }}>Features</Link>
            <a href="#contact" className="text-sm font-medium no-underline transition-colors" style={{ color: '#2563eb' }}>Contact</a>
            <Link
              href="/login"
              className="font-semibold text-sm no-underline transition-all"
              style={{ backgroundColor: '#2563eb', color: '#ffffff', padding: '0.5rem 1.25rem', borderRadius: '0.75rem' }}
            >
              Sign In
            </Link>
          </div>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden bg-transparent border-none cursor-pointer"
            style={{ padding: '0.5rem', color: '#0f172a' }}
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
          <div className="md:hidden" style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', borderTop: '1px solid #e2e8f0', padding: '1.5rem' }}>
            <div className="flex flex-col" style={{ gap: '1rem' }}>
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Home</Link>
              <Link href="/#demo" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Map Demo</Link>
              <Link href="/#analysis" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Analysis</Link>
              <Link href="/#features" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Features</Link>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#2563eb' }}>Contact</a>
              <Link href="/login" className="text-center font-semibold text-sm no-underline" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', marginTop: '0.5rem' }}>Sign In</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0a0f1a 100%)', paddingTop: 'calc(80px + 5rem)', paddingBottom: '5rem' }}>
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

        <div className="relative z-10 text-center" style={{ maxWidth: '900px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          {/* Badge */}
          <div className="inline-flex items-center" style={{ gap: '0.5rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', padding: '0.25rem 1rem', borderRadius: '1.25rem', fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', color: '#cbd5e1', marginBottom: '2rem', letterSpacing: '0.04em', textTransform: 'uppercase' as const, fontWeight: 500 }}>
            <span className="rounded-full" style={{ width: '6px', height: '6px', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            Investor Overview
          </div>

          <h1 className="font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 1rem + 4vw, 4.5rem)', letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: '1.5rem', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
            The operating system for{' '}
            <span style={{ color: '#2563eb' }}>commercial real estate site selection</span>
          </h1>

          <p style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.375rem)', color: '#94a3b8', maxWidth: '700px', margin: '0 auto 1.5rem auto', lineHeight: 1.55 }}>
            AI-powered deal intelligence for every commercial real estate tour. From broker survey to signed lease, Tour-Lytics replaces the spreadsheets, PDFs, and email chains that still run a $20T+ market.
          </p>

          {/* TAM punch line */}
          <p style={{ fontSize: 'clamp(0.875rem, 0.8rem + 0.3vw, 1rem)', color: '#64748b', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: 1.5 }}>
            20,000+ tenant-rep brokers in the U.S. alone. $15M+ addressable SaaS opportunity. Zero purpose-built tools.
          </p>

          {/* CTAs */}
          <div className="flex justify-center flex-wrap" style={{ gap: '1rem' }}>
            <a
              href="#contact"
              className="inline-flex items-center font-semibold no-underline transition-all"
              style={{ gap: '0.5rem', backgroundColor: '#2563eb', color: '#ffffff', padding: '0.75rem 2rem', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', border: 'none', cursor: 'pointer' }}
            >
              Get in Touch
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <Link
              href="/"
              className="inline-flex items-center font-medium no-underline transition-all"
              style={{ gap: '0.5rem', backgroundColor: 'transparent', color: '#cbd5e1', padding: '0.75rem 2rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', cursor: 'pointer' }}
            >
              View Product
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== PROOF OF CONCEPT - STATS ===================== */}
      <section style={{ padding: '5rem 0', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Proof of Concept
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              Built and validated with a live search
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              A Fortune 500 company used Tour-Lytics to evaluate their entire San Francisco office search, replacing weeks of manual spreadsheet work.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: '2rem' }}>
            <Counter end={33} label="Buildings analyzed" />
            <Counter end={2} suffix=".8M+" label="Sq ft mapped" />
            <Counter end={7} label="AI-powered features" />
            <Counter end={100} suffix="%" label="GAAP compliant" />
          </div>
        </div>
      </section>

      {/* ===================== THE PROBLEM ===================== */}
      <section style={{ padding: '6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              The Problem
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              Commercial real estate decisions still run on PDFs
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
              Every corporate lease transaction follows the same broken workflow: broker sends a PDF survey, tenant manually re-keys data into spreadsheets, then makes million-dollar decisions off disjointed files and email threads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem' }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                ),
                accent: '#fef2f2',
                title: 'Trapped in static PDFs',
                desc: 'Broker surveys arrive as 40-page PDFs with inconsistent formatting. Every building is locked inside a document no tool can read or compare.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                ),
                accent: '#fef2f2',
                title: 'Rebuilt in spreadsheets',
                desc: 'CRE teams manually re-type rent, square footage, and deal terms into Excel. Every project starts from zero. One typo cascades through the entire financial model.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                ),
                accent: '#fef2f2',
                title: 'Weeks of wasted time',
                desc: 'What should take hours takes weeks. Site visits lack context, comparisons happen over email, and final decisions are based on gut feel instead of structured intelligence.',
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  padding: '2rem',
                  borderRadius: '1rem',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: card.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  {card.icon}
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)', color: '#0f172a', marginBottom: '0.5rem' }}>{card.title}</h3>
                <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== THE WORKFLOW ===================== */}
      <section style={{ padding: '6rem 0', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              The Workflow
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              Embedded in every step of the deal
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
              Tour-Lytics is not a standalone analytics tool. It lives inside the entire site selection workflow, from the first broker survey to the final lease decision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5" style={{ gap: '0' }}>
            {[
              { step: '01', title: 'Survey Upload', desc: 'Broker sends a PDF survey. AI parses it into structured data with buildings on a map.', icon: '📄' },
              { step: '02', title: 'Shortlist', desc: 'Compare buildings side by side. AI scores and ranks them by your criteria.', icon: '📋' },
              { step: '03', title: 'Tour Day', desc: 'Interactive tour book with schedules, photos, notes, and real-time scoring.', icon: '🏢' },
              { step: '04', title: 'Analysis', desc: 'Full financial models, commute studies, and AI-driven comparisons on every building.', icon: '📊' },
              { step: '05', title: 'Decision', desc: 'Side-by-side RFP analysis with GAAP-compliant P&L to support the lease decision.', icon: '✅' },
            ].map((item, i) => (
              <div key={item.step} className="relative" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
                {/* Connector line */}
                {i < 4 && (
                  <div className="hidden md:block absolute" style={{ top: '2.75rem', right: '-0.5rem', width: '1rem', height: '2px', background: '#cbd5e1', zIndex: 1 }} />
                )}
                <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{item.icon}</div>
                <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.6875rem', color: '#2563eb', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '0.5rem' }}>
                  Step {item.step}
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: '#0f172a', marginBottom: '0.375rem' }}>{item.title}</h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== AI KNOWLEDGE LAYER ===================== */}
      <section style={{ padding: '6rem 0', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '4rem', alignItems: 'start' }}>
            {/* Left: Narrative */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                AI Knowledge Layer
              </span>
              <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.2rem + 2vw, 2.75rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                The knowledge graph of commercial real estate searches
              </h2>
              <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Every project builds a structured intelligence layer. Tour-Lytics ingests broker surveys, financial terms, tour schedules, photos, and employee commute data into a single knowledge graph. The AI does not just answer questions. It understands the relationships between buildings, deal terms, team preferences, and location data.
              </p>
              <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Connected to Google Maps and Google Places APIs, the assistant can find nearby restaurants, calculate commute times, and pull real-time local data. Users ask questions in plain English and get answers grounded in their actual project data.
              </p>

              {/* Capability list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                {[
                  { icon: '💬', text: 'Compare any two buildings on cost, size, location, or deal structure' },
                  { icon: '📊', text: 'Break down all-in occupancy costs, GAAP rent, and OpEx line items' },
                  { icon: '☕', text: 'Find nearby coffee shops, restaurants, or parking with ratings and hours' },
                  { icon: '🚶', text: 'Calculate walking, driving, or transit times between tour stops' },
                  { icon: '📅', text: 'Aware of the live tour schedule, scores, and shortlist in real time' },
                  { icon: '🔗', text: 'Powered by Claude AI with Google Maps and Places integration' },
                  { icon: '🚗', text: 'Run commute studies across your entire team to find the optimal office location' },
                  { icon: '📸', text: 'AI photo analysis tags and organizes tour photos automatically' },
                ].map((item) => (
                  <div key={item.text} className="flex items-start" style={{ gap: '0.75rem' }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '2px' }}>{item.icon}</span>
                    <span style={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Mini chat mockup */}
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              {/* Dark chat header */}
              <div style={{ padding: '1rem 1.25rem', background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                <span className="font-semibold" style={{ color: '#e2e8f0', fontSize: '0.8125rem', fontFamily: 'var(--font-display)' }}>Tour-Lytics AI Assistant</span>
              </div>

              {/* Chat messages */}
              <div style={{ background: '#0f172a', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: '#2563eb', color: '#fff', padding: '0.625rem 0.875rem', borderRadius: '0.875rem 0.875rem 0.25rem 0.875rem', fontSize: '0.8125rem', lineHeight: 1.5, maxWidth: '85%' }}>
                    What&apos;s the all-in monthly cost for 250 Brannan?
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z" /><path d="M8.5 14.5A9 9 0 003 21h18a9 9 0 00-5.5-6.5" /></svg>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', padding: '0.625rem 0.875rem', borderRadius: '0.25rem 0.875rem 0.875rem 0.875rem', fontSize: '0.8125rem', lineHeight: 1.6, maxWidth: '90%' }}>
                    The all-in monthly P&amp;L for 250 Brannan is <strong style={{ color: '#22c55e' }}>$106,594</strong>. That includes $56,594 rent + $50,000 OpEx (F&amp;B, Workplace Experience, Maintenance). That&apos;s $79.95/RSF/yr.
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: '#2563eb', color: '#fff', padding: '0.625rem 0.875rem', borderRadius: '0.875rem 0.875rem 0.25rem 0.875rem', fontSize: '0.8125rem', lineHeight: 1.5, maxWidth: '85%' }}>
                    Find me lunch spots near there
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'flex-start' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z" /><path d="M8.5 14.5A9 9 0 003 21h18a9 9 0 00-5.5-6.5" /></svg>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#cbd5e1', padding: '0.625rem 0.875rem', borderRadius: '0.25rem 0.875rem 0.875rem 0.875rem', fontSize: '0.8125rem', lineHeight: 1.6, maxWidth: '90%' }}>
                    Near 250 Brannan, I found:<br />
                    &#127869; <strong>The Deli Board</strong> (4.6 stars) - 1058 Folsom<br />
                    &#127869; <strong>Marlowe</strong> (4.4 stars) - 330 Townsend<br />
                    &#127869; <strong>Tres</strong> (4.3 stars) - 130 Townsend
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== TWO MARKETS ===================== */}
      <section style={{ padding: '6rem 0', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Two Markets, One Platform
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              Built for both sides of the deal
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
              Tour-Lytics serves the two key personas in every commercial real estate site selection: the broker driving the process and the tenant making the decision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2rem' }}>
            {/* Brokers */}
            <div style={{ padding: '2.5rem', borderRadius: '1rem', background: '#ffffff', border: '2px solid #2563eb', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-1px', left: '1.5rem', background: '#2563eb', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '0.25rem 0.875rem', borderRadius: '0 0 0.5rem 0.5rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                Primary Market
              </div>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem)', color: '#0f172a', margin: 0 }}>Tenant-Rep Brokers</h3>
              </div>
              <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                Brokers are the entry point. They run the tour, distribute the surveys, and manage the process. Tour-Lytics gives them a modern platform to deliver a better client experience.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  'Upload broker surveys and create interactive maps instantly',
                  'Manage tour schedules, attendees, and invitations',
                  'Deliver polished tour books instead of PDF packets',
                  'Control the process with admin-level permissions',
                ].map((item) => (
                  <li key={item} className="flex items-start text-sm" style={{ gap: '0.5rem', color: '#475569' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tenants / Occupiers */}
            <div style={{ padding: '2.5rem', borderRadius: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.25rem, 1.1rem + 0.5vw, 1.5rem)', color: '#0f172a', margin: 0 }}>Tenants and Occupiers</h3>
              </div>
              <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                Corporate real estate teams and decision-makers are the end users. They get structured data, financial intelligence, and AI analysis instead of a stack of PDFs to read on their own.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  'Explore buildings on an interactive map with full detail',
                  'Run AI-powered financial comparisons and commute studies',
                  'Score and rank buildings during live tour days',
                  'Access the AI assistant for any project question',
                ].map((item) => (
                  <li key={item} className="flex items-start text-sm" style={{ gap: '0.5rem', color: '#475569' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== MARKET OPPORTUNITY ===================== */}
      <section style={{ padding: '6rem 0', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Market Opportunity
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              A $20T+ market with no purpose-built intelligence tool
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>
              U.S. commercial real estate represents over $20 trillion in assets. Every corporate lease transaction involves the same broken workflow. Yet no software exists to serve the tenant side of the deal.
            </p>
          </div>

          {/* TAM stats row */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem', marginBottom: '3rem' }}>
            <div style={{ padding: '2rem', borderRadius: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 2.75rem)', color: '#2563eb', marginBottom: '0.25rem' }}>20K+</div>
              <div style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>Tenant-rep brokers in the U.S.</div>
              <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Each managing multiple active searches</div>
            </div>
            <div style={{ padding: '2rem', borderRadius: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 2.75rem)', color: '#2563eb', marginBottom: '0.25rem' }}>$15M+</div>
              <div style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>Addressable SaaS opportunity</div>
              <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Usage-based model tied to AI features</div>
            </div>
            <div style={{ padding: '2rem', borderRadius: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 2.75rem)', color: '#2563eb', marginBottom: '0.25rem' }}>0</div>
              <div style={{ fontSize: '0.875rem', color: '#475569', fontWeight: 600, marginBottom: '0.25rem' }}>Purpose-built competitors</div>
              <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>No tool serves the tenant/occupier intelligence gap</div>
            </div>
          </div>

          {/* Growth path */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem' }}>
            {[
              {
                step: '01',
                title: 'The Wedge',
                desc: 'Tenant-rep brokers running site selections. Every company with more than one office has this problem. Brokers are the distribution channel.',
              },
              {
                step: '02',
                title: 'The Expansion',
                desc: 'Portfolio analytics, renewal management, multi-market intelligence. Deeper into the tenant lifecycle with recurring usage.',
              },
              {
                step: '03',
                title: 'The Platform',
                desc: 'Both sides of the table. Brokers publish surveys through Tour-Lytics. Tenants consume them. One connected ecosystem.',
              },
            ].map((item) => (
              <div key={item.step} style={{ padding: '2rem', borderRadius: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.75rem', color: '#2563eb', letterSpacing: '0.08em', marginBottom: '1rem', textTransform: 'uppercase' as const }}>
                  Step {item.step}
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem, 1rem + 0.5vw, 1.375rem)', color: '#0f172a', marginBottom: '0.75rem' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== BUSINESS MODEL ===================== */}
      <section style={{ padding: '6rem 0', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Business Model
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              Usage-based AI token model
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>
              Every user starts free. AI-powered features consume tokens. The heaviest workflows are the highest-value and highest-cost actions on the platform. Revenue scales directly with the features people value most.
            </p>
          </div>

          {/* Pricing tiers */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
            {/* Free tier */}
            <div style={{ padding: '2rem', borderRadius: '1rem', background: '#ffffff', border: '2px solid #e2e8f0', transition: 'box-shadow 0.2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              <div style={{ marginBottom: '1.5rem' }}>
                <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#64748b', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Free</span>
                <div className="flex items-baseline" style={{ gap: '0.25rem' }}>
                  <span className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 2.75rem)', color: '#0f172a' }}>100</span>
                  <span style={{ fontSize: '1rem', color: '#64748b' }}>tokens</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.25rem' }}>No credit card required</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  'Explore the interactive map',
                  'View building details and survey pages',
                  'Try the AI assistant',
                  'Basic tour book features',
                ].map((item) => (
                  <li key={item} className="flex items-start text-sm" style={{ gap: '0.5rem', color: '#475569' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro tier */}
            <div style={{ padding: '2rem', borderRadius: '1rem', background: '#ffffff', border: '2px solid #2563eb', position: 'relative', transition: 'box-shadow 0.2s', boxShadow: '0 8px 24px rgba(37,99,235,0.08)' }}>
              <div style={{ position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)', background: '#2563eb', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, padding: '0.25rem 1rem', borderRadius: '0 0 0.5rem 0.5rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                Most Popular
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Pro</span>
                <div className="flex items-baseline" style={{ gap: '0.25rem' }}>
                  <span className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 2.75rem)', color: '#0f172a' }}>Pay-as-you-go</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.25rem' }}>Token packs available, tokens never expire</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  'Everything in Free',
                  'Unlimited AI assistant queries',
                  'Full financial modeling (cash flow, P&L, GAAP)',
                  'Survey parsing and data extraction',
                  'Tour book with scoring and photos',
                  'PDF and CSV exports',
                ].map((item) => (
                  <li key={item} className="flex items-start text-sm" style={{ gap: '0.5rem', color: '#475569' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Enterprise tier */}
            <div style={{ padding: '2rem', borderRadius: '1rem', background: '#ffffff', border: '2px solid #e2e8f0', transition: 'box-shadow 0.2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              <div style={{ marginBottom: '1.5rem' }}>
                <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#64748b', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Enterprise</span>
                <div className="flex items-baseline" style={{ gap: '0.25rem' }}>
                  <span className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.5rem + 1.5vw, 2.75rem)', color: '#0f172a' }}>Custom</span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.25rem' }}>Volume pricing for large teams</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  'Everything in Pro',
                  'Multi-market survey support',
                  'Team collaboration and shared projects',
                  'Priority AI processing',
                  'Dedicated onboarding',
                  'SSO and admin controls',
                ].map((item) => (
                  <li key={item} className="flex items-start text-sm" style={{ gap: '0.5rem', color: '#475569' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Token consumption table */}
          <div style={{ borderRadius: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ background: '#0f172a', padding: '1rem 1.5rem' }}>
              <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#e2e8f0', fontSize: '0.9375rem' }}>How tokens are consumed</span>
            </div>
            {[
              { action: 'AI chat query', cost: '1 token', note: 'Building comparisons, deal questions, directions', icon: '💬' },
              { action: 'Photo AI analysis', cost: '3 tokens', note: 'AI tagging, categorization, and quality scoring per photo', icon: '📸' },
              { action: 'Bulk photo analysis', cost: '8 tokens', note: 'Process up to 15 tour photos in a single batch', icon: '🖼️' },
              { action: 'Commute study', cost: '10 tokens', note: 'Map employee commute times to every shortlisted building', icon: '🚗' },
              { action: 'RFP/LOI analysis', cost: '15 tokens', note: 'Full cash flow, straight-line P&L, GAAP output per building', icon: '📊' },
              { action: 'Survey map upload', cost: '25 tokens', note: 'Parse an entire broker survey PDF into structured data + map', icon: '📄' },
              { action: 'Assumptions update', cost: 'Free', note: 'Update per-building financial assumptions at any time', icon: '⚙️' },
            ].map((item, i) => (
              <div key={item.action} className="flex items-center" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: i % 2 === 0 ? '#ffffff' : '#f8fafc', gap: '1rem', flexWrap: 'wrap' as const }}>
                <span style={{ fontSize: '1.125rem', flexShrink: 0 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <span className="font-semibold" style={{ fontSize: '0.9375rem', color: '#0f172a' }}>{item.action}</span>
                  <span className="hidden md:inline" style={{ fontSize: '0.8125rem', color: '#94a3b8', marginLeft: '0.75rem' }}>{item.note}</span>
                </div>
                <span className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', color: item.cost === 'Free' ? '#16a34a' : '#2563eb', background: item.cost === 'Free' ? '#dcfce7' : '#dbeafe', padding: '0.25rem 0.75rem', borderRadius: '1.25rem', whiteSpace: 'nowrap' as const }}>
                  {item.cost}
                </span>
              </div>
            ))}
          </div>

          {/* Revenue model note */}
          <div style={{ marginTop: '2rem', padding: '1.5rem 2rem', borderRadius: '1rem', background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div className="flex items-start" style={{ gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
              </div>
              <div>
                <h4 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: '#0f172a', marginBottom: '0.375rem' }}>Why this model works</h4>
                <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>
                  Survey parsing, RFP analysis, and commute studies are the highest-value actions on the platform and the heaviest AI lift. Revenue scales directly with the features people value most. The free tier (100 tokens) gets teams in the door. Token packs convert them when they see the AI in action. Per-project budgets and admin controls let enterprise teams manage spend. This is the same playbook Perplexity, Claude, and ChatGPT use: generous free access, then monetize power usage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== COMPETITIVE ANALYSIS ===================== */}
      <section style={{ padding: '6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Competitive Landscape
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              Nobody else does what we do
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>
              Existing CRE tools serve landlords, investors, or lease administrators. No tool converts broker deliverables into actionable intelligence for corporate occupiers.
            </p>
          </div>

          {/* Competitive table - scrollable on mobile */}
          <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div style={{ overflowX: 'auto' as const }}>
              <div style={{ minWidth: '700px' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', background: '#0f172a', padding: '1rem 1.5rem' }}>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#e2e8f0', fontSize: '0.8125rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Category</span>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#e2e8f0', fontSize: '0.8125rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>What They Do</span>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#60a5fa', fontSize: '0.8125rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Tour-Lytics Difference</span>
                </div>
                {/* Table rows */}
                {[
                  {
                    category: 'Lease Management',
                    players: 'Yardi, MRI, CoStar',
                    what: 'Manage existing leases and rent rolls',
                    diff: 'We work upstream - helping teams evaluate options before they sign',
                  },
                  {
                    category: 'Lease Abstraction AI',
                    players: 'Spacebase, Leverton',
                    what: 'Read and extract data from lease documents',
                    diff: 'We parse broker surveys, not executed leases - entirely different document type',
                  },
                  {
                    category: 'Deal Management',
                    players: 'Dealpath',
                    what: 'Track acquisition pipelines for investors',
                    diff: 'We serve corporate occupiers doing site selection, not investment acquisitions',
                  },
                  {
                    category: 'Portfolio Tools',
                    players: 'VTS, Agora',
                    what: 'Landlord and owner-side portfolio management',
                    diff: 'We sit on the tenant side - the one receiving broker surveys, not sending them',
                  },
                  {
                    category: 'Commute Analytics',
                    players: 'None',
                    what: 'No CRE tool offers employee commute optimization for office selection',
                    diff: 'Upload employee addresses, see transit/drive/bike breakdowns per building, and find the optimal location for your team.',
                  },
                  {
                    category: 'AI Assistant',
                    players: 'None',
                    what: 'No CRE tool offers an AI analyst embedded in the workflow',
                    diff: 'Our AI knows every building, every deal term, and every financial model. It is the knowledge graph for commercial real estate searches.',
                  },
                ].map((row, i) => (
                  <div
                    key={row.category}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.5fr 1.5fr',
                      padding: '1.25rem 1.5rem',
                      background: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', color: '#0f172a', marginBottom: '0.125rem' }}>{row.category}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{row.players}</div>
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>{row.what}</div>
                    <div style={{ fontSize: '0.875rem', color: '#2563eb', lineHeight: 1.6, fontWeight: 500 }}>{row.diff}</div>
                  </div>
                ))}
                {/* Gap row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', padding: '1.25rem 1.5rem', background: '#dbeafe', borderTop: '1px solid #bfdbfe' }}>
                  <div>
                    <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', color: '#1e40af' }}>The Gap</div>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: 1.6 }}>
                    No tool converts broker deliverables into actionable intelligence for occupiers
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#1e40af', lineHeight: 1.6, fontWeight: 600 }}>
                    Tour-Lytics fills this gap: deal intelligence for commercial real estate searches
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CONTACT CTA ===================== */}
      <section id="contact" style={{ padding: '6rem 0', background: 'linear-gradient(180deg, #0f172a 0%, #0a0f1a 100%)', position: 'relative', overflow: 'hidden' }}>
        {/* Grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative z-10 text-center" style={{ maxWidth: '640px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Let&apos;s Talk
          </span>
          <h2 className="font-bold text-white" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Interested in learning more?
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#94a3b8', lineHeight: 1.6, marginBottom: '2.5rem' }}>
            We&apos;re looking for investors who understand the enterprise real estate workflow. Let&apos;s connect.
          </p>
          <div className="flex justify-center flex-wrap" style={{ gap: '1rem' }}>
            <a
              href="mailto:samoitoza@gmail.com"
              className="inline-flex items-center font-semibold no-underline transition-all"
              style={{ gap: '0.5rem', backgroundColor: '#2563eb', color: '#ffffff', padding: '0.875rem 2.5rem', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', border: 'none', cursor: 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 4L12 13 2 4" />
              </svg>
              samoitoza@gmail.com
            </a>
          </div>
          <p className="text-xs" style={{ color: '#475569', marginTop: '1.5rem' }}>Founder-led. Pre-seed stage. San Francisco, CA.</p>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer style={{ padding: '2rem 0', background: '#0a0f1a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col md:flex-row items-center justify-between flex-wrap" style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem', gap: '1rem' }}>
          <div className="text-xs" style={{ color: '#64748b' }}>&copy; 2026 Tour-Lytics. All rights reserved.</div>
          <div className="flex items-center" style={{ gap: '1.5rem' }}>
            <Link href="/" className="text-xs no-underline transition-colors" style={{ color: '#64748b' }}>Home</Link>
            <a
              href="https://www.perplexity.ai/computer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs no-underline transition-colors"
              style={{ color: '#64748b' }}
            >
              Created with Perplexity Computer
            </a>
          </div>
        </div>
      </footer>

      {/* Keyframe animation for pulse */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
