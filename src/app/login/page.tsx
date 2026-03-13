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
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background effects */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 70%)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <Link href="/" className="no-underline" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '2.5rem', textDecoration: 'none' }}>
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" aria-label="Tour-Lytics logo">
            <rect x="2" y="2" width="36" height="36" rx="8" stroke="white" strokeWidth="2.5" />
            <path d="M12 14h16M20 14v14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="20" cy="10" r="2" fill="#2563eb" />
            <path d="M10 28l6-8 4 5 4-6 6 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'white', letterSpacing: '-0.02em' }}>
            Tour<span style={{ color: '#2563eb' }}>-Lytics</span>
          </span>
        </Link>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#0f172a',
            textAlign: 'center',
            marginBottom: '0.25rem',
          }}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            textAlign: 'center',
            marginBottom: '2rem',
          }}>
            {isSignUp
              ? 'Get started with Tour-Lytics'
              : 'Sign in to your Tour-Lytics account'}
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.375rem' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                placeholder="you@company.com"
              />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.375rem' }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.875rem',
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                placeholder="At least 6 characters"
              />
            </div>

            {error && (
              <div style={{
                fontSize: '0.875rem',
                color: '#dc2626',
                background: '#fef2f2',
                borderRadius: '0.5rem',
                padding: '0.625rem 0.875rem',
                marginBottom: '1rem',
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{
                fontSize: '0.875rem',
                color: '#16a34a',
                background: '#f0fdf4',
                borderRadius: '0.5rem',
                padding: '0.625rem 0.875rem',
                marginBottom: '1rem',
              }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#2563eb',
                color: 'white',
                padding: '0.625rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setIsSignUp(false); setError(null); setMessage(null) }}
                  style={{ color: '#2563eb', fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => { setIsSignUp(true); setError(null); setMessage(null) }}
                  style={{ color: '#2563eb', fontWeight: 500, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem' }}>
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#64748b', textDecoration: 'none' }}
          >
            Created with Perplexity Computer
          </a>
        </div>
      </div>
    </div>
  )
}
