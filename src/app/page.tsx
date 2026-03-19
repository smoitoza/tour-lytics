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

/* -- Star rating component -- */
function StarRating({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <div className="flex" style={{ gap: '2px' }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ color: i < filled ? '#f59e0b' : '#d1d5db' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeFinTab, setActiveFinTab] = useState<'comparison' | 'cashflow' | 'straightline'>('comparison')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [formState, setFormState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' })

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Escape key to close fullscreen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isFullscreen])

  // Lock body scroll when fullscreen
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isFullscreen])

  const handleDemoRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormState('sending')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/demo_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          company: formData.company || null,
          message: formData.message || null,
          source: 'website'
        })
      })
      if (!res.ok) throw new Error('Request failed')
      setFormState('success')
    } catch {
      setFormState('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
      {/* == NAV == */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300`}
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
            <a href="#demo" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>Map Demo</a>
            <a href="#tourbook-demo" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>Tour Book</a>
            <a href="#ai-chat" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>AI Chat</a>
            <a href="#commute-demo" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>Commute</a>
            <a href="#problem" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>The Problem</a>
            <a href="#analysis" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>Analysis</a>
            <a href="#features" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }} onMouseEnter={e => (e.target as HTMLElement).style.color = '#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color = '#475569'}>Features</a>
            <Link href="/investors" className="text-sm font-medium no-underline transition-colors" style={{ color: '#475569' }}>Investors</Link>
            <Link
              href="/login?signup=true"
              className="font-semibold text-sm no-underline transition-all"
              style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '0.5rem 1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}
            >
              Create Account
            </Link>
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
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Map Demo</a>
              <a href="#tourbook-demo" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Tour Book</a>
              <a href="#ai-chat" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>AI Chat</a>
              <a href="#commute-demo" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Commute</a>
              <a href="#problem" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>The Problem</a>
              <a href="#analysis" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Analysis</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-base no-underline" style={{ color: '#475569' }}>Features</a>
              <Link href="/investors" className="text-base no-underline" style={{ color: '#475569' }}>Investors</Link>
              <Link href="/login?signup=true" className="text-center font-semibold text-sm no-underline" style={{ backgroundColor: '#ffffff', color: '#0f172a', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', marginTop: '0.5rem' }}>Create Account</Link>
              <Link href="/login" className="text-center font-semibold text-sm no-underline" style={{ backgroundColor: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '0.75rem' }}>Sign In</Link>
            </div>
          </div>
        )}
      </nav>

      {/* == HERO == */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #0a0f1a 100%)', paddingTop: 'calc(80px + 5rem)', paddingBottom: '4rem' }}>
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
            <span className="rounded-full bg-green-500" style={{ width: '6px', height: '6px', animation: 'pulse 2s infinite' }} />
            Now in private beta
          </div>

          <h1 className="font-extrabold text-white" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 1rem + 4vw, 4.5rem)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1.5rem', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
            AI-powered intelligence for every{' '}
            <span style={{ color: '#2563eb' }}>
              commercial real estate tour
            </span>
          </h1>

          <p style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', color: '#94a3b8', maxWidth: '640px', margin: '0 auto 2.5rem auto', lineHeight: 1.5 }}>
            Upload a broker survey PDF. Get an interactive map, GAAP-compliant financials, commute studies, and an AI assistant that knows every building, deal term, and dollar amount in your project.
          </p>

          {/* CTAs */}
          <div className="flex justify-center flex-wrap" style={{ gap: '1rem', marginBottom: '4rem' }}>
            <a
              href="#contact"
              className="inline-flex items-center font-semibold no-underline transition-all"
              style={{ gap: '0.5rem', backgroundColor: '#2563eb', color: '#ffffff', padding: '0.75rem 2rem', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', border: 'none', cursor: 'pointer' }}
            >
              Request Demo
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
            <Link
              href="/login?signup=true"
              className="inline-flex items-center font-semibold no-underline transition-all"
              style={{ gap: '0.5rem', backgroundColor: '#ffffff', color: '#0f172a', padding: '0.75rem 2rem', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', border: 'none', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
              Create Account
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center font-medium no-underline transition-all"
              style={{ gap: '0.5rem', backgroundColor: 'transparent', color: '#cbd5e1', padding: '0.75rem 2rem', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" /></svg>
              See It Live
            </a>
          </div>

          {/* Stats */}
          <div className="flex justify-center flex-wrap" style={{ gap: '3rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { end: 33, label: 'Buildings Mapped' },
              { end: 4, label: 'Shortlisted' },
              { display: '$3.8M', label: 'Total Lease Value Analyzed' },
              { end: 7, label: 'AI-Powered Features' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                {'end' in s && s.end !== undefined ? (
                  <Counter end={s.end} />
                ) : (
                  <div className="text-[clamp(2rem,1.5rem+2vw,3.5rem)] font-extrabold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {s.display}
                  </div>
                )}
                <div className="text-xs font-medium uppercase" style={{ color: '#94a3b8', marginTop: '0.25rem', letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == LIVE DEMO (Map) == */}
      <section id="demo" style={{ padding: '5rem 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Live Demo
          </span>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Interactive Survey Map
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: 1.6 }}>
            A real output from a 129-page broker survey. Every building geocoded, categorized, and linked back to the source document. Hover to explore. Click &quot;Tour List&quot; to start building your shortlist right from the map.
          </p>

          {/* Browser frame */}
          <div
            className="overflow-hidden bg-white"
            style={{
              borderRadius: isFullscreen ? 0 : '1.25rem',
              boxShadow: isFullscreen ? 'none' : '0 24px 48px rgba(0,0,0,0.16)',
              border: isFullscreen ? 'none' : '1px solid #e2e8f0',
              ...(isFullscreen ? { position: 'fixed' as const, top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, borderRadius: 0 } : {}),
            }}
          >
            {/* Chrome bar */}
            <div className="flex items-center" style={{
              gap: '0.5rem',
              padding: '0.75rem 1rem',
              background: isFullscreen ? '#0f172a' : '#f1f5f9',
              borderBottom: isFullscreen ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
            }}>
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#ef4444' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#f59e0b' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#22c55e' }} />
              <span className="flex-1 text-xs" style={{
                marginLeft: '1rem',
                background: isFullscreen ? 'rgba(255,255,255,0.08)' : '#fff',
                borderRadius: '0.5rem',
                padding: '0.25rem 0.75rem',
                color: isFullscreen ? '#cbd5e1' : '#94a3b8',
                border: isFullscreen ? '1px solid rgba(255,255,255,0.15)' : '1px solid #e2e8f0',
              }}>
                tourlytics.ai/projects/sf-office-search/map
              </span>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center cursor-pointer"
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: isFullscreen ? '1px solid rgba(255,255,255,0.2)' : '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  padding: '0.25rem 0.75rem',
                  fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
                  fontWeight: 500,
                  color: isFullscreen ? 'rgba(255,255,255,0.7)' : '#64748b',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
                title="Toggle fullscreen"
              >
                {isFullscreen ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                )}
                <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
              </button>
            </div>
            {/* iframe */}
            <iframe
              src="/app/index.html"
              loading="lazy"
              title="SF Office Search Map Demo"
              style={{
                width: '100%',
                height: isFullscreen ? 'calc(100vh - 44px)' : '80vh',
                minHeight: isFullscreen ? 'unset' : '600px',
                border: 'none',
                display: 'block',
              }}
            />
          </div>
          <div className="flex items-center" style={{ gap: '0.5rem', marginTop: '1rem', fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', color: '#94a3b8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            Live interactive map - hover buildings for deal terms, click names to jump to the survey PDF, and build your tour list directly from the map
          </div>
        </div>
      </section>

      {/* == TOUR BOOK DEMO == */}
      <section id="tourbook-demo" style={{ padding: '0 0 5rem 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Live Demo
          </span>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Digital Tour Book
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: 1.6 }}>
            Score every space during the tour. Rate location, price, parking, natural light, and more. Add notes and photos from your phone. When you&apos;re done, export a ranked report instead of flipping through paper folders.
          </p>

          {/* Tour Book Demo Frame */}
          <div className="bg-white overflow-hidden" style={{ borderRadius: '1.25rem', boxShadow: '0 24px 48px rgba(0,0,0,0.16)', border: '1px solid #e2e8f0' }}>
            {/* Chrome bar */}
            <div className="flex items-center" style={{ gap: '0.5rem', padding: '0.75rem 1rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#ef4444' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#f59e0b' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#22c55e' }} />
              <span className="flex-1 text-xs" style={{ marginLeft: '1rem', background: '#fff', borderRadius: '0.5rem', padding: '0.25rem 0.75rem', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                tourlytics.ai/projects/sf-office-search/tourbook
              </span>
            </div>

            {/* Tour Book Content */}
            <div style={{ padding: '2rem' }}>
              {/* Building Header */}
              <div className="flex items-center flex-wrap" style={{ gap: '1rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                <div className="flex items-center justify-center rounded-full font-bold text-white" style={{ width: '40px', height: '40px', background: '#f47920', fontSize: '1rem', flexShrink: 0 }}>1</div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', color: '#0f172a' }}>250 Brannan</h3>
                  <div className="text-sm" style={{ color: '#94a3b8', marginTop: '2px' }}>Suite 3B, Partial 3rd Floor &middot; 16,000 RSF</div>
                  <div className="flex" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span className="font-semibold uppercase" style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.7rem', letterSpacing: '0.04em', background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>Negotiating</span>
                    <span className="font-semibold uppercase" style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.7rem', letterSpacing: '0.04em', background: 'rgba(244,121,32,0.12)', color: '#f47920' }}>Shortlisted</span>
                  </div>
                </div>
                <div className="flex flex-col items-center" style={{ padding: '0.75rem 1.25rem', background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)', borderRadius: '0.75rem', border: '1px solid rgba(244,121,32,0.2)' }}>
                  <div className="font-extrabold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.75rem, 1.5rem + 1vw, 2.25rem)', color: '#f47920', lineHeight: 1 }}>4.1</div>
                  <div className="font-semibold uppercase" style={{ fontSize: '0.65rem', letterSpacing: '0.08em', color: '#94a3b8', marginTop: '2px' }}>Overall</div>
                </div>
              </div>

              {/* Score Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '1rem', marginBottom: '2rem' }}>
                {[
                  { icon: '\u{1F4CD}', label: 'Location', stars: 5, score: 5 },
                  { icon: '\u{1F4B0}', label: 'Price', stars: 3, score: 3 },
                  { icon: '\u{1F17F}\uFE0F', label: 'Parking', stars: 4, score: 4 },
                  { icon: '\u{1F512}', label: 'Security', stars: 5, score: 5 },
                  { icon: '\u{1F3D7}\uFE0F', label: 'Interior Fit Out', stars: 4, score: 4 },
                  { icon: '\u{1FA91}', label: 'Furniture / Vibe', stars: 3, score: 3 },
                  { icon: '\u2600\uFE0F', label: 'Natural Light', stars: 5, score: 5 },
                  { icon: '\u{1F3EA}', label: 'Amenities', stars: 4, score: 4 },
                  { icon: '\u2728', label: 'Overall Feel', stars: 4, score: 4 },
                  { icon: '\u{1F3AF}', label: 'The Davis Effect', stars: 4, score: 4, special: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center" style={{
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: item.special ? 'linear-gradient(135deg, #fef3c7 0%, #fefce8 100%)' : '#f8fafc',
                    borderRadius: '0.75rem',
                    border: item.special ? '1px solid rgba(245,158,11,0.2)' : '1px solid #f1f5f9',
                  }}>
                    <span style={{ width: '28px', textAlign: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{item.icon}</span>
                    <span className="text-sm" style={{ fontWeight: item.special ? 600 : 500, color: '#334155', flex: 1 }}>{item.label}</span>
                    <StarRating filled={item.stars} />
                    <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#0f172a', minWidth: '28px', textAlign: 'right' }}>{item.score}</span>
                  </div>
                ))}
              </div>

              {/* Notes & Photos Row */}
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.5rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <h4 className="flex items-center text-sm font-semibold" style={{ color: '#334155', marginBottom: '0.75rem', gap: '0.5rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    Tour Notes
                  </h4>
                  <div className="text-sm" style={{ background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', padding: '1rem', color: '#475569', lineHeight: 1.65, minHeight: '120px' }}>
                    Great natural light on the 3rd floor, especially the south-facing windows. Existing furniture from Splunk is in solid condition and included in the sublease. Loading dock access is a plus. Parking garage entrance is tight but workable. Lobby recently renovated. Walking distance to Caltrain. Conference rooms need minor updating but layout works well for our team size.
                  </div>
                </div>
                <div>
                  <h4 className="flex items-center text-sm font-semibold" style={{ color: '#334155', marginBottom: '0.75rem', gap: '0.5rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    Tour Photos
                  </h4>
                  <div className="grid grid-cols-3" style={{ gap: '0.5rem' }}>
                    {['Lobby', 'Open Floor', 'Conference', 'Kitchen', 'Views', 'Parking'].map((label) => (
                      <div key={label} className="flex flex-col items-center justify-center" style={{ aspectRatio: '4/3', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9', color: '#cbd5e1', fontSize: '0.65rem', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em', gap: '4px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ranking Strip */}
              <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                <h4 className="flex items-center text-sm font-semibold" style={{ color: '#334155', marginBottom: '1rem', gap: '0.5rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4" /></svg>
                  Tour Ranking
                </h4>
                <div className="flex flex-col" style={{ gap: '0.5rem' }}>
                  {[
                    { pos: 1, name: '250 Brannan', score: '4.1', width: '82%', first: true },
                    { pos: 2, name: '123 Townsend', score: '3.6', width: '72%', first: false },
                    { pos: 3, name: '301 Brannan', score: '3.2', width: '64%', first: false },
                  ].map((item) => (
                    <div key={item.pos} className="flex items-center" style={{
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: item.first ? 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)' : '#f8fafc',
                      border: item.first ? '1px solid rgba(244,121,32,0.25)' : '1px solid #f1f5f9',
                    }}>
                      <div className="flex items-center justify-center rounded-full font-bold" style={{ width: '28px', height: '28px', fontSize: '0.75rem', flexShrink: 0, background: item.first ? '#f47920' : '#e2e8f0', color: item.first ? '#fff' : '#475569' }}>{item.pos}</div>
                      <span className="text-sm font-semibold" style={{ color: '#1e293b', flex: 1 }}>{item.name}</span>
                      <div style={{ width: '80px', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '3px', width: item.width, background: item.first ? '#f47920' : item.pos === 2 ? '#94a3b8' : '#cbd5e1' }} />
                      </div>
                      <span className="font-bold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#0f172a', minWidth: '36px', textAlign: 'right' }}>{item.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center" style={{ gap: '0.5rem', marginTop: '1rem', fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', color: '#94a3b8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            Score from your phone during the tour. Notes, photos, and rankings sync automatically and export to PDF or CSV.
          </div>
        </div>
      </section>

      {/* == AI CHAT ASSISTANT DEMO == */}
      <section id="ai-chat" style={{ padding: '5rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            AI-Powered
          </span>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Ask your data anything
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', marginBottom: '2.5rem', maxWidth: '600px', lineHeight: 1.6 }}>
            Every project comes with an AI assistant that has deep knowledge of all your buildings, deal terms, financials, and tour schedule. Ask it to compare buildings, find nearby restaurants, calculate walking times between tours, or break down your lease costs.
          </p>

          {/* Chat mockup */}
          <div className="bg-white overflow-hidden" style={{ borderRadius: '1.25rem', boxShadow: '0 24px 48px rgba(0,0,0,0.16)', border: '1px solid #e2e8f0', maxWidth: '720px' }}>
            {/* Chrome bar */}
            <div className="flex items-center" style={{ gap: '0.5rem', padding: '0.75rem 1rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#ef4444' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#f59e0b' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#22c55e' }} />
              <span className="flex-1 text-xs" style={{ marginLeft: '1rem', background: '#fff', borderRadius: '0.5rem', padding: '0.25rem 0.75rem', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                tourlytics.ai/projects/sf-office-search/chat
              </span>
            </div>

            {/* Chat messages */}
            <div style={{ background: '#0f172a', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* User message 1 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#2563eb', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '1rem 1rem 0.25rem 1rem', maxWidth: '80%', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  Compare 250 Brannan and 123 Townsend on total cost
                </div>
              </div>

              {/* AI response 1 */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z" /><path d="M8.5 14.5A9 9 0 003 21h18a9 9 0 00-5.5-6.5" /></svg>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', padding: '0.75rem 1rem', borderRadius: '0.25rem 1rem 1rem 1rem', maxWidth: '85%', fontSize: '0.875rem', lineHeight: 1.65 }}>
                  <strong style={{ color: '#ffffff' }}>250 Brannan</strong> comes in at <strong style={{ color: '#22c55e' }}>$106,594/mo all-in</strong> ($56,594 rent + $50,000 OpEx). That&apos;s $79.95/RSF/yr for 16,000 SF.<br /><br />
                  <strong style={{ color: '#ffffff' }}>123 Townsend</strong> would run about <strong style={{ color: '#f59e0b' }}>$218,147/mo all-in</strong> ($168,147 rent + $50,000 OpEx). That&apos;s 23,031 SF at a higher rate.<br /><br />
                  250 Brannan saves you roughly <strong style={{ color: '#22c55e' }}>$111,553/month</strong>, or about $1.34M per year. The sublease structure and included furniture make it significantly more cost-effective.
                </div>
              </div>

              {/* User message 2 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: '#2563eb', color: '#ffffff', padding: '0.75rem 1rem', borderRadius: '1rem 1rem 0.25rem 1rem', maxWidth: '80%', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  Find coffee shops near my first tour and how long to walk to the second one
                </div>
              </div>

              {/* AI response 2 */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M12 2a4 4 0 014 4c0 1.95-2 4-4 6-2-2-4-4.05-4-6a4 4 0 014-4z" /><path d="M8.5 14.5A9 9 0 003 21h18a9 9 0 00-5.5-6.5" /></svg>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0', padding: '0.75rem 1rem', borderRadius: '0.25rem 1rem 1rem 1rem', maxWidth: '85%', fontSize: '0.875rem', lineHeight: 1.65 }}>
                  Your first tour is at <strong style={{ color: '#ffffff' }}>250 Brannan</strong>. Here are the top coffee spots nearby:<br /><br />
                  &#9749; <strong>Sightglass</strong> (4.5 stars, 2 min walk) - 270 7th St<br />
                  &#9749; <strong>Philz Coffee</strong> (4.4 stars, 4 min walk) - 201 Berry St<br />
                  &#9749; <strong>Equator Coffees</strong> (4.3 stars, 5 min walk) - 986 Market St<br /><br />
                  From 250 Brannan to your second tour at <strong style={{ color: '#ffffff' }}>301 Brannan</strong>, it&apos;s a <strong style={{ color: '#22c55e' }}>3-minute walk</strong> (0.1 miles). You can easily grab coffee and make it with time to spare.
                </div>
              </div>
            </div>

            {/* Fake input bar */}
            <div style={{ padding: '0.75rem 1rem', background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '0.625rem 1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: '#475569', fontSize: '0.875rem' }}>
                Ask about buildings, costs, tours, nearby places...
              </div>
              <div style={{ width: '36px', height: '36px', borderRadius: '0.625rem', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </div>
            </div>
          </div>

          {/* Capability chips */}
          <div className="flex flex-wrap" style={{ gap: '0.5rem', marginTop: '1.5rem' }}>
            {['Financial comparisons', 'Nearby places (Google Places)', 'Walking & driving times', 'Tour schedule awareness', 'Lease term breakdowns', 'Building specifications', 'Commute analysis', 'Photo AI tagging'].map((cap) => (
              <span key={cap} className="text-xs font-medium" style={{ padding: '0.375rem 0.75rem', background: '#f1f5f9', color: '#475569', borderRadius: '1.25rem', border: '1px solid #e2e8f0' }}>
                {cap}
              </span>
            ))}
          </div>

          <div className="flex items-center" style={{ gap: '0.5rem', marginTop: '1rem', fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', color: '#94a3b8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            Powered by Claude AI with real-time Google Maps and Places integration. Every answer is grounded in your actual project data.
          </div>
        </div>
      </section>

      {/* == COMMUTE STUDY DEMO == */}
      <section id="commute-demo" style={{ padding: '5rem 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Commute Intelligence
          </span>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Where should your team actually work?
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', marginBottom: '2.5rem', maxWidth: '640px', lineHeight: 1.6 }}>
            Upload your employee home addresses. Tour-Lytics maps commute times to every shortlisted building - transit, driving, and biking. Know which office minimizes your team&apos;s commute before you sign.
          </p>

          {/* Commute Study Mockup */}
          <div className="bg-white overflow-hidden" style={{ borderRadius: '1.25rem', boxShadow: '0 24px 48px rgba(0,0,0,0.16)', border: '1px solid #e2e8f0', maxWidth: '720px' }}>
            {/* Chrome bar */}
            <div className="flex items-center" style={{ gap: '0.5rem', padding: '0.75rem 1rem', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#ef4444' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#f59e0b' }} />
              <span className="rounded-full" style={{ width: '10px', height: '10px', background: '#22c55e' }} />
              <span className="flex-1 text-xs" style={{ marginLeft: '1rem', background: '#fff', borderRadius: '0.5rem', padding: '0.25rem 0.75rem', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                tourlytics.ai/app - Commute Study
              </span>
            </div>
            {/* Dark header */}
            <div style={{ background: '#0f172a', padding: '1.25rem 1.5rem' }}>
              <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
                <span className="font-bold text-white" style={{ fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}>Commute Study - SF Office Search</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>24 employees analyzed across 3 buildings</span>
            </div>
            {/* Building commute results */}
            <div style={{ padding: '1.25rem 1.5rem' }}>
              {[
                { name: '250 Brannan', avg: 28, best: true },
                { name: '475 Brannan', avg: 31, best: false },
                { name: '301 Brannan', avg: 34, best: false },
              ].map((b) => (
                <div key={b.name} style={{ padding: '0.875rem 1rem', marginBottom: '0.625rem', borderRadius: '0.75rem', border: b.best ? '1.5px solid #22c55e' : '1px solid #e2e8f0', background: b.best ? '#f0fdf4' : '#ffffff' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '0.5rem' }}>
                    <div className="flex items-center" style={{ gap: '0.5rem' }}>
                      <span className="font-semibold text-sm" style={{ color: '#0f172a' }}>{b.name}</span>
                      {b.best && <span className="text-xs font-semibold" style={{ color: '#16a34a', background: '#dcfce7', padding: '0.125rem 0.5rem', borderRadius: '1rem' }}>Best Commute</span>}
                    </div>
                    <span className="font-bold" style={{ color: b.best ? '#16a34a' : '#0f172a', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}>Avg {b.avg} min</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((b.avg / 45) * 100)}%`, height: '100%', background: b.best ? '#22c55e' : '#2563eb', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}

              {/* Transit mode breakdown */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <div className="font-semibold text-xs" style={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Transit Mode Breakdown
                </div>
                {[
                  { mode: 'Transit', pct: 45, color: '#2563eb' },
                  { mode: 'Driving', pct: 30, color: '#f59e0b' },
                  { mode: 'Biking', pct: 15, color: '#22c55e' },
                  { mode: 'Walking', pct: 10, color: '#8b5cf6' },
                ].map((m) => (
                  <div key={m.mode} className="flex items-center" style={{ gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span className="text-xs" style={{ width: '50px', color: '#64748b', flexShrink: 0 }}>{m.mode}</span>
                    <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${m.pct}%`, height: '100%', background: m.color, borderRadius: '4px' }} />
                    </div>
                    <span className="font-semibold text-xs" style={{ color: '#0f172a', width: '32px', textAlign: 'right' }}>{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center" style={{ gap: '0.5rem', marginTop: '1.5rem', fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', color: '#94a3b8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            Upload a CSV of employee addresses. Results show average commute by transit, driving, and biking for each shortlisted building.
          </div>
        </div>
      </section>

      {/* == THE SOLUTION == */}
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

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1.5rem' }}>
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
                desc: 'Score, rank, and coordinate building tours with your entire team. Upload photos from your phone and let AI tag and organize them automatically.',
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
                desc: 'An AI assistant built into every project. Ask it to compare buildings on cost, find coffee shops near your next tour, calculate walking times between buildings, or break down your lease terms. Connected to Google Maps and Google Places for real-time local intelligence.',
                accent: '#ede9fe',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="10" r="3" />
                    <path d="M12 2a8 8 0 00-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 00-8-8z" />
                    <path d="M3 21h18" />
                  </svg>
                ),
                title: 'Commute Intelligence',
                desc: 'Upload employee addresses, map commute times to every shortlisted building, and see transit, driving, and biking breakdowns. Know where your team should actually work.',
                accent: '#fce7f3',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                ),
                title: 'Survey Upload & Merge',
                desc: 'Upload new broker surveys directly into the platform. AI extracts every building and merges it with your existing map automatically.',
                accent: '#f0fdf4',
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
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{ width: '48px', height: '48px', borderRadius: '0.75rem', background: card.accent, marginBottom: '1.25rem' }}
                >
                  {card.icon}
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#0f172a', marginBottom: '0.5rem' }}>
                  {card.title}
                </h3>
                <p className="text-sm" style={{ color: '#64748b', lineHeight: 1.6 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == HOW IT WORKS == */}
      <section id="how" style={{ padding: '6rem 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              How It Works
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em' }}>
              From PDF to insight in 3 steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 relative" style={{ gap: '2rem' }}>
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute" style={{ top: '40px', left: '16.67%', right: '16.67%', height: '2px', background: '#e2e8f0', zIndex: 0 }} />
            {[
              { num: '1', title: 'Upload Your Survey', desc: 'Drop in any broker survey or tour book PDF - Savills, CBRE, JLL, Cushman, or custom formats. Our AI reads every page.' },
              { num: '2', title: 'Auto-Extract & Map', desc: 'Buildings are identified, addresses geocoded, and deal terms pulled automatically. Your interactive map generates in minutes.' },
              { num: '3', title: 'Analyze & Share', desc: 'Build your tour list right from the map. Upload RFPs or LOIs for instant financial analysis. Ask the AI assistant anything about your buildings, costs, or tours. Share everything with stakeholders via a single link.' },
            ].map((step) => (
              <div key={step.num} className="relative z-10 text-center" style={{ padding: '1.5rem' }}>
                <div className="flex items-center justify-center rounded-full text-white font-bold" style={{ width: '56px', height: '56px', background: '#2563eb', fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', margin: '0 auto 1.5rem auto', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                  {step.num}
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', color: '#0f172a', marginBottom: '0.75rem' }}>{step.title}</h3>
                <p className="text-sm" style={{ color: '#64748b', margin: '0 auto', maxWidth: '72ch' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == THE PROBLEM == */}
      <section id="problem" style={{ padding: '6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          {/* Narrative */}
          <div style={{ maxWidth: '780px' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              The Problem
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
              Commercial real estate decisions<br />still run on PDFs.
            </h2>
            <p className="font-medium" style={{ fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', color: '#475569', lineHeight: 1.4, marginBottom: '1.25rem' }}>
              Every corporate lease transaction follows the same broken workflow: a broker sends a static PDF survey, the tenant manually re-keys data into spreadsheets, and million-dollar decisions get made off disjointed files and email threads.
            </p>
            <p style={{ color: '#64748b', lineHeight: 1.7 }}>
              There is no map, no sorting, no filtering. Commute studies require outside consultants. Financial models get rebuilt from scratch every time. Tour notes are handwritten on paper folders. And at the end of it all, the final decision often comes down to gut feel instead of structured intelligence.
            </p>
            <p style={{ color: '#64748b', lineHeight: 1.7, marginTop: '1rem' }}>
              Tour-Lytics replaces this entire workflow. Upload a broker survey PDF and get an interactive map with every building. Generate GAAP-compliant financials the moment a deal lands. Run commute studies in seconds instead of weeks. Score buildings during the tour from your phone. And ask an AI assistant anything about your buildings, costs, or schedule. From broker survey to signed lease, every step lives in one place.
            </p>
          </div>

          {/* Problem / Solution Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1.5rem', marginTop: '3rem' }}>
            {/* Problem Card */}
            <div style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid #fecaca', background: '#fef2f2' }}>
              <div className="inline-flex items-center justify-center rounded-full font-bold" style={{ width: '28px', height: '28px', background: '#fee2e2', color: '#dc2626', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', marginBottom: '0.75rem' }}>&#x2717;</div>
              <h4 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#991b1b', marginBottom: '0.75rem' }}>What surveys look like today</h4>
              <ul className="flex flex-col" style={{ listStyle: 'none', padding: 0, gap: '0.5rem' }}>
                {[
                  'A static 129-page PDF',
                  'No map, no sorting, no filtering',
                  "Can't build a tour list",
                  'Paper tour folders and handwritten notes',
                  'Commute studies require outside consultants',
                  'No cash flow or GAAP financials included',
                ].map((item) => (
                  <li key={item} className="text-sm relative" style={{ color: '#64748b', paddingLeft: '1.25rem' }}>
                    <span className="absolute rounded-full" style={{ left: 0, top: '7px', width: '8px', height: '8px', background: '#fca5a5' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Solution Card */}
            <div style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
              <div className="inline-flex items-center justify-center rounded-full font-bold" style={{ width: '28px', height: '28px', background: '#dcfce7', color: '#16a34a', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', marginBottom: '0.75rem' }}>&#x2713;</div>
              <h4 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#166534', marginBottom: '0.75rem' }}>What Tour-Lytics gives you</h4>
              <ul className="flex flex-col" style={{ listStyle: 'none', padding: 0, gap: '0.5rem' }}>
                {[
                  'Interactive map with every building',
                  'Click any name \u2192 jump to survey page',
                  'Build your tour list from the map',
                  'Tour Book with scores, photos, and notes',
                  'Commute analysis in seconds, not weeks',
                  'Monthly cash flow & GAAP P&L',
                  'AI assistant that answers questions about any building or deal',
                  'Upload new surveys directly to the map',
                ].map((item) => (
                  <li key={item} className="text-sm relative" style={{ color: '#64748b', paddingLeft: '1.25rem' }}>
                    <span className="absolute rounded-full" style={{ left: 0, top: '7px', width: '8px', height: '8px', background: '#86efac' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* == BROKERS NEED THIS TOO == */}
      <section id="brokers" style={{ padding: '4rem 0 6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 items-center" style={{ gap: '3rem' }}>
            <div>
              <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#b45309', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                Built for the whole team
              </span>
              <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '1rem' }}>
                Brokers are in the driver&apos;s seat.
              </h2>
              <p className="font-medium" style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
                Every great deal starts with a great broker. But the tools they work with haven&apos;t kept up. Every survey is still assembled from scratch: gathering listings, formatting pages, printing decks, emailing them out, and hoping someone reads past page three.
              </p>
              <p style={{ color: '#64748b', lineHeight: 1.7 }}>
                Tour-Lytics gives brokers a better way to deliver. Publish an interactive survey instead of a static PDF. See which buildings your clients actually explored. Upload new surveys and proposals directly into the platform. Move faster, present better, and give your clients the kind of experience that wins the next engagement.
              </p>
            </div>
            <div className="flex flex-col" style={{ gap: '1rem' }}>
              {/* Amber Card */}
              <div style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid #fde68a', background: '#fffbeb' }}>
                <div className="inline-flex items-center justify-center rounded-full font-bold" style={{ width: '28px', height: '28px', background: '#fef3c7', color: '#b45309', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', marginBottom: '0.75rem' }}>!</div>
                <h4 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#92400e', marginBottom: '0.75rem' }}>The broker experience today</h4>
                <ul className="flex flex-col" style={{ listStyle: 'none', padding: 0, gap: '0.5rem' }}>
                  {[
                    'Build surveys from scratch every time',
                    'Print, bind, ship, and email PDFs',
                    'No idea what clients looked at',
                    'Competing on speed without the right tools',
                    'Clients expect more - hard to deliver with PDFs',
                  ].map((item) => (
                    <li key={item} className="text-sm relative" style={{ color: '#64748b', paddingLeft: '1.25rem' }}>
                      <span className="absolute rounded-full" style={{ left: 0, top: '7px', width: '8px', height: '8px', background: '#fcd34d' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Green Card */}
              <div style={{ padding: '1.5rem', borderRadius: '1rem', border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
                <div className="inline-flex items-center justify-center rounded-full font-bold" style={{ width: '28px', height: '28px', background: '#dcfce7', color: '#16a34a', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', marginBottom: '0.75rem' }}>&#x2713;</div>
                <h4 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#166534', marginBottom: '0.75rem' }}>What Tour-Lytics gives brokers</h4>
                <ul className="flex flex-col" style={{ listStyle: 'none', padding: 0, gap: '0.5rem' }}>
                  {[
                    'Publish interactive surveys instantly',
                    'Client engagement analytics',
                    'Branded, professional deliverables',
                    'Stand out in competitive pitches',
                    'Better alignment to client needs',
                    'Upload surveys directly into the platform',
                  ].map((item) => (
                    <li key={item} className="text-sm relative" style={{ color: '#64748b', paddingLeft: '1.25rem' }}>
                      <span className="absolute rounded-full" style={{ left: 0, top: '7px', width: '8px', height: '8px', background: '#86efac' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* == FINANCIAL ANALYSIS ENGINE == */}
      <section id="analysis" style={{ padding: '6rem 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Financial Analysis Engine
          </span>
          <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Upload an RFP. Get CFO-ready financials.
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#64748b', marginBottom: '2.5rem', maxWidth: '640px', lineHeight: 1.6 }}>
            Drop in any broker proposal, RFP, or LOI. Tour-Lytics builds the full financial model automatically - cash flow, straight-line P&amp;L, GAAP format, deal comparisons. Set independent assumptions per building, factor in TI allowances, and model different OpEx scenarios. The spreadsheet your finance team has been building by hand.
          </p>

          {/* Financial Demo Card */}
          <div className="bg-white overflow-hidden" style={{ borderRadius: '1.25rem', boxShadow: '0 12px 32px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0' }}>
            {/* Dark Header */}
            <div className="flex items-start justify-between flex-wrap" style={{ background: '#0f172a', padding: '1.5rem 2rem', gap: '1rem' }}>
              <div>
                <div className="font-bold text-white" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)' }}>250 Brannan Street - Lease Analysis</div>
                <div className="text-sm" style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Sample Client | 16,000 RSF | 63-Month Sublease | Modified Gross</div>
              </div>
              <div className="flex items-center font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '0.25rem 0.75rem', borderRadius: '1.25rem', fontSize: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', gap: '0.25rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                Best Value
              </div>
            </div>

            {/* Tabs */}
            <div className="flex" style={{ borderBottom: '2px solid #e2e8f0', padding: '0 1.5rem' }}>
              {[
                { key: 'comparison' as const, label: 'Deal Comparison' },
                { key: 'cashflow' as const, label: 'Cash Flow' },
                { key: 'straightline' as const, label: 'Straight-Line P&L' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFinTab(tab.key)}
                  className="font-semibold cursor-pointer relative"
                  style={{
                    padding: '0.75rem 1.25rem',
                    fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
                    color: activeFinTab === tab.key ? '#2563eb' : '#94a3b8',
                    background: 'none',
                    border: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                  {activeFinTab === tab.key && (
                    <span className="absolute" style={{ bottom: '-2px', left: 0, right: 0, height: '2px', background: '#2563eb' }} />
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Deal Comparison */}
            {activeFinTab === 'comparison' && (
              <div>
                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4" style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {[
                    { label: 'Base Rent', value: '$43', unit: '/RSF/yr' },
                    { label: 'Effective Rent (GAAP)', value: '$42.45', unit: '/RSF/yr' },
                    { label: 'All-In Occupancy', value: '$79.95', unit: '/RSF/yr' },
                    { label: 'Free Rent Value', value: '$287K', unit: '' },
                  ].map((kpi, i) => (
                    <div key={kpi.label} className="text-center" style={{ padding: '1.25rem 1.5rem', borderRight: i < 3 ? '1px solid #e2e8f0' : 'none' }}>
                      <div className="text-xs font-medium uppercase" style={{ color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{kpi.label}</div>
                      <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem)', color: '#0f172a' }}>
                        {kpi.value}{kpi.unit && <span style={{ fontSize: '0.5em', fontWeight: 400, color: '#64748b' }}>{kpi.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison Table */}
                <div style={{ padding: '1.5rem 2rem', overflowX: 'auto' }}>
                  <h4 className="font-bold uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#0f172a', marginBottom: '1rem', letterSpacing: '0.04em' }}>
                    Deal Comparison - 5-Year Total Occupancy Cost
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}>
                    <thead>
                      <tr>
                        <th className="text-left font-semibold uppercase text-xs" style={{ padding: '0.75rem 1rem', color: '#64748b', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '25%' }}>Metric</th>
                        <th className="text-left font-semibold uppercase text-xs" style={{ padding: '0.75rem 1rem', color: '#2563eb', letterSpacing: '0.04em', borderBottom: '2px solid #2563eb', width: '25%', background: 'rgba(37,99,235,0.04)' }}>Option A - Sublease ($43)</th>
                        <th className="text-left font-semibold uppercase text-xs" style={{ padding: '0.75rem 1rem', color: '#64748b', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '25%' }}>Option B - Sublease ($49.50)</th>
                        <th className="text-left font-semibold uppercase text-xs" style={{ padding: '0.75rem 1rem', color: '#64748b', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', width: '25%' }}>Option C - Direct ($64)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { metric: 'Structure', a: 'Sublease', b: 'Sublease', c: 'Direct Lease' },
                        { metric: 'Premises (RSF)', a: '16,000', b: '16,000', c: '23,031' },
                        { metric: 'Free Rent', a: '5 months', b: '3 months', c: '5 mo + 3.75 TI' },
                        { metric: 'TI Allowance', a: 'None (turnkey)', b: 'None (turnkey)', c: '$20/RSF ($461K)' },
                        { metric: 'Escalation', a: '3%/yr', b: '3%/yr', c: '3%/yr' },
                        { metric: 'Total Rent (63 mo)', a: '$3.57M', b: '$4.24M', c: '$7.40M', bold: true },
                        { metric: 'Total Occupancy', a: '$6.67M', b: '$7.34M', c: '$10.50M', bold: true },
                        { metric: 'All-In $/RSF/yr', a: '$79.35', b: '$87.34', c: '$84.18', bold: true },
                      ].map((row, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{row.metric}</td>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', background: 'rgba(37,99,235,0.04)', fontWeight: row.bold ? 600 : 400 }}>{row.a}</td>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{row.b}</td>
                          <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{row.c}</td>
                        </tr>
                      ))}
                      {/* Savings row */}
                      <tr>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#334155', background: '#dcfce7' }}>Savings vs. Option C</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#22c55e', background: '#dcfce7' }}>$3.84M (36.5%)</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#22c55e', background: '#dcfce7' }}>$3.16M (30.1%)</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#22c55e', background: '#dcfce7' }}>-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab: Cash Flow */}
            {activeFinTab === 'cashflow' && (
              <div style={{ padding: '1.5rem 2rem', overflowX: 'auto', position: 'relative' }}>
                <h4 className="font-bold uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#0f172a', marginBottom: '1rem', letterSpacing: '0.04em' }}>
                  Monthly Cash Flow Schedule (First 18 Months)
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}>
                  <thead>
                    <tr>
                      {['Period', 'Yr', 'Base Rent', 'Free Rent', 'Net Cash Rent', 'Cumulative'].map((h) => (
                        <th key={h} className="text-left font-semibold uppercase text-xs" style={{ padding: '0.75rem 1rem', color: '#64748b', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { period: 'Jun 2026', yr: '1', base: '$57,333', free: '($57,333)', net: '$0', cum: '$0', freeRent: true },
                      { period: 'Jul 2026', yr: '1', base: '$57,333', free: '($57,333)', net: '$0', cum: '$0', freeRent: true },
                      { period: 'Aug 2026', yr: '1', base: '$57,333', free: '($57,333)', net: '$0', cum: '$0', freeRent: true },
                      { period: 'Sep 2026', yr: '1', base: '$57,333', free: '($57,333)', net: '$0', cum: '$0', freeRent: true },
                      { period: 'Oct 2026', yr: '1', base: '$57,333', free: '($57,333)', net: '$0', cum: '$0', freeRent: true },
                      { period: 'Nov 2026', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$57,333', highlight: true },
                      { period: 'Dec 2026', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$114,667' },
                      { period: 'Jan 2027', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$172,000' },
                      { period: 'Feb 2027', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$229,333' },
                      { period: 'Mar 2027', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$286,667' },
                      { period: 'Apr 2027', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$344,000' },
                      { period: 'May 2027', yr: '1', base: '$57,333', free: '-', net: '$57,333', cum: '$401,333' },
                      { period: 'Jun 2027', yr: '2', base: '$59,053', free: '-', net: '$59,053', cum: '$460,387', yr2start: true },
                      { period: 'Jul 2027', yr: '2', base: '$59,053', free: '-', net: '$59,053', cum: '$519,440' },
                      { period: 'Aug 2027', yr: '2', base: '$59,053', free: '-', net: '$59,053', cum: '$578,493' },
                      { period: 'Sep 2027', yr: '2', base: '$59,053', free: '-', net: '$59,053', cum: '$637,547' },
                      { period: 'Oct 2027', yr: '2', base: '$59,053', free: '-', net: '$59,053', cum: '$696,600' },
                      { period: 'Nov 2027', yr: '2', base: '$59,053', free: '-', net: '$59,053', cum: '$755,653' },
                    ].map((row) => (
                      <tr key={row.period} style={{ background: row.yr2start ? '#dbeafe' : row.highlight ? '#f8fafc' : 'transparent' }}>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{row.period}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>{row.yr}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{row.base}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: row.freeRent ? '#22c55e' : '#334155', fontVariantNumeric: 'tabular-nums' }}>{row.free}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{row.net}</td>
                        <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{row.cum}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Fade overlay */}
                <div className="pointer-events-none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, #fff)' }} />
              </div>
            )}

            {/* Tab: Straight-Line P&L */}
            {activeFinTab === 'straightline' && (
              <div style={{ padding: '1.5rem 2rem', overflowX: 'auto' }}>
                <h4 className="font-bold uppercase" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', color: '#0f172a', marginBottom: '1rem', letterSpacing: '0.04em' }}>
                  Straight-Line (GAAP) P&amp;L - By Lease Year
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}>
                  <thead>
                    <tr>
                      {['Category', 'Yr 1', 'Yr 2', 'Yr 3', 'Yr 4', 'Yr 5', 'Total'].map((h) => (
                        <th key={h} className="text-left font-semibold uppercase text-xs" style={{ padding: '0.75rem 1rem', color: '#64748b', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0', fontWeight: h === 'Total' ? 700 : 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>Straight-Line Rent</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$679K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$679K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$679K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$679K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$679K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 700 }}>$3.57M</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>Cash Rent Paid</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$401K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$709K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$730K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$752K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>$774K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 700 }}>$3.57M</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>Deferred Rent (Liability)</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#2563eb' }}>$278K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>($30K)</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>($51K)</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>($73K)</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>($95K)</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 700 }}>$0</td>
                    </tr>
                    <tr style={{ background: '#f8fafc' }}>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600 }}>Total Occupancy</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600 }}>$696K</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600 }}>$1.28M</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600 }}>$1.28M</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600 }}>$1.28M</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 600 }}>$1.28M</td>
                      <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontWeight: 700 }}>$6.67M</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>Per RSF/yr</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>$79.95</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>$79.95</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>$79.95</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>$79.95</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>$79.95</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: 700 }}>$79.35</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="text-xs" style={{ padding: '1rem 2rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', color: '#94a3b8' }}>
              Auto-generated from uploaded RFP/LOI - cash flow, straight-line, and GAAP calculations performed automatically
            </div>
          </div>
        </div>
      </section>

      {/* == PLATFORM FEATURES == */}
      <section id="features" style={{ padding: '6rem 0', background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="text-center" style={{ marginBottom: '3rem' }}>
            <span className="inline-block text-xs font-semibold uppercase" style={{ color: '#2563eb', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Platform Features
            </span>
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', color: '#0f172a', letterSpacing: '-0.02em' }}>
              Built for corporate real estate teams
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '1.5rem' }}>
            {[
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
                title: 'Any Survey Format',
                desc: 'Handles PDFs from Savills, CBRE, JLL, Cushman & Wakefield, Newmark, and custom broker formats.',
                tag: 'AI-Powered Parsing',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>,
                title: 'Interactive Maps',
                desc: 'Every building geocoded with rich tooltips - deal terms, building specs, and direct links to the source survey page.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
                title: 'Tour List + Tour Book',
                desc: "Add buildings to your tour list from the map, then open the Tour Book to score each space on price, parking, interior fit-out, and more. Add photos and notes from your phone during the walk-through. Export a ranked tour report when you're done.",
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
                title: 'Financial Analysis',
                desc: 'Upload an RFP or LOI. Get straight-line rent, occupancy costs, NPV analysis, and side-by-side deal comparisons. Set independent assumptions per building with TI allowance offsets.',
                tag: 'Core Feature',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
                title: 'AI Chat Assistant',
                desc: 'Ask your project anything. Compare buildings, break down lease costs, find nearby restaurants, calculate walking times between tours. Connected to Google Maps and Places for real-time local data.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
                title: 'Team Projects',
                desc: 'Each team member gets their own workspace. Create projects, save maps, and collaborate with your brokerage or client.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>,
                title: 'Shareable Links',
                desc: 'Send clients and executives a single URL to view the interactive map and financials - no login required.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
                title: 'Mobile Ready',
                desc: 'Fully responsive maps and analysis. Pull it up on your phone during a building tour or in a client meeting.',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" /><circle cx="12" cy="10" r="3" /><path d="M7 20h10" /></svg>,
                title: 'Commute Study',
                desc: 'Upload employee home addresses and map commute times to every shortlisted building. Transit, driving, and biking breakdowns help your team pick the office that works for everyone.',
                tag: 'New',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
                title: 'AI Photo Analysis',
                desc: 'Upload tour photos and get AI-powered tagging and organization. Photos are linked to buildings and rooms, searchable by the entire team.',
                tag: 'New',
              },
              {
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
                title: 'Survey Upload',
                desc: 'Upload a new broker survey PDF directly into the platform. AI extracts every building, geocodes addresses, and merges them with your existing map.',
                tag: 'New',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="transition-all"
                style={{ padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '1rem' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#cbd5e1'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              >
                <div className="flex items-center justify-center" style={{ width: '44px', height: '44px', background: '#dbeafe', borderRadius: '0.75rem', color: '#2563eb', marginBottom: '1.25rem' }}>
                  {f.icon}
                </div>
                <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#0f172a', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p className="text-sm" style={{ color: '#64748b' }}>{f.desc}</p>
                {f.tag && (
                  <span className="inline-block text-xs font-semibold" style={{ marginTop: '0.75rem', color: '#2563eb', background: '#dbeafe', padding: '0.25rem 0.75rem', borderRadius: '1.25rem' }}>
                    {f.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* == CTA FORM == */}
      <section id="contact" className="relative overflow-hidden" style={{ padding: '6rem 0', background: '#0f172a', textAlign: 'center' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(37,99,235,0.15) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10" style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <h2 className="font-bold text-white" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 1.2rem + 2.5vw, 3.5rem)', letterSpacing: '-0.02em', marginBottom: '1rem' }}>
            Ready to see your data on a map?
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)', color: '#94a3b8', maxWidth: '500px', margin: '0 auto 2rem auto' }}>
            We&apos;re onboarding select CRE teams for private beta. Tell us about your team and we&apos;ll reach out.
          </p>

          {formState !== 'success' ? (
            <form
              onSubmit={handleDemoRequest}
              className="flex flex-col"
              style={{ maxWidth: '480px', margin: '0 auto', gap: '0.75rem' }}
            >
              <div className="flex flex-col sm:flex-row" style={{ gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Full name"
                  required
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="outline-none"
                  style={{ flex: 1, padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', color: '#fff', fontFamily: 'inherit', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}
                />
                <input
                  type="email"
                  placeholder="Work email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="outline-none"
                  style={{ flex: 1, padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', color: '#fff', fontFamily: 'inherit', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}
                />
              </div>
              <input
                type="text"
                placeholder="Company (optional)"
                value={formData.company}
                onChange={e => setFormData(p => ({ ...p, company: e.target.value }))}
                className="outline-none"
                style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', color: '#fff', fontFamily: 'inherit', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)' }}
              />
              <textarea
                placeholder="Tell us about your use case (optional)"
                value={formData.message}
                onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                className="outline-none"
                style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', color: '#fff', fontFamily: 'inherit', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', resize: 'vertical', minHeight: '80px' }}
              />
              <button
                type="submit"
                disabled={formState === 'sending'}
                className="font-semibold cursor-pointer transition-all"
                style={{ background: '#2563eb', color: '#fff', padding: '1rem 1.5rem', borderRadius: '0.75rem', fontSize: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', border: 'none', opacity: formState === 'sending' ? 0.6 : 1 }}
              >
                {formState === 'sending' ? 'Sending...' : 'Request Demo'}
              </button>
              {formState === 'error' && (
                <div className="text-center text-xs" style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                  Something went wrong. Please email samoitoza@gmail.com directly.
                </div>
              )}
            </form>
          ) : (
            <div className="text-center" style={{ padding: '1.5rem', borderRadius: '0.75rem', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', maxWidth: '480px', margin: '0 auto' }}>
              <h3 className="font-bold" style={{ fontFamily: 'var(--font-display)', color: '#22c55e', fontSize: 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)', marginBottom: '0.5rem' }}>You&apos;re on the list.</h3>
              <p className="text-sm" style={{ color: '#94a3b8', margin: 0 }}>We&apos;ll reach out within 24 hours to schedule a walkthrough.</p>
            </div>
          )}
          <p className="text-xs" style={{ color: '#475569', marginTop: '1rem' }}>No credit card required. We&apos;ll be in touch within 24 hours.</p>
        </div>
      </section>

      {/* == FOOTER == */}
      <footer style={{ padding: '2rem 0', background: '#0a0f1a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex flex-col md:flex-row items-center justify-between flex-wrap" style={{ maxWidth: '1200px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem', gap: '1rem' }}>
          <div className="text-xs" style={{ color: '#64748b' }}>&copy; 2026 Tour-Lytics. All rights reserved.</div>
          <div className="flex items-center" style={{ gap: '1.5rem' }}>
            <Link href="/terms" className="text-xs no-underline transition-colors" style={{ color: '#64748b' }}>Terms</Link>
            <Link href="/privacy" className="text-xs no-underline transition-colors" style={{ color: '#64748b' }}>Privacy</Link>
            <Link href="/investors" className="text-xs no-underline transition-colors" style={{ color: '#64748b' }}>Investors</Link>
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
// pipeline test 1773806155
// env vars configured 1773807954
// anon key fix 1773809555
// final key fix 1773810411
