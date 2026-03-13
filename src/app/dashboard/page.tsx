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
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="animate-pulse text-navy-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Top bar */}
      <header className="bg-white border-b border-navy-200">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 no-underline text-navy-900">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-label="Tour-Lytics logo">
              <rect x="2" y="2" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
              <path d="M12 14h16M20 14v14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="20" cy="10" r="2" fill="#2563eb" />
              <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-bold text-base tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Tour<span className="text-accent">-Lytics</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-navy-500">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-navy-500 hover:text-navy-700 bg-transparent border border-navy-200 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="mb-8">
          <h1
            className="text-2xl font-bold text-navy-900 mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Your Projects
          </h1>
          <p className="text-sm text-navy-500">Select a project to view your market analysis, financials, and tour book.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.id}`}
              className="group bg-white rounded-xl border border-navy-200 p-6 hover:border-accent/30 hover:shadow-lg transition-all duration-200 no-underline"
            >
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-semibold uppercase tracking-wide"
                  style={{
                    background: `${project.color}15`,
                    color: project.color,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: project.color }} />
                  {project.status}
                </span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-navy-300 group-hover:text-accent group-hover:translate-x-1 transition-all duration-200"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>

              {/* Project info */}
              <h2 className="text-lg font-bold text-navy-900 mb-1 group-hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                {project.name}
              </h2>
              <p className="text-sm text-navy-500 mb-4">{project.market}</p>

              {/* Stats */}
              <div className="flex gap-6 pt-4 border-t border-navy-100">
                <div>
                  <div className="text-lg font-bold text-navy-900" style={{ fontFamily: 'var(--font-display)' }}>{project.buildings}</div>
                  <div className="text-[0.7rem] text-navy-400 uppercase tracking-wide font-medium">Buildings</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-navy-900" style={{ fontFamily: 'var(--font-display)' }}>{project.sqft}</div>
                  <div className="text-[0.7rem] text-navy-400 uppercase tracking-wide font-medium">Sq Ft</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-xs text-navy-400">Updated</div>
                  <div className="text-xs font-medium text-navy-600">{project.lastUpdated}</div>
                </div>
              </div>
            </Link>
          ))}

          {/* Add new project card (placeholder) */}
          <div className="rounded-xl border-2 border-dashed border-navy-200 p-6 flex flex-col items-center justify-center min-h-[220px] text-center hover:border-accent/40 transition-colors cursor-default">
            <div className="w-12 h-12 rounded-full bg-navy-100 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-navy-400">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-navy-500">New Project</p>
            <p className="text-xs text-navy-400 mt-1">Coming soon</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-navy-400">
        <a
          href="https://www.perplexity.ai/computer"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-navy-500 transition-colors no-underline text-navy-400"
        >
          Created with Perplexity Computer
        </a>
      </footer>
    </div>
  )
}
