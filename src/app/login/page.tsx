'use client'

import { createClient } from '@/lib/supabase-browser'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

/* Reusable styled input */
function FormInput({
  id,
  label,
  type = 'text',
  required = true,
  value,
  onChange,
  placeholder,
  minLength,
}: {
  id: string
  label: string
  type?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minLength?: number
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#334155',
          marginBottom: '0.375rem',
        }}
      >
        {label}
        {!required && (
          <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: '0.25rem' }}>(optional)</span>
        )}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
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
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#2563eb'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#e2e8f0'
        }}
        placeholder={placeholder}
      />
    </div>
  )
}

function LoginPageInner() {
  const searchParams = useSearchParams()
  const startOnSignUp = searchParams.get('signup') === 'true'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isSignUp, setIsSignUp] = useState(startOnSignUp)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  // Sync isSignUp with URL param on mount
  useEffect(() => {
    if (startOnSignUp) setIsSignUp(true)
  }, [startOnSignUp])

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Check your email for a password reset link.')
    }

    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    // Validate ToS agreement on sign up
    if (isSignUp && !agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to create an account.')
      setLoading(false)
      return
    }

    const supabase = createClient()

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          data: {
            full_name: fullName.trim(),
            company: company.trim() || null,
            job_title: jobTitle.trim() || null,
            agreed_to_terms: true,
            agreed_at: new Date().toISOString(),
          },
        },
      })
      if (error) {
        setError(error.message)
      } else if (data?.user) {
        // Email verification is disabled, so sign them in directly
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setMessage('Account created. Please sign in with your credentials.')
          setIsSignUp(false)
        } else {
          router.push('/dashboard')
          router.refresh()
        }
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
            aria-label="Tour-Lytics logo"
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
            Tour<span style={{ color: '#2563eb' }}>-Lytics</span>
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
            {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              textAlign: 'center',
              marginBottom: '2rem',
            }}
          >
            {isForgotPassword
              ? 'Enter your email and we will send you a reset link'
              : isSignUp
                ? 'Get started with TourLytics'
                : 'Sign in to your TourLytics account'}
          </p>

          {/* Google Sign-In button - shown on sign in and sign up, not forgot password */}
          {!isForgotPassword && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.625rem',
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  cursor: googleLoading ? 'not-allowed' : 'pointer',
                  opacity: googleLoading ? 0.5 : 1,
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#334155',
                }}
                onMouseEnter={(e) => { if (!googleLoading) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? 'Connecting...' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  margin: '1.25rem 0',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              </div>
            </>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword}>
              <FormInput
                id="resetEmail"
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
              />

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

              {message && (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#16a34a',
                    background: '#f0fdf4',
                    borderRadius: '0.5rem',
                    padding: '0.625rem 0.875rem',
                    marginBottom: '1rem',
                  }}
                >
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
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false)
                    setError(null)
                    setMessage(null)
                  }}
                  style={{
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.875rem',
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (

          <form onSubmit={handleSubmit}>
            {/* Sign-up only fields */}
            {isSignUp && (
              <>
                <FormInput
                  id="fullName"
                  label="Full Name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Scott Moitoza"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <FormInput
                    id="company"
                    label="Company"
                    required={false}
                    value={company}
                    onChange={setCompany}
                    placeholder="Acme Corp"
                  />
                  <FormInput
                    id="jobTitle"
                    label="Job Title"
                    required={false}
                    value={jobTitle}
                    onChange={setJobTitle}
                    placeholder="Director of RE"
                  />
                </div>
              </>
            )}

            <FormInput
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
            />

            <FormInput
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
              minLength={6}
            />

            {/* Forgot password link - sign in only */}
            {!isSignUp && (
              <div style={{ textAlign: 'right', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true)
                    setError(null)
                    setMessage(null)
                  }}
                  style={{
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Terms checkbox - sign up only */}
            {isSignUp && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginBottom: '1.25rem',
                  marginTop: '0.25rem',
                }}
              >
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    marginTop: '2px',
                    accentColor: '#2563eb',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <label
                  htmlFor="terms"
                  style={{
                    fontSize: '0.8125rem',
                    color: '#64748b',
                    lineHeight: 1.4,
                    cursor: 'pointer',
                  }}
                >
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                  >
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
            )}

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

            {message && (
              <div
                style={{
                  fontSize: '0.875rem',
                  color: '#16a34a',
                  background: '#f0fdf4',
                  borderRadius: '0.5rem',
                  padding: '0.625rem 0.875rem',
                  marginBottom: '1rem',
                }}
              >
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
              {loading
                ? 'Loading...'
                : isSignUp
                  ? 'Create Account'
                  : 'Sign In'}
            </button>
          </form>
          )}

          {!isForgotPassword && (
          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.875rem',
              color: '#64748b',
            }}
          >
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setIsSignUp(false)
                    setError(null)
                    setMessage(null)
                  }}
                  style={{
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button
                  onClick={() => {
                    setIsSignUp(true)
                    setError(null)
                    setMessage(null)
                  }}
                  style={{
                    color: '#2563eb',
                    fontWeight: 500,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                  }}
                >
                  Create one
                </button>
              </>
            )}
          </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading...</div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}
