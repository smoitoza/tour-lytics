'use client'

import { createClient } from '@/lib/supabase-browser'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-950 flex items-center justify-center px-6 relative overflow-hidden">
      {/* Background effects */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 justify-center mb-10 no-underline">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-label="Tour-Lytics logo">
            <rect x="2" y="2" width="36" height="36" rx="8" stroke="white" strokeWidth="2.5" />
            <path d="M12 14h16M20 14v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="20" cy="10" r="2" fill="#2563eb" />
            <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-bold text-xl text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Tour<span className="text-[#2563eb]">-Lytics</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <h1
            className="text-2xl font-bold text-navy-900 mb-1 text-center"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-sm text-navy-500 text-center mb-8">
            {isSignUp
              ? 'Get started with Tour-Lytics'
              : 'Sign in to your Tour-Lytics account'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-navy-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-navy-200 text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-navy-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-navy-200 text-navy-900 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            {message && (
              <div className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-2.5">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-accent-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-navy-500">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setIsSignUp(false); setError(null); setMessage(null) }}
                  className="text-accent font-medium hover:text-accent-hover bg-transparent border-none cursor-pointer"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setIsSignUp(true); setError(null); setMessage(null) }}
                  className="text-accent font-medium hover:text-accent-hover bg-transparent border-none cursor-pointer"
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-navy-500">
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-navy-300 transition-colors no-underline text-navy-500"
          >
            Created with Perplexity Computer
          </a>
        </div>
      </div>
    </div>
  )
}
