/* Investors page - rebuilt 2026-03-13 */
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
function Counter({ end, suffix = '', label }: { end: number; suffix?: string; label: string }) {
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
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div className="font-extrabold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 1.5rem + 3vw, 4rem)', color: '#2563eb', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div className="font-medium" style={{ color: '#64748b', fontSize: 'clamp(0.8125rem, 0.75rem + 0.25vw, 0.9375rem)', marginTop: '0.5rem', letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>
        {label}
      </div>
    </div>
  )
}

export default function InvestorsPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden', background: '#ffffff' }}>

      {/* ===================== NAV ===================== */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: scrolled ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
        }}
      >
        <div className="flex items-center justify-between" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1.5rem' }}>
          <Link href="/" className="flex items-center no-underline" style={{ gap: '0.75rem', color: '#0f172a' }}>
            <Logo size={32} className="text-[#0f172a]" />
            <span className="font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem,1rem+0.75vw,1.5rem)' }}>
              Tour<span style={{ color: '#2563eb' }}>-Lytics</span>
            </span>
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

          <h1 className="font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 1rem + 4vw, 5rem)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1.5rem', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
            The CRE Intelligence{' '}
            <span style={{ color: '#2563eb' }}>Platform</span>
          </h1>

          <p style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', color: '#94a3b8', maxWidth: '640px', margin: '0 auto 2.5rem auto', lineHeight: 1.5 }}>
            Transforming how corporate real estate teams analyze markets, compare buildings, and make lease decisions.
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
            <Counter end={5} suffix=" min" label="To full financials" />
            <Counter end={100} suffix="%" label="GAAP compliant" />
          </div>
        </div>
      </section>

      {/* ===================== THE PROBLEM ===================== */}
      <section style={{ padding: '6rem 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '4rem', alignItems: 'start' }}>
            {/* Left: Problem statement */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                The Problem
              </span>
              <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.2rem + 2vw, 2.75rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                A broken workflow hiding in every lease deal
              </h2>
              <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Corporate real estate teams spend weeks manually converting broker spreadsheets into formats their leadership can actually use. Brokers provide deal-focused data. CFOs need GAAP-compliant financial projections. The gap costs companies time, money, and bad decisions.
              </p>
              <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', lineHeight: 1.7 }}>
                There is no tool in the market that bridges this gap. Every CRE team in America is stuck doing it manually.
              </p>
            </div>

            {/* Right: Founder quote */}
            <div style={{ padding: '2rem', borderRadius: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ marginBottom: '1.25rem' }}>
                <path d="M10 11H6a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v7c0 2.21-1.79 4-4 4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M20 11h-4a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 011 1v7c0 2.21-1.79 4-4 4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <blockquote style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#334155', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
                &ldquo;Tell me the last time a broker has sent you a spreadsheet that matches what your CFO really wants to see...cash flow, straight-line P&amp;L, GAAP format...it doesn&apos;t happen. Brokers only care about the pay day, they don&apos;t care about your financial reports.&rdquo;
              </blockquote>
              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <div className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#0f172a', fontSize: '0.9375rem' }}>Scott Moitoza</div>
                <div style={{ color: '#64748b', fontSize: '0.8125rem', marginTop: '0.125rem' }}>Founder, Tour-Lytics</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== THE SOLUTION ===================== */}
      <section style={{ padding: '6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              The Solution
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              One platform that speaks both broker and CFO
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
              Tour-Lytics transforms raw market data into the financial intelligence corporate real estate teams actually need.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.5rem' }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                ),
                title: 'Market Intelligence',
                desc: 'Interactive maps with every building, availability, and broker survey data linked in one view.',
                accent: '#dbeafe',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="18" rx="2" />
                    <path d="M2 9h20M10 3v18" />
                  </svg>
                ),
                title: 'GAAP Financial Models',
                desc: 'Cash flow, straight-line P&L, and all-in occupancy cost models generated instantly from any broker proposal.',
                accent: '#dcfce7',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" />
                    <path d="M9 14l2 2 4-4" />
                  </svg>
                ),
                title: 'Tour Management',
                desc: 'Score, rank, schedule, and coordinate building tours with your entire team in one place.',
                accent: '#fef3c7',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z" />
                    <path d="M8.5 14.5A9 9 0 003 21h18a9 9 0 00-5.5-6.5" />
                  </svg>
                ),
                title: 'AI-Powered Analysis',
                desc: 'Natural language Q&A over your entire market data, financial models, and tour notes.',
                accent: '#ede9fe',
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
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe'
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

      {/* ===================== WHY NOW ===================== */}
      <section style={{ padding: '6rem 0', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3.5rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Market Opportunity
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
              A $20T+ market running on spreadsheets
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
              U.S. commercial real estate represents over $20 trillion in assets. Every corporate lease transaction involves the same broken workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem' }}>
            {[
              {
                step: '01',
                title: 'The Wedge',
                desc: 'Mid-market and enterprise tenant representation. Every company with more than one office has this problem.',
              },
              {
                step: '02',
                title: 'The Expansion',
                desc: 'Portfolio analytics, renewal management, multi-market intelligence. Deeper into the tenant lifecycle.',
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

      {/* ===================== COMPETITIVE ADVANTAGE ===================== */}
      <section style={{ padding: '6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '4rem', alignItems: 'start' }}>
            {/* Left */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                Competitive Advantage
              </span>
              <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.2rem + 2vw, 2.75rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '1.25rem', lineHeight: 1.15 }}>
                Built by someone who lived the problem
              </h2>
              <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Tour-Lytics was built by a CRE professional who spent years manually converting broker data into CFO-ready financials. This is not a tech company guessing at what the industry needs.
              </p>
              <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', lineHeight: 1.7 }}>
                Existing tools like CoStar and VTS focus on market data or lease administration. None of them bridge the gap between broker deliverables and corporate financial reporting.
              </p>
            </div>

            {/* Right: Comparison */}
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              {/* Red card */}
              <div style={{ padding: '1.5rem 2rem', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </div>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#991b1b', fontSize: '0.9375rem' }}>Today&apos;s Workflow</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {['Broker sends PDF survey + spreadsheet', 'CRE team manually re-keys data', 'Finance builds separate GAAP models', 'Weeks of back-and-forth per deal'].map((item) => (
                    <li key={item} className="text-sm" style={{ color: '#64748b', paddingLeft: '1.25rem', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, top: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#fca5a5' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Green card */}
              <div style={{ padding: '1.5rem 2rem', background: '#f0fdf4' }}>
                <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <span className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#166534', fontSize: '0.9375rem' }}>With Tour-Lytics</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {['Upload broker survey PDF', 'Instant interactive map + building data', 'Auto-generated GAAP financials', 'Minutes instead of weeks'].map((item) => (
                    <li key={item} className="text-sm" style={{ color: '#64748b', paddingLeft: '1.25rem', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, top: '6px', width: '6px', height: '6px', borderRadius: '50%', background: '#86efac' }} />
                      {item}
                    </li>
                  ))}
                </ul>
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
