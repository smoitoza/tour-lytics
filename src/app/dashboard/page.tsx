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

/* Persona badge colors */
const personaConfig: Record<string, { bg: string; color: string; border: string }> = {
  admin:  { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb', border: 'rgba(37,99,235,0.2)' },
  broker: { bg: 'rgba(217,119,6,0.08)',   color: '#b45309', border: 'rgba(217,119,6,0.2)' },
  touree: { bg: 'rgba(22,163,74,0.08)',   color: '#16a34a', border: 'rgba(22,163,74,0.2)' },
}

/* Score bar color */
function scoreColor(score: number): string {
  if (score >= 4) return '#16a34a'
  if (score >= 3) return '#2563eb'
  if (score >= 2) return '#d97706'
  return '#dc2626'
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [hoveredAction, setHoveredAction] = useState<number | null>(null)
  const router = useRouter()

  /* ---- Team management state ---- */
  const [teamMembers, setTeamMembers] = useState<Array<{
    email: string
    display_name: string
    persona: string
  }>>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPersona, setNewPersona] = useState('touree')
  const [addingMember, setAddingMember] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  /* ---- Combined scores state ---- */
  const [scores, setScores] = useState<Array<{
    building_name: string
    overall_average: number
    total_responses: number
    category_averages: Record<string, number>
    submissions?: Array<{ user_email: string; scores: Record<string, number>; submitted_at: string }>
  }>>([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [scoresError, setScoresError] = useState<string | null>(null)
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null)
  const [detailsData, setDetailsData] = useState<Record<string, Array<{
    user_email: string
    scores: Record<string, number>
    submitted_at: string
  }>>>({})
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null)

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

  /* Fetch team members once user is known */
  useEffect(() => {
    if (!user || user.email !== 'samoitoza@gmail.com') return
    setTeamLoading(true)
    fetch('/api/team?projectId=sf-office-search')
      .then((r) => r.json())
      .then((data) => {
        setTeamMembers(Array.isArray(data) ? data : data.members || [])
        setTeamLoading(false)
      })
      .catch(() => {
        setTeamError('Could not load team members.')
        setTeamLoading(false)
      })
  }, [user])

  /* Fetch combined scores once user is known */
  useEffect(() => {
    if (!user) return
    setScoresLoading(true)
    fetch('/api/surveys/combined?projectId=sf-office-search')
      .then((r) => r.json())
      .then((data) => {
        setScores(Array.isArray(data) ? data : data.buildings || [])
        setScoresLoading(false)
      })
      .catch(() => {
        setScoresError('Could not load survey scores.')
        setScoresLoading(false)
      })
  }, [user])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleAddMember = async () => {
    if (!newEmail.trim()) { setAddError('Email is required.'); return }
    setAddingMember(true)
    setAddError(null)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'sf-office-search',
          email: newEmail.trim(),
          display_name: newDisplayName.trim(),
          persona: newPersona,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAddError(err.error || 'Failed to add member.')
      } else {
        const added = await res.json()
        const addedMember = added.member || added || { email: newEmail.trim(), display_name: newDisplayName.trim(), persona: newPersona }
        setTeamMembers((prev) => [...prev, addedMember])
        // Auto-open invite email
        handleSendInvite(newEmail.trim(), newDisplayName.trim(), newPersona)
        setNewEmail('')
        setNewDisplayName('')
        setNewPersona('touree')
      }
    } catch {
      setAddError('Network error. Please try again.')
    }
    setAddingMember(false)
  }

  const handleRemoveMember = async (email: string) => {
    try {
      await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'sf-office-search', email }),
      })
      setTeamMembers((prev) => prev.filter((m) => m.email !== email))
    } catch {
      /* silently ignore */
    }
  }

  const getSignupUrl = () => 'https://tour-lytics.com/login'
  const getProjectUrl = () => 'https://tour-lytics.com/project/sf-office-search'

  const buildInviteEmail = (email: string, displayName: string, persona: string) => {
    const firstName = displayName ? displayName.split(' ')[0] : ''
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
    const roleName = persona === 'broker' ? 'broker' : 'tour reviewer'
    const subject = encodeURIComponent('You\'re invited to Tour-Lytics - SF Office Search')
    const body = encodeURIComponent(
      `${greeting}\n\n` +
      `You've been added as a ${roleName} on our San Francisco Office Search project in Tour-Lytics.\n\n` +
      `To get started:\n` +
      `1. Create your account: ${getSignupUrl()}\n` +
      `2. Sign in with this email (${email})\n` +
      `3. You'll see the project dashboard with all 33 buildings to review\n\n` +
      `Once you're in, head to the Tour Book to score each building we visit. Your scores will be combined with the rest of the team's so we can compare locations side by side.\n\n` +
      `Let me know if you have any questions.\n\n` +
      `Best,\nScott`
    )
    return `mailto:${email}?subject=${subject}&body=${body}`
  }

  const handleSendInvite = (email: string, displayName: string, persona: string) => {
    window.open(buildInviteEmail(email, displayName, persona), '_blank')
    setInviteSent(email)
    setTimeout(() => setInviteSent(null), 3000)
  }

  const handleCopyLink = async (email: string) => {
    try {
      await navigator.clipboard.writeText(`${getSignupUrl()}\n\nSign up with ${email} to access the SF Office Search project on Tour-Lytics.`)
      setCopiedLink(email)
      setTimeout(() => setCopiedLink(null), 2000)
    } catch {
      /* fallback: select text */
    }
  }

  const handleViewDetails = async (buildingName: string) => {
    if (expandedBuilding === buildingName) {
      setExpandedBuilding(null)
      return
    }
    setExpandedBuilding(buildingName)
    if (detailsData[buildingName]) return
    setDetailsLoading(buildingName)
    try {
      const res = await fetch(`/api/surveys/combined?projectId=sf-office-search&includeDetails=true`)
      const data = await res.json()
      const buildings: Array<{
        building_name: string
        submissions?: Array<{ user_email: string; scores: Record<string, number>; submitted_at: string }>
      }> = Array.isArray(data) ? data : data.buildings || []
      const map: Record<string, Array<{ user_email: string; scores: Record<string, number>; submitted_at: string }>> = {}
      buildings.forEach((b) => { if (b.submissions) map[b.building_name] = b.submissions })
      setDetailsData((prev) => ({ ...prev, ...map }))
    } catch {
      /* silently ignore */
    }
    setDetailsLoading(null)
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
  const isAdmin = user?.email === 'samoitoza@gmail.com'

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
        .dash-fade-6 { animation-delay: 0.3s; }
        .dash-fade-7 { animation-delay: 0.35s; }
        .team-input:focus { outline: none; border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
        .team-select:focus { outline: none; border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.08); }
        .remove-btn:hover { background: rgba(220,38,38,0.08) !important; color: #dc2626 !important; border-color: rgba(220,38,38,0.2) !important; }
        .details-btn:hover { background: rgba(37,99,235,0.08) !important; color: #2563eb !important; border-color: rgba(37,99,235,0.2) !important; }
        .invite-btn:hover { opacity: 0.85; }
      `}</style>

      {/* -- Top bar -- */}
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

      {/* -- Main content -- */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 1.5rem 3rem', width: '100%', flex: 1 }}>

        {/* -- Greeting -- */}
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

        {/* -- Overview stats row -- */}
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

        {/* -- Two-column layout: project + activity -- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

          {/* -- Project card -- */}
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

          {/* -- Activity feed -- */}
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

        {/* ================================================================
            SECTION 1: MANAGE TEAM (admin only)
        ================================================================ */}
        {isAdmin && (
          <div className="dash-fade dash-fade-6" style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
              Manage Team
            </div>

            <div style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}>
              {/* Team member list */}
              {teamLoading ? (
                <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: '#94a3b8' }}>
                  <div style={{ width: '1rem', height: '1rem', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.875rem' }}>Loading team members...</span>
                </div>
              ) : teamError ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#dc2626', fontSize: '0.875rem' }}>{teamError}</div>
              ) : teamMembers.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No team members yet.</div>
              ) : (
                <div>
                  {/* Header row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto auto auto',
                    gap: '0.75rem',
                    padding: '0.625rem 1.25rem',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    alignItems: 'center',
                  }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Display Name</div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Role</div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Invite</div>
                    <div style={{ width: '1.75rem' }} />
                  </div>

                  {teamMembers.map((member, i) => {
                    const badge = personaConfig[member.persona] || personaConfig.touree
                    const isOwner = member.email === 'samoitoza@gmail.com'
                    return (
                      <div
                        key={member.email}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr auto auto auto',
                          gap: '0.75rem',
                          padding: '0.875rem 1.25rem',
                          borderBottom: i < teamMembers.length - 1 ? '1px solid #f1f5f9' : 'none',
                          alignItems: 'center',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: isOwner ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.email}
                          {isOwner && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.625rem', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>you</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.display_name || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No name set</span>}
                        </div>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0.1875rem 0.625rem',
                          borderRadius: '9999px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          letterSpacing: '0.03em',
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {member.persona}
                        </span>
                        {/* Invite actions */}
                        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                          {!isOwner ? (
                            <>
                              <button
                                className="invite-btn"
                                onClick={() => handleSendInvite(member.email, member.display_name, member.persona)}
                                title={`Email invite to ${member.email}`}
                                style={{
                                  padding: '0.3125rem 0.625rem',
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: inviteSent === member.email ? '#16a34a' : '#2563eb',
                                  background: inviteSent === member.email ? 'rgba(22,163,74,0.08)' : 'rgba(37,99,235,0.06)',
                                  border: inviteSent === member.email ? '1px solid rgba(22,163,74,0.2)' : '1px solid rgba(37,99,235,0.15)',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  transition: 'all 0.15s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                  <polyline points="22,6 12,13 2,6" />
                                </svg>
                                {inviteSent === member.email ? 'Sent' : 'Email'}
                              </button>
                              <button
                                className="invite-btn"
                                onClick={() => handleCopyLink(member.email)}
                                title="Copy signup link"
                                style={{
                                  padding: '0.3125rem 0.625rem',
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: copiedLink === member.email ? '#16a34a' : '#64748b',
                                  background: copiedLink === member.email ? 'rgba(22,163,74,0.08)' : '#f8fafc',
                                  border: copiedLink === member.email ? '1px solid rgba(22,163,74,0.2)' : '1px solid #e2e8f0',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                  transition: 'all 0.15s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  {copiedLink === member.email ? (
                                    <polyline points="20 6 9 17 4 12" />
                                  ) : (
                                    <>
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                                    </>
                                  )}
                                </svg>
                                {copiedLink === member.email ? 'Copied' : 'Link'}
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '0.6875rem', color: '#cbd5e1' }}>&mdash;</span>
                          )}
                        </div>
                        <div style={{ width: '1.75rem', display: 'flex', justifyContent: 'center' }}>
                          {!isOwner && (
                            <button
                              className="remove-btn"
                              onClick={() => handleRemoveMember(member.email)}
                              title={`Remove ${member.email}`}
                              style={{
                                width: '1.75rem',
                                height: '1.75rem',
                                borderRadius: '0.375rem',
                                border: '1px solid #e2e8f0',
                                background: 'transparent',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                padding: 0,
                                lineHeight: 1,
                                fontSize: '0.875rem',
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add member form */}
              <div style={{
                padding: '1.25rem',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
                  Add Member
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.625rem', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500, marginBottom: '0.375rem' }}>Email</label>
                    <input
                      type="email"
                      className="team-input"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="name@example.com"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        color: '#0f172a',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500, marginBottom: '0.375rem' }}>Display Name</label>
                    <input
                      type="text"
                      className="team-input"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Jane Smith"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        color: '#0f172a',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.6875rem', color: '#64748b', fontWeight: 500, marginBottom: '0.375rem' }}>Role</label>
                    <select
                      className="team-select"
                      value={newPersona}
                      onChange={(e) => setNewPersona(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        color: '#0f172a',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        appearance: 'none',
                        paddingRight: '2rem',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.625rem center',
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="broker">Broker</option>
                      <option value="touree">Touree</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddMember}
                    disabled={addingMember}
                    style={{
                      padding: '0.5rem 1.125rem',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      background: addingMember ? '#93c5fd' : '#2563eb',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: addingMember ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'background 0.15s',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                    }}
                    onMouseEnter={(e) => { if (!addingMember) e.currentTarget.style.background = '#1d4ed8' }}
                    onMouseLeave={(e) => { if (!addingMember) e.currentTarget.style.background = '#2563eb' }}
                  >
                    {addingMember && (
                      <div style={{ width: '0.75rem', height: '0.75rem', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    )}
                    Add Member
                  </button>
                </div>
                {addError && (
                  <p style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: '#dc2626' }}>{addError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            SECTION 2: COMBINED TOUR SCORES (visible to everyone)
        ================================================================ */}
        <div className="dash-fade dash-fade-7" style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Combined Tour Scores
          </div>

          {scoresLoading ? (
            <div style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              color: '#94a3b8',
            }}>
              <div style={{ width: '1rem', height: '1rem', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem' }}>Loading survey scores...</span>
            </div>
          ) : scoresError ? (
            <div style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '2.5rem',
              textAlign: 'center',
              color: '#dc2626',
              fontSize: '0.875rem',
            }}>
              {scoresError}
            </div>
          ) : scores.length === 0 ? (
            /* Empty state */
            <div style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '3rem 2rem',
              textAlign: 'center',
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.875rem',
                background: 'rgba(37,99,235,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>No survey scores submitted yet</p>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.6 }}>
                Tourees can submit scores from the Tour Book.
              </p>
            </div>
          ) : (
            /* Ranked building list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {scores.map((building, i) => {
                const rank = i + 1
                const color = scoreColor(building.overall_average)
                const barPct = Math.round((building.overall_average / 5) * 100)
                const isExpanded = expandedBuilding === building.building_name
                const categories = building.category_averages || {}
                const catKeys = Object.keys(categories)

                return (
                  <div
                    key={building.building_name}
                    style={{
                      background: '#ffffff',
                      borderRadius: '1rem',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      transition: 'box-shadow 0.2s',
                    }}
                  >
                    {/* Main row */}
                    <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                      {/* Rank */}
                      <div style={{
                        width: '2.25rem',
                        height: '2.25rem',
                        borderRadius: '0.625rem',
                        background: rank <= 3 ? 'rgba(37,99,235,0.08)' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontSize: '0.9375rem',
                        fontWeight: 800,
                        color: rank <= 3 ? '#2563eb' : '#94a3b8',
                        flexShrink: 0,
                      }}>
                        {rank}
                      </div>

                      {/* Building name + category pills */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {building.building_name}
                        </div>
                        {catKeys.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            {catKeys.map((cat) => {
                              const catScore = categories[cat]
                              const catColor = scoreColor(catScore)
                              return (
                                <span
                                  key={cat}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    color: catColor,
                                    background: `${catColor}14`,
                                    border: `1px solid ${catColor}33`,
                                    textTransform: 'capitalize',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {cat}: {typeof catScore === 'number' ? catScore.toFixed(1) : catScore}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Score + bar */}
                      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: '7rem' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', justifyContent: 'flex-end', marginBottom: '0.375rem' }}>
                          <span style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            color,
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                          }}>
                            {typeof building.overall_average === 'number' ? building.overall_average.toFixed(1) : building.overall_average}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>/5</span>
                        </div>
                        {/* Score bar */}
                        <div style={{ width: '6rem', height: '0.375rem', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', marginLeft: 'auto' }}>
                          <div style={{
                            width: `${barPct}%`,
                            height: '100%',
                            background: color,
                            borderRadius: '9999px',
                            transition: 'width 0.6s ease-out',
                          }} />
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          {building.total_responses} {building.total_responses === 1 ? 'response' : 'responses'}
                        </div>
                      </div>

                      {/* Admin: View Details button */}
                      {isAdmin && (
                        <button
                          className="details-btn"
                          onClick={() => handleViewDetails(building.building_name)}
                          style={{
                            flexShrink: 0,
                            padding: '0.4375rem 0.875rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isExpanded ? '#2563eb' : '#64748b',
                            background: isExpanded ? 'rgba(37,99,235,0.08)' : 'transparent',
                            border: isExpanded ? '1px solid rgba(37,99,235,0.2)' : '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                          }}
                        >
                          {detailsLoading === building.building_name ? (
                            <div style={{ width: '0.75rem', height: '0.75rem', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          ) : (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          )}
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </div>

                    {/* Expanded: individual submissions */}
                    {isAdmin && isExpanded && (
                      <div style={{
                        borderTop: '1px solid #f1f5f9',
                        background: '#f8fafc',
                        padding: '1rem 1.5rem',
                      }}>
                        {!detailsData[building.building_name] ? (
                          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8125rem', padding: '0.75rem 0' }}>
                            Loading submissions...
                          </div>
                        ) : detailsData[building.building_name].length === 0 ? (
                          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8125rem', padding: '0.75rem 0' }}>
                            No individual submissions available.
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
                              Individual Submissions
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {detailsData[building.building_name].map((sub, si) => {
                                const subCats = sub.scores || {}
                                const subCatKeys = Object.keys(subCats)
                                return (
                                  <div
                                    key={si}
                                    style={{
                                      background: '#ffffff',
                                      borderRadius: '0.625rem',
                                      border: '1px solid #e2e8f0',
                                      padding: '0.75rem 1rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '1rem',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                      <div style={{
                                        width: '1.5rem',
                                        height: '1.5rem',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontSize: '0.625rem',
                                        fontWeight: 600,
                                        flexShrink: 0,
                                      }}>
                                        {(sub.user_email || '?').charAt(0).toUpperCase()}
                                      </div>
                                      <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {sub.user_email}
                                      </span>
                                    </div>
                                    {subCatKeys.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', flex: 1 }}>
                                        {subCatKeys.map((cat) => {
                                          const s = subCats[cat]
                                          const c = scoreColor(s)
                                          return (
                                            <span key={cat} style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.25rem',
                                              padding: '0.125rem 0.5rem',
                                              borderRadius: '9999px',
                                              fontSize: '0.625rem',
                                              fontWeight: 600,
                                              color: c,
                                              background: `${c}14`,
                                              border: `1px solid ${c}33`,
                                              textTransform: 'capitalize',
                                              whiteSpace: 'nowrap',
                                            }}>
                                              {cat}: {typeof s === 'number' ? s.toFixed(1) : s}
                                            </span>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {sub.submitted_at && (
                                      <span style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}>
                                        {new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* -- Quick actions -- */}
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

      {/* -- Footer -- */}
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

      {/* -- Responsive overrides -- */}
      <style>{`
        @media (max-width: 768px) {
          .dash-fade-2 > div:first-child,
          [style*="grid-template-columns: repeat(4"] {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          [style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          [style*="grid-template-columns: 1fr 1fr auto auto"] {
            grid-template-columns: 1fr !important;
          }
          [style*="grid-template-columns: 1fr 1fr auto auto auto"] {
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
