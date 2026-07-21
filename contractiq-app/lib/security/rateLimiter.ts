import { createSupabaseServiceClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

type RateLimitConfig = {
  action: string
  limit: number
  windowSeconds: number
}

export const RATE_LIMITS = {
  auth: { action: 'auth', limit: 10, windowSeconds: 60 },
  chat: { action: 'chat', limit: 30, windowSeconds: 60 },
  process: { action: 'process', limit: 5, windowSeconds: 3600 },
  upload: { action: 'upload', limit: 20, windowSeconds: 86400 },
} as const satisfies Record<string, RateLimitConfig>

export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<{ limited: boolean; resetIn: number }> {
  try {
    const supabase = createSupabaseServiceClient()
    const windowStart = new Date(Date.now() - config.windowSeconds * 1000).toISOString()

    const { count } = await supabase
      .from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', config.action)
      .gte('created_at', windowStart)

    if ((count ?? 0) >= config.limit) {
      return { limited: true, resetIn: config.windowSeconds }
    }

    await supabase
      .from('rate_limit_events')
      .insert({ user_id: userId, action: config.action })

    return { limited: false, resetIn: 0 }
  } catch {
    // Fail-open: if the rate_limit_events table doesn't exist yet, allow the request
    console.warn('[rateLimiter] Rate limit check failed — table may not exist yet. Run supabase/rls-policies.sql.')
    return { limited: false, resetIn: 0 }
  }
}

export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    { error: `Rate limit exceeded. Try again in ${resetIn}s.`, code: 'RATE_LIMIT' },
    {
      status: 429,
      headers: { 'Retry-After': String(resetIn) },
    }
  )
}
