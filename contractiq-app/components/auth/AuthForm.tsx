'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

interface AuthFormProps {
  mode: 'signin' | 'signup'
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const isSignUp = mode === 'signup'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.includes('@')) return setError('Please enter a valid email address')
    if (password.length < 8) return setError('Password must be at least 8 characters')

    setLoading(true)
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          // Email confirmation required — show confirmation message
          setEmailSent(true)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const redirect = searchParams.get('redirect') ?? '/dashboard'
        router.push(redirect.startsWith('/') ? redirect : '/dashboard')
      }
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('already registered') || msg.includes('User already registered')) {
        setError('An account with this email already exists')
      } else if (msg.includes('Invalid login credentials')) {
        setError('Invalid email or password')
      } else if (msg.includes('Email not confirmed')) {
        setError('Please verify your email before signing in')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <main className="min-h-screen hero-gradient flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            We sent a confirmation link to <span className="font-medium text-gray-700">{email}</span>.
            Click it to activate your account and sign in.
          </p>
          <p className="text-xs text-gray-400">
            Didn't receive it? Check your spam folder or{' '}
            <button
              onClick={() => setEmailSent(false)}
              className="text-brand-500 hover:underline"
            >
              try again
            </button>
            .
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen hero-gradient flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {isSignUp ? 'Start reviewing contracts in minutes.' : 'Sign in to your ContractIQ account.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-grey-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-grey-900 placeholder-grey-300"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 border border-grey-100 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-grey-900 placeholder-grey-300"
              placeholder="Minimum 8 characters"
            />
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isSignUp ? (
            <>Already have an account?{' '}<Link href="/signin" className="text-brand-500 font-medium hover:underline">Sign in</Link></>
          ) : (
            <>No account?{' '}<Link href="/signup" className="text-brand-500 font-medium hover:underline">Get started free</Link></>
          )}
        </p>
      </div>
    </main>
  )
}
