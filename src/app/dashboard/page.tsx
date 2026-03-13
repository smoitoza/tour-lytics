'use client'

import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

/* Projects data -- will eventually come from DB */
const projects = [
  {
    id: 'sf-office-search',
    name: 'San Francisco Office Search',
    market: 'San Francisco, CA',
    buildings: 33,
    sqft: '2.8M+',
    shortlisted: 4,
    status: 'Active',
    lastUpdated: 'Mar 13, 2026',
    color: '#f47920',
  },
]

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
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
        <div style={{ color: '#94a3b8', fontFamily: 'var(--font-display)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" className="no-underline" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#0f172a', textDecoration: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-label="Tour-Lytics logo">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="10" r="2" fill="#2563eb" />
              <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              Tour<span style={{ color: '#2563eb' }}>-Lytics</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{user?.email}</span>
            <button
              onClick={handleSignOut}
              style={{
                fontSize: '0.875rem',
                color: '#64748b',
                background: 'transparent',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.375rem 0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#334155' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem', width: '100%', flex: 1 }}>
        {/* Welcome section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Dashboard
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Your Projects
          </h1>
          <p style={{ fontSize: '0.9375rem', color: '#64748b', lineHeight: 1.6 }}>
            Select a project to view your market analysis, financials, and tour book.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="no-underline"
              style={{
                display: 'block',
                background: '#ffffff',
                borderRadius: '1rem',
                border: '1px solid #e2e8f0',
                padding: '1.5rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(37,99,235,0.3)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Status + arrow */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: `${project.color}15`,
                  color: project.color,
                }}>
                  <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: project.color }} />
                  {project.status}
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>

              {/* Project info */}
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>
                {project.name}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.25rem' }}>{project.market}</p>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{project.buildings}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Buildings</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{project.sqft}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Sq Ft</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>{project.shortlisted}</div>
                  <div style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>Shortlisted</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Updated</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#475569' }}>{project.lastUpdated}</div>
                </div>
              </div>
            </Link>
          ))}

          {/* Add new project card */}
          <div style={{
            borderRadius: '1rem',
            border: '2px dashed #e2e8f0',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '240px',
            textAlign: 'center',
            transition: 'border-color 0.2s',
            cursor: 'default',
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.75rem',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>New Project</p>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Coming soon</p>
          </div>
        </div>
      </main>

      {/* Footer */}
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
    </div>
  )
}
