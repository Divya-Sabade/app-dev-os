import { createSupabaseServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

type AuthSuccess = { user: User; response?: never }
type AuthFailure = { user?: never; response: NextResponse }

export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    }
  }
  return { user }
}
