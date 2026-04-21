'use client'

import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import TokenWidget from '@/components/TokenWidget'

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
  const prevEnd = useRef(0)

  useEffect(() => {
    // Animate whenever end value changes
    if (end === prevEnd.current && end === 0) return
    prevEnd.current = end
    const duration = 800
    const startVal = count
    const startTime = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(startVal + (end - startVal) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [end]) // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

/* Greeting based on time */
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/* Project type */
interface Project {
  id: string
  name: string
  market: string
  description: string
  status: string
  buildings_count: number
  sqft: string
  shortlisted_count: number
  created_by: string
  owner_id?: string
  client_name?: string
  user_role?: string
  user_persona?: string
  is_admin_view?: boolean
  created_at: string
  updated_at: string
}

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
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    label: 'Tour Scores',
    desc: 'Combined team ratings',
    tab: 'scores',
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
const personaConfig: Record<string, { bg: string; color: string; border: string; label: string }> = {
  admin:    { bg: 'rgba(37,99,235,0.08)',   color: '#2563eb', border: 'rgba(37,99,235,0.2)',  label: 'Admin' },
  broker:   { bg: 'rgba(217,119,6,0.08)',   color: '#b45309', border: 'rgba(217,119,6,0.2)',  label: 'Broker' },
  cre_team: { bg: 'rgba(124,58,237,0.08)',  color: '#7c3aed', border: 'rgba(124,58,237,0.2)', label: 'CRE Team' },
  touree:   { bg: 'rgba(22,163,74,0.08)',   color: '#16a34a', border: 'rgba(22,163,74,0.2)',  label: 'Touree' },
}


export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [hoveredAction, setHoveredAction] = useState<number | null>(null)
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
  const router = useRouter()

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusDropdown) return
    const close = () => setStatusDropdown(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [statusDropdown])

  /* ---- Projects state ---- */
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)

  /* ---- Create project modal state ---- */
  const [searchQuery, setSearchQuery] = useState('')
  const [projectSort, setProjectSort] = useState<'recent' | 'name'>('recent')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectMarket, setNewProjectMarket] = useState('')
  const [newProjectClient, setNewProjectClient] = useState('')
  const [newProjectHQ, setNewProjectHQ] = useState('')
  const [newProjectCurrency, setNewProjectCurrency] = useState('USD')
  const [creatingProject, setCreatingProject] = useState(false)
  const [dashStats, setDashStats] = useState<{ buildings: number; sqft: number; shortlisted: number; leaseValue: number; projects: number } | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  /* ---- Delete project state ---- */
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  /* Fetch projects once user is known */
  useEffect(() => {
    if (!user) return
    setProjectsLoading(true)
    fetch(`/api/projects?email=${encodeURIComponent(user.email || '')}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProjects(data)
        } else {
          // Fallback to hardcoded SF project if table doesn't exist yet
          setProjects([{
            id: 'sf-office-search',
            name: 'San Francisco Office Search',
            market: 'San Francisco, CA',
            description: '33 buildings surveyed across SoMa, FiDi, and South Beach neighborhoods',
            status: 'active',
            buildings_count: 33,
            sqft: '2.8M',
            shortlisted_count: 4,
            created_by: 'samoitoza@gmail.com',
            created_at: '2026-03-11T00:00:00Z',
            updated_at: '2026-03-13T00:00:00Z',
          }])
        }
        setProjectsLoading(false)
      })
      .catch(() => {
        // Fallback
        setProjects([{
          id: 'sf-office-search',
          name: 'San Francisco Office Search',
          market: 'San Francisco, CA',
          description: '33 buildings surveyed across SoMa, FiDi, and South Beach neighborhoods',
          status: 'active',
          buildings_count: 33,
          sqft: '2.8M',
          shortlisted_count: 4,
          created_by: 'samoitoza@gmail.com',
          created_at: '2026-03-11T00:00:00Z',
          updated_at: '2026-03-13T00:00:00Z',
        }])
        setProjectsLoading(false)
      })
  }, [user])

  /* Fetch aggregate dashboard stats */
  useEffect(() => {
    if (!user?.email) return
    fetch(`/api/dashboard-stats?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(data => { if (data && !data.error) setDashStats(data) })
      .catch(() => {})
  }, [user])

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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    if (!currentPassword || !newPassword) { setPasswordError('All fields are required.'); return }
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }
    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setPasswordError(data.error || 'Failed to change password.'); setChangingPassword(false); return }
      setPasswordSuccess(true)
      setChangingPassword(false)
      setTimeout(() => { setShowPasswordModal(false); setPasswordSuccess(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }, 2000)
    } catch (err) {
      setPasswordError('Something went wrong. Please try again.')
      setChangingPassword(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setCreateError('Project name is required.')
      return
    }
    setCreatingProject(true)
    setCreateError(null)
    try {
      const hqAddr = newProjectHQ.trim()

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          market: newProjectMarket.trim(),
          client_name: newProjectClient.trim(),
          currency: newProjectCurrency,
          createdBy: user?.email,
          hq_address: hqAddr || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setCreateError(err.error || 'Failed to create project.')
        setCreatingProject(false)
        return
      }
      const project = await res.json()
      // Navigate to the new project's tour book
      router.push(`/project/${project.id}?tab=tourbook`)
    } catch {
      setCreateError('Network error. Please try again.')
      setCreatingProject(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteTarget || !user?.email) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(deleteTarget.id)}&email=${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
        setDeleteTarget(null)
      }
    } catch {
      /* silently ignore */
    }
    setDeleting(false)
  }

  const handleAddMember = async () => {
    if (!newEmail.trim()) { setAddError('Email is required.'); return }
    setAddingMember(true)
    setAddError(null)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'sf-office-search',
          email: newEmail.trim(),
          displayName: newDisplayName.trim(),
          persona: newPersona,
          addedBy: user?.email,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setAddError(err.error || 'Failed to add member.')
      } else {
        const result = await res.json()
        const addedMember = result.member || { email: newEmail.trim(), display_name: newDisplayName.trim(), persona: newPersona }
        setTeamMembers((prev) => [...prev, addedMember])
        // Auto-open invite email with login credentials
        handleSendInvite(newEmail.trim(), newDisplayName.trim(), newPersona, result.tempPassword)
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

  const getSignupUrl = () => 'https://tourlytics.ai/login'
  const getProjectUrl = () => 'https://tourlytics.ai/project/sf-office-search'

  const buildInviteEmail = (email: string, displayName: string, persona: string, tempPassword?: string) => {
    const firstName = displayName ? displayName.split(' ')[0] : ''
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
    const roleNames: Record<string, string> = { admin: 'admin', broker: 'broker', cre_team: 'CRE team member', touree: 'tour reviewer' }
    const roleName = roleNames[persona] || 'tour reviewer'
    const subject = encodeURIComponent('You\'re invited to Tour-Lytics - SF Office Search')

    let bodyText = `${greeting}\n\n` +
      `You've been added as a ${roleName} on our San Francisco Office Search project in Tour-Lytics.\n\n`

    if (tempPassword) {
      bodyText +=
        `Your new account is ready to go. Here are your login credentials:\n\n` +
        `Login page: ${getSignupUrl()}\n` +
        `Email: ${email}\n` +
        `Password: ${tempPassword}\n\n` +
        `You can change your password after signing in.\n\n`
    } else {
      bodyText +=
        `You already have a Tour-Lytics account, so no new password is needed. Just sign in with your existing credentials:\n\n` +
        `Login page: ${getSignupUrl()}\n` +
        `Email: ${email}\n\n` +
        `If you've forgotten your password, use the "Forgot password" link on the login page.\n\n`
    }

    bodyText +=
      `Once you're in, head to the Tour Book to score each building we visit. Your scores will be combined with the rest of the team's so we can compare locations side by side.\n\n` +
      `Let me know if you have any questions.\n\n` +
      `Best,\nScott`

    const body = encodeURIComponent(bodyText)
    return `mailto:${email}?subject=${subject}&body=${body}`
  }

  const handleSendInvite = (email: string, displayName: string, persona: string, tempPassword?: string) => {
    window.open(buildInviteEmail(email, displayName, persona, tempPassword), '_blank')
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
  const isAdmin = !!user?.email // Every authenticated user is the admin of their own account

  // Support/platform admin (can view all customer projects)
  const ADMIN_EMAILS = ['scott@tourlytics.ai', 'samoitoza@gmail.com']
  const isSupportAdmin = ADMIN_EMAILS.includes((user?.email || '').toLowerCase())

  /* Role badge colors */
  const ROLE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
    owner:  { bg: 'rgba(234,124,28,0.1)', color: '#b45309', label: 'Owner' },
    admin:  { bg: 'rgba(37,99,235,0.08)', color: '#2563eb', label: 'Admin' },
    member: { bg: 'rgba(124,58,237,0.08)', color: '#7c3aed', label: 'Member' },
    viewer: { bg: 'rgba(100,116,139,0.08)', color: '#64748b', label: 'Viewer' },
  }

  /* Status config */
  const STATUS_LABEL: Record<string, string> = { active: 'Active', on_hold: 'On Hold', complete: 'Complete' }
  const STATUS_DOT: Record<string, string> = { active: '#22c55e', on_hold: '#f59e0b', complete: '#2563eb' }
  const STATUS_STYLE: Record<string, React.CSSProperties> = {
    active: { background: 'rgba(34,197,94,0.08)', color: '#16a34a' },
    on_hold: { background: 'rgba(245,158,11,0.08)', color: '#d97706' },
    complete: { background: 'rgba(37,99,235,0.08)', color: '#2563eb' },
  }

  async function handleStatusChange(projectId: string, newStatus: string) {
    setStatusDropdown(null)
    try {
      await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, status: newStatus }),
      })
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  /* Reusable project card renderer */
  function renderProjectCard(project: Project, updatedDate: string, canDelete: boolean) {
    const roleBadge = ROLE_BADGE[project.user_role || ''] || null
    return (
      <div
        key={project.id}
        className="project-card-wrap"
        style={{ position: 'relative', marginBottom: '0.75rem' }}
        onMouseEnter={() => setHoveredCard(project.id)}
        onMouseLeave={() => setHoveredCard(null)}
      >
        <Link
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
        >
          {/* Status + role badge + arrow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusDropdown(statusDropdown === project.id ? null : project.id) }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  position: 'relative',
                  ...STATUS_STYLE[project.status || 'active'],
                }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_DOT[project.status || 'active'] || '#22c55e', animation: project.status === 'active' ? 'pulse 2s infinite' : 'none' }} />
                {STATUS_LABEL[project.status || 'active'] || 'Active'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '2px' }}><polyline points="6 9 12 15 18 9" /></svg>
                {statusDropdown === project.id && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    minWidth: '120px',
                    overflow: 'hidden',
                  }}>
                    {(['active', 'on_hold', 'complete'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStatusChange(project.id, s) }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          border: 'none',
                          background: project.status === s ? '#f1f5f9' : 'transparent',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: project.status === s ? 600 : 400,
                          color: '#334155',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_DOT[s] }} />
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                )}
              </span>
              {roleBadge && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: roleBadge.bg,
                  color: roleBadge.color,
                }}>
                  {roleBadge.label}
                </span>
              )}
            </div>
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
          {project.client_name && (
            <p style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 500, marginBottom: '0.125rem' }}>{project.client_name}</p>
          )}
          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.25rem' }}>{project.market}</p>
          {project.is_admin_view && project.owner_id && (
            <p style={{ fontSize: '0.75rem', color: '#7c3aed', marginBottom: '0.25rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Owner: {project.owner_id}
            </p>
          )}
          <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginBottom: '1.25rem', lineHeight: 1.5 }}>{project.description}</p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{project.buildings_count}</div>
              <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Buildings</div>
            </div>
            {project.sqft && (
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{project.sqft}+</div>
                <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Sq Ft</div>
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>{project.shortlisted_count}</div>
              <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Shortlisted</div>
            </div>
            {updatedDate && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Updated</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#475569' }}>{updatedDate}</div>
              </div>
            )}
          </div>
        </Link>
        {/* Delete link - below the card, far from the open arrow */}
        {canDelete && (
          <div className="delete-project-btn" style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '0.375rem 0.5rem 0',
          }}>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(project) }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.6875rem',
                color: '#94a3b8',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.375rem',
                borderRadius: '0.375rem',
                transition: 'all 0.15s',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

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
        .create-project-btn:hover { border-color: #2563eb !important; background: rgba(37,99,235,0.02) !important; }
        .delete-project-btn { opacity: 0; transition: opacity 0.15s; }
        .project-card-wrap:hover .delete-project-btn { opacity: 1; }
        .delete-project-btn:hover { background: rgba(220,38,38,0.08) !important; color: #dc2626 !important; }
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
              {isSupportAdmin && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: '#fff',
                  marginLeft: '0.25rem',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>
                  Admin
                </span>
              )}
            </div>
            <Link
              href="/billing"
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                background: 'transparent',
                textDecoration: 'none',
                fontFamily: 'inherit',
                fontWeight: 400,
                padding: '0.25rem 0.5rem',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#2563eb' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8' }}
            >
              Manage Billing
            </Link>
            <button
              onClick={() => { setShowPasswordModal(true); setPasswordError(null); setPasswordSuccess(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 400,
                padding: '0.25rem 0.5rem',
              }}
            >
              Change Password
            </button>
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

        {/* -- Project search bar + sort toggle -- */}
        <div className="dash-fade dash-fade-3" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search projects by name, location, or client..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.75rem',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              fontSize: '0.9375rem',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', lineHeight: 1 }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Sort toggle */}
        <div style={{ display: 'flex', gap: '0.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.625rem', padding: '0.25rem', flexShrink: 0 }}>
          {(['recent', 'name'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setProjectSort(opt)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 500,
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                background: projectSort === opt ? '#0f172a' : 'transparent',
                color: projectSort === opt ? '#ffffff' : '#64748b',
              }}
            >
              {opt === 'recent' ? 'Recent' : 'A – Z'}
            </button>
          ))}
        </div>

        </div>

        {/* -- Three-section layout: My Projects, Shared With Me, Clients -- */}
        {(() => {
          const q = searchQuery.toLowerCase().trim()
          const filterProject = (p: Project) => !q ||
            (p.name || '').toLowerCase().includes(q) ||
            (p.market || '').toLowerCase().includes(q) ||
            (p.client_name || '').toLowerCase().includes(q) ||
            (p.market || '').toLowerCase().includes(q)

          const myProjects = projects.filter(p => p.user_role === 'owner' || p.owner_id === user?.email || p.created_by === user?.email)
          const sharedProjects = projects.filter(p => p.user_role !== 'owner' && p.owner_id !== user?.email && p.created_by !== user?.email)
          // Fallback: if no role data, treat all as "my projects"
          const statusOrder: Record<string, number> = { active: 0, on_hold: 1, complete: 2 }
          const sortProjects = (a: Project, b: Project) => {
            if (projectSort === 'name') {
              return (a.name || '').localeCompare(b.name || '')
            }
            // recent: sort by updated_at descending, fall back to status order
            const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
            const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
            if (bTime !== aTime) return bTime - aTime
            return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
          }
          const effectiveMy = (projects.some(p => p.user_role) ? myProjects : projects).filter(filterProject).sort(sortProjects)
          const effectiveShared = (projects.some(p => p.user_role) ? sharedProjects : []).filter(filterProject).sort(sortProjects)

          // Build client list from all projects that have a client_name
          const clientMap = new Map<string, { name: string; projectCount: number; totalBuildings: number; markets: string[] }>()
          projects.forEach(p => {
            const cn = (p.client_name || '').trim()
            if (!cn) return
            const existing = clientMap.get(cn.toLowerCase())
            if (existing) {
              existing.projectCount++
              existing.totalBuildings += p.buildings_count || 0
              if (p.market && !existing.markets.includes(p.market)) existing.markets.push(p.market)
            } else {
              clientMap.set(cn.toLowerCase(), {
                name: cn,
                projectCount: 1,
                totalBuildings: p.buildings_count || 0,
                markets: p.market ? [p.market] : [],
              })
            }
          })
          const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name))

          return (<>
        {/* --- Two-column layout: My Projects | Shared With Me --- */}
        <div className="dash-fade dash-fade-3" style={{ display: 'grid', gridTemplateColumns: effectiveShared.length > 0 ? '1fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '2rem', alignItems: 'start' }}>

        {/* -- My Projects column -- */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              My Projects
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{effectiveMy.length} project{effectiveMy.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {effectiveMy.map((project) => {
              const updatedDate = project.updated_at ? new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
              const canDelete = (project.owner_id === user?.email || project.created_by === user?.email) && project.id !== 'sf-office-search'
              return renderProjectCard(project, updatedDate, canDelete)
            })}
            {/* Add new project button - any authenticated user */}
            {isAdmin && (
              <button
                onClick={() => { setShowCreateModal(true); setCreateError(null); setNewProjectName(''); setNewProjectMarket(''); setNewProjectClient(''); setNewProjectHQ(''); setNewProjectCurrency('USD') }}
                className="create-project-btn"
                style={{
                  borderRadius: '1rem',
                  border: '2px dashed #cbd5e1',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'transparent',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '0.75rem',
                  background: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2563eb', margin: 0 }}>Create New Project</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.125rem' }}>Start a new site selection</p>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* -- Shared With Me / All Customer Projects (admin) column -- */}
        {effectiveShared.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: isSupportAdmin ? '#7c3aed' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isSupportAdmin ? 'All Customer Projects (Admin View)' : 'Shared With Me'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{effectiveShared.length} project{effectiveShared.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {effectiveShared.map((project) => {
                const updatedDate = project.updated_at ? new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                return renderProjectCard(project, updatedDate, false)
              })}
            </div>
          </div>
        )}

        </div> {/* end two-column grid */}

        {/* --- Clients --- */}
        <div className="dash-fade dash-fade-5" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Clients
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</div>
          </div>
          {clients.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {clients.map((client) => (
                <div
                  key={client.name}
                  style={{
                    background: '#ffffff',
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    padding: '1.25rem',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{
                      width: '2.25rem',
                      height: '2.25rem',
                      borderRadius: '0.625rem',
                      background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#2563eb',
                      flexShrink: 0,
                    }}>
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                        {client.name}
                      </div>
                      {client.markets.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {client.markets.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{client.projectCount}</div>
                      <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Projects</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>{client.totalBuildings}</div>
                      <div style={{ fontSize: '0.625rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Buildings</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid #e2e8f0',
              padding: '2rem',
              textAlign: 'center',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.75rem' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>No clients yet</p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Add a client name when creating a project to start organizing by client.</p>
            </div>
          )}
        </div>

          </>)
        })()}





      </main>

      {/* -- Create Project Modal -- */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px rgba(0,0,0,0.16)',
              width: '100%',
              maxWidth: '480px',
              overflow: 'hidden',
              animation: 'fadeUp 0.3s ease-out',
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '1.5rem 1.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Create New Project</h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>Set up a new site selection project</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: '#94a3b8', borderRadius: '0.5rem' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '1.5rem' }}>
              {/* Project Name */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Project Name</label>
                <input
                  type="text"
                  className="team-input"
                  placeholder="e.g. Austin Office Search"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>

              {/* Client Name */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Client Name <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                <input
                  type="text"
                  className="team-input"
                  placeholder="e.g. Acme Corp"
                  value={newProjectClient}
                  onChange={(e) => setNewProjectClient(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>

              {/* Current Office / HQ */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Current Office Address <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                <input
                  type="text"
                  className="team-input"
                  placeholder="e.g. 190 W Tasman Drive, San Jose, CA 95134"
                  value={newProjectHQ}
                  onChange={(e) => setNewProjectHQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
                <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.25rem' }}>Shown as a star pin on the map so everyone can see where the company is today</p>
              </div>

              {/* Market */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Market / Location</label>
                <input
                  type="text"
                  className="team-input"
                  placeholder="e.g. Austin, TX"
                  value={newProjectMarket}
                  onChange={(e) => setNewProjectMarket(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject() }}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>

              {/* Currency */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Currency</label>
                <select
                  value={newProjectCurrency}
                  onChange={(e) => setNewProjectCurrency(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box' as const,
                    cursor: 'pointer',
                    appearance: 'auto' as const,
                  }}
                >
                  <option value="USD">$ USD - US Dollar</option>
                  <option value="GBP">{"\u00A3"} GBP - British Pound</option>
                  <option value="EUR">{"\u20AC"} EUR - Euro</option>
                  <option value="CAD">$ CAD - Canadian Dollar</option>
                  <option value="AUD">$ AUD - Australian Dollar</option>
                  <option value="JPY">{"\u00A5"} JPY - Japanese Yen</option>
                  <option value="SGD">$ SGD - Singapore Dollar</option>
                  <option value="HKD">$ HKD - Hong Kong Dollar</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                  <option value="INR">{"\u20B9"} INR - Indian Rupee</option>
                  <option value="CNY">{"\u00A5"} CNY - Chinese Yuan</option>
                  <option value="BRL">R$ BRL - Brazilian Real</option>
                  <option value="MXN">$ MXN - Mexican Peso</option>
                  <option value="SEK">kr SEK - Swedish Krona</option>
                  <option value="NZD">$ NZD - New Zealand Dollar</option>
                </select>
              </div>

              {/* Info note */}
              <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                <p style={{ fontSize: '0.8125rem', color: '#0369a1', lineHeight: 1.5, margin: 0 }}>
                  After creating the project, you will land on the Tour Book where you can upload your first broker survey to get started.
                </p>
              </div>

              {/* Error */}
              {createError && (
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.8125rem', color: '#dc2626', marginBottom: '1rem' }}>
                  {createError}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: '#64748b',
                    background: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={creatingProject || !newProjectName.trim()}
                  style={{
                    padding: '0.625rem 1.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '0.625rem',
                    cursor: creatingProject || !newProjectName.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: creatingProject || !newProjectName.trim() ? 0.6 : 1,
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {creatingProject ? (
                    <>
                      <div style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Change Password Modal -- */}
      {showPasswordModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPasswordModal(false) }}
        >
          <div style={{ background: '#fff', borderRadius: '1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 24px 48px rgba(0,0,0,0.16)', width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'var(--font-display)' }}>Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            {passwordSuccess ? (
              <div style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: '0.875rem', fontWeight: 500, textAlign: 'center' }}>
                Password updated successfully.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus
                    style={{ width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '0.625rem', background: '#f8fafc', color: '#0f172a', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>New Password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '0.625rem', background: '#f8fafc', color: '#0f172a', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword() }}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', fontSize: '0.875rem', border: '1px solid #e2e8f0', borderRadius: '0.625rem', background: '#f8fafc', color: '#0f172a', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
                {passwordError && (
                  <div style={{ padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.8125rem', color: '#dc2626', marginBottom: '1rem' }}>{passwordError}</div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowPasswordModal(false)} style={{ padding: '0.625rem 1.25rem', fontSize: '0.8125rem', fontWeight: 500, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '0.625rem', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  <button onClick={handleChangePassword} disabled={changingPassword}
                    style={{ padding: '0.625rem 1.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: '0.625rem', cursor: changingPassword ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: changingPassword ? 0.6 : 1 }}>
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* -- Delete Confirmation Modal -- */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '1.25rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px rgba(0,0,0,0.16)',
              width: '100%',
              maxWidth: '420px',
              overflow: 'hidden',
              animation: 'fadeUp 0.3s ease-out',
            }}
          >
            <div style={{ padding: '1.5rem' }}>
              {/* Warning icon */}
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                background: 'rgba(220,38,38,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>

              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
                Delete Project
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 0.25rem' }}>
                Are you sure you want to delete <strong style={{ color: '#0f172a' }}>{deleteTarget.name}</strong>?
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                This will permanently remove the project and all its data including team members, survey results, financials, and photos. This cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: '#64748b',
                    background: 'transparent',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.625rem',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={deleting}
                  style={{
                    padding: '0.625rem 1.5rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#ffffff',
                    background: '#dc2626',
                    border: 'none',
                    borderRadius: '0.625rem',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: deleting ? 0.7 : 1,
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {deleting ? (
                    <>
                      <div style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Deleting...
                    </>
                  ) : (
                    'Delete Project'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
