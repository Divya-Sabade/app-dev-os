import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rateLimiter'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  // Rate limit by IP (auth is pre-auth, no userId available)
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  const { limited, resetIn } = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.auth)
  if (limited) return rateLimitResponse(resetIn)

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' },
      { status: 401 }
    )
  }

  return NextResponse.json({ user: { id: data.user?.id, email: data.user?.email } })
}
