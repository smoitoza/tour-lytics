'use client'

import { createClient } from '@/lib/supabase-browser'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()

  // Check that we have a valid recovery session
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      } else {
        setError('Invalid or expired reset link. Please request a new one.')
      }
    })
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
    }

    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
          background:
            'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(37,99,235,0.08) 0%, transparent 70%)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }}>
        {/* Logo */}
        <Link
          href="/"
          className="no-underline"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            justifyContent: 'center',
            marginBottom: '2.5rem',
            textDecoration: 'none',
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 40 40"
            fill="none"
            aria-label="TourLytics logo"
          >
            <rect x="2" y="2" width="36" height="36" rx="8" stroke="white" strokeWidth="2.5" />
            <path
              d="M12 14h16M20 14v14"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="20" cy="10" r="2" fill="#2563eb" />
            <path
              d="M10 28l6-8 4 5 4-6 6 9"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '1.25rem',
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            Tour<span style={{ color: '#2563eb' }}>Lytics</span>
          </span>
        </Link>

        {/* Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#0f172a',
              textAlign: 'center',
              marginBottom: '0.25rem',
            }}
          >
            {success ? 'Password Updated' : 'Set New Password'}
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              textAlign: 'center',
              marginBottom: '2rem',
            }}
          >
            {success
              ? 'Redirecting you to your dashboard...'
              : 'Choose a new password for your account'}
          </p>

          {success ? (
            <div
              style={{
                fontSize: '0.875rem',
                color: '#16a34a',
                background: '#f0fdf4',
                borderRadius: '0.5rem',
                padding: '0.625rem 0.875rem',
                textAlign: 'center',
              }}
            >
              Your password has been updated successfully.
            </div>
          ) : !sessionReady && error ? (
            <>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#dc2626',
                  background: '#fef2f2',
                  borderRadius: '0.5rem',
                  padding: '0.625rem 0.875rem',
                  marginBottom: '1.25rem',
                }}
              >
                {error}
              </div>
              <Link
                href="/login"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  color: '#2563eb',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="newPassword"
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#334155',
                    marginBottom: '0.375rem',
                  }}
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box' as const,
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="confirmPassword"
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#334155',
                    marginBottom: '0.375rem',
                  }}
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box' as const,
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0' }}
                />
              </div>

              {error && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#dc2626',
                    background: '#fef2f2',
                    borderRadius: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    marginBottom: '1rem',
                  }}
                >
                  {error}
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
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer links */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap' as const,
          }}
        >
          <Link
            href="/terms"
            style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.75rem' }}
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.75rem' }}
          >
            Privacy
          </Link>
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.75rem' }}
          >
            Created with Perplexity Computer
          </a>
        </div>
      </div>
    </div>
  )
}
