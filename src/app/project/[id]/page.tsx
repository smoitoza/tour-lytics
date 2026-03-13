'use client'

import { createClient } from '@/lib/supabase-browser'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

export default function ProjectPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

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
        <div className="animate-pulse text-navy-400">Loading project...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-navy-50">
      {/* Compact top bar */}
      <header className="bg-white border-b border-navy-200 flex-shrink-0">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 no-underline text-navy-900 hover:text-accent transition-colors">
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
            <div className="h-5 w-px bg-navy-200" />
            <div>
              <h1 className="text-sm font-semibold text-navy-900" style={{ fontFamily: 'var(--font-display)' }}>
                SF Office Search
              </h1>
              <p className="text-[0.7rem] text-navy-400">San Francisco, CA</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-navy-400 hidden sm:inline">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-navy-500 hover:text-navy-700 bg-transparent border border-navy-200 rounded-md px-2.5 py-1 cursor-pointer transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Full app iframe */}
      <div className="flex-1 relative">
        <iframe
          src="/app/index.html"
          className="absolute inset-0 w-full h-full border-none"
          title="SF Office Search Application"
        />
      </div>
    </div>
  )
}
