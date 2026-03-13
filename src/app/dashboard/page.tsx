'use client'

import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

/* -- SVG Logo -- */
function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="Tour-Lytics logo">
      <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="10" r="2" fill="#2563eb" />
      <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* -- Animated counter -- */
function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1000
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

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

/* Greeting based on time */
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/* Projects data */
const projects = [
  {
    id: 'sf-office-search',
    name: 'San Francisco Office Search',
    market: 'San Francisco, CA',
    buildings: 33,
    sqft: '2.8M',
    shortlisted: 4,
    status: 'Active' as const,
    lastUpdated: 'Mar 13, 2026',
    description: '33 buildings surveyed across SoMa, FiDi, and South Beach neighborhoods',
  },
]

/* Quick action items */
const quickActions = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    label: 'Tour Map',
    desc: 'Interactive building map',
    tab: 'map',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    label: 'Tour Book',
    desc: 'Your shortlisted buildings',
    tab: 'tourbook',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    label: 'Financials',
    desc: 'Cash flow and P&L models',
    tab: 'financials',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    label: 'AI Chat',
    desc: 'Ask your tour assistant',
    tab: 'chat',
  },
]

/* Recent activity items */
const recentActivity = [
  { action: 'Directions API added to AI chatbot', time: 'Just now', type: 'feature' as const },
  { action: 'Google Places search integrated', time: '2 hours ago', type: 'feature' as const },
  { action: '4 buildings shortlisted for tours', time: 'Today', type: 'milestone' as const },
  { action: 'Financial models updated', time: 'Yesterday', type: 'update' as const },
  { action: 'Survey data loaded (33 buildings)', time: 'Mar 11', type: 'data' as const },
]

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [hoveredAction, setHoveredAction] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
      setLoading(false)
    })
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '2rem', height: '2rem', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ color: '#94a3b8', fontFamily: 'var(--font-display)', fontSize: '0.875rem' }}>Loading your workspace...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  const displayName = user?.email?.split('@')[0] || 'there'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .dash-fade { animation: fadeUp 0.5s ease-out both; }
        .dash-fade-1 { animation-delay: 0.05s; }
        .dash-fade-2 { animation-delay: 0.1s; }
        .dash-fade-3 { animation-delay: 0.15s; }
        .dash-fade-4 { animation-delay: 0.2s; }
        .dash-fade-5 { animation-delay: 0.25s; }
      `}</style>

      {/* ── Top bar ── */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" className="no-underline" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a', textDecoration: 'none' }}>
            <Logo size={28} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              Tour<span style={{ color: '#2563eb' }}>-Lytics</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* User avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
              }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline" style={{ fontSize: '0.8125rem', color: '#475569', fontWeight: 500 }}>{user?.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                fontSize: '0.8125rem',
                color: '#64748b',
                background: 'transparent',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.375rem 0.875rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 1.5rem 3rem', width: '100%', flex: 1 }}>

        {/* ── Greeting ── */}
        <div className="dash-fade dash-fade-1" style={{ marginBottom: '2.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 1rem + 2vw, 2rem)',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            marginBottom: '0.375rem',
          }}>
            {getGreeting()}, {displayName}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
            Here&apos;s your real estate workspace. Pick up where you left off.
          </p>
        </div>

        {/* ── Overview stats row ── */}
        <div className="dash-fade dash-fade-2" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {[
            { value: 33, suffix: '', label: 'Buildings Surveyed', color: '#0f172a' },
            { value: 2.8, suffix: 'M+', label: 'Total Sq Ft', color: '#0f172a', isDecimal: true },
            { value: 4, suffix: '', label: 'Shortlisted', color: '#2563eb' },
            { value: 7, suffix: '', label: 'Neighborhoods', color: '#0f172a' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              padding: '1.25rem 1rem',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.25rem, 1rem + 1vw, 1.75rem)',
                fontWeight: 800,
                color: stat.color,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}>
                {stat.isDecimal ? (
                  <>{stat.value}{stat.suffix}</>
                ) : (
                  <Counter end={stat.value} suffix={stat.suffix} />
                )}
              </div>
              <div style={{
                fontSize: '0.6875rem',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 500,
                marginTop: '0.375rem',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Two-column layout: project + activity ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

          {/* ── Project card ── */}
          <div className="dash-fade dash-fade-3">
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Active Projects
            </div>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="no-underline"
                style={{
                  display: 'block',
                  background: hoveredCard === project.id
                    ? 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)'
                    : '#ffffff',
                  borderRadius: '1rem',
                  border: hoveredCard === project.id ? '1px solid rgba(37,99,235,0.25)' : '1px solid #e2e8f0',
                  padding: '1.5rem',
                  textDecoration: 'none',
                  transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: hoveredCard === project.id
                    ? '0 8px 32px rgba(37,99,235,0.08), 0 2px 8px rgba(0,0,0,0.04)'
                    : '0 1px 3px rgba(0,0,0,0.02)',
                  transform: hoveredCard === project.id ? 'translateY(-2px)' : 'translateY(0)',
                }}
                onMouseEnter={() => setHoveredCard(project.id)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Status + arrow */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: 'rgba(34,197,94,0.08)',
                    color: '#16a34a',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                    {project.status}
                  </span>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: hoveredCard === project.id ? 'rgba(37,99,235,0.08)' : '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hoveredCard === project.id ? '#2563eb' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'all 0.2s', transform: hoveredCard === project.id ? 'translateX(2px)' : 'translateX(0)' }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </div>

                {/* Project info */}
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>
                  {project.name}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.25rem' }}>{project.market}</p>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1.25rem', lineHeight: 1.5 }}>{project.description}</p>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{project.buildings}</div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Buildings</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{project.sqft}+</div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Sq Ft</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>{project.shortlisted}</div>
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Shortlisted</div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Updated</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#475569' }}>{project.lastUpdated}</div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Add new project card */}
            <div style={{
              borderRadius: '1rem',
              border: '2px dashed #e2e8f0',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '0.75rem',
              cursor: 'default',
              transition: 'border-color 0.2s',
            }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>New Project</p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>Additional markets coming soon</p>
              </div>
            </div>
          </div>

          {/* ── Activity feed ── */}
          <div className="dash-fade dash-fade-4">
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Recent Activity
            </div>
            <div style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}>
              {recentActivity.map((item, i) => {
                const typeConfig = {
                  feature: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb', icon: '✦' },
                  milestone: { bg: 'rgba(34,197,94,0.08)', color: '#16a34a', icon: '◆' },
                  update: { bg: 'rgba(244,121,32,0.08)', color: '#f47920', icon: '●' },
                  data: { bg: 'rgba(100,116,139,0.08)', color: '#64748b', icon: '◇' },
                }[item.type]

                return (
                  <div
                    key={i}
                    style={{
                      padding: '0.875rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      borderBottom: i < recentActivity.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      borderRadius: '0.5rem',
                      background: typeConfig.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      color: typeConfig.color,
                      flexShrink: 0,
                    }}>
                      {typeConfig.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500, lineHeight: 1.4 }}>{item.action}</p>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.time}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="dash-fade dash-fade-5">
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Quick Access
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {quickActions.map((action, i) => (
              <Link
                key={i}
                href={`/project/sf-office-search${action.tab ? `?tab=${action.tab}` : ''}`}
                className="no-underline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.875rem',
                  background: hoveredAction === i
                    ? 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)'
                    : '#ffffff',
                  borderRadius: '0.75rem',
                  border: hoveredAction === i ? '1px solid rgba(37,99,235,0.2)' : '1px solid #e2e8f0',
                  padding: '1rem 1.125rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                  boxShadow: hoveredAction === i ? '0 4px 16px rgba(37,99,235,0.06)' : 'none',
                }}
                onMouseEnter={() => setHoveredAction(i)}
                onMouseLeave={() => setHoveredAction(null)}
              >
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.625rem',
                  background: hoveredAction === i ? 'rgba(37,99,235,0.08)' : '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: hoveredAction === i ? '#2563eb' : '#64748b',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}>
                  {action.icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.125rem' }}>{action.label}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
        <a
          href="https://www.perplexity.ai/computer"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.15s' }}
        >
          Created with Perplexity Computer
        </a>
      </footer>

      {/* ── Responsive overrides ── */}
      <style>{`
        @media (max-width: 768px) {
          .dash-fade-2 > div:first-child,
          [style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          [style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          [style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
