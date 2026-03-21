'use client'

import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

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
  created_at: string
  updated_at: string
}

export default function ProjectPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const tabParam = searchParams.get('tab')

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

  /* Fetch project details */
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects?email=`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const found = data.find((p: Project) => p.id === projectId)
          if (found) setProject(found)
        }
      })
      .catch(() => { /* use defaults */ })
  }, [projectId])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ color: '#94a3b8', fontFamily: 'var(--font-display)' }}>Loading project...</div>
      </div>
    )
  }

  return (
    <>
      {/* Use window.innerHeight so the shell fits the real visible area on iOS Safari */}
      <style>{`
        .project-shell { height: var(--app-height, 100vh); display: flex; flex-direction: column; background: #f8fafc; overflow: hidden; }
        .project-header { background: #ffffff; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
        .project-iframe-wrap { flex: 1; position: relative; min-height: 0; }
        .project-iframe-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
      `}</style>
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var s = function() { document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px'); };
          s(); window.addEventListener('resize', s);
          window.addEventListener('orientationchange', function() { setTimeout(s, 150); });
        })();
      `}} />

      <div className="project-shell">
        {/* Compact top bar - hidden on mobile, project info moves to bottom tab bar inside iframe */}
        <header className="project-header">
          <div style={{ padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Link href="/dashboard" className="no-underline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0f172a', textDecoration: 'none' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-label="Tour-Lytics logo">
                  <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="20" cy="10" r="2" fill="#2563eb" />
                  <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <div style={{ height: '1.25rem', width: '1px', background: '#e2e8f0' }} />
              <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                  {project?.name || projectId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </h1>
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>{project?.market || ''}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{user?.email}</span>
              <button
                onClick={handleSignOut}
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  background: 'transparent',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.375rem',
                  padding: '0.25rem 0.625rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Full app iframe - pass user email for survey submission */}
        <div className="project-iframe-wrap">
          <iframe
            src={`/app/index.html?userEmail=${encodeURIComponent(user?.email || '')}&projectId=${encodeURIComponent(projectId)}&v=${Date.now()}${tabParam ? '#' + tabParam : ''}`}
            title={project?.name || 'Project Application'}
          />
        </div>
      </div>
    </>
  )
}
