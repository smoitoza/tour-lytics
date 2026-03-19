'use client'

import { createClient } from '@/lib/supabase-browser'
import { useState, useEffect } from 'react'
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

export default function LoginPage() {
  const searchParams = useSearchParams()
  const startOnSignUp = searchParams.get('signup') === 'true'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isSignUp, setIsSignUp] = useState(startOnSignUp)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  // Sync isSignUp with URL param on mount
  useEffect(() => {
    if (startOnSignUp) setIsSignUp(true)
  }, [startOnSignUp])

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
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p
            style={{
              fontSize: '0.875rem',
              color: '#64748b',
              textAlign: 'center',
              marginBottom: '2rem',
            }}
          >
            {isSignUp
              ? 'Get started with Tour-Lytics'
              : 'Sign in to your Tour-Lytics account'}
          </p>

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
                  <span style={{ color: '#2563eb', fontWeight: 500 }}>Terms of Service</span>{' '}
                  and{' '}
                  <span style={{ color: '#2563eb', fontWeight: 500 }}>Privacy Policy</span>
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
