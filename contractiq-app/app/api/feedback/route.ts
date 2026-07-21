import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { feedbackBodySchema } from '@/lib/security/inputValidator'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const rawBody = await request.json().catch(() => null)
  const parsed = feedbackBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  const { contract_id, rating, comment } = parsed.data

  const { data: contract } = await supabase
    .from('contracts')
    .select('user_id')
    .eq('id', contract_id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 })
  if (contract.user_id !== user.id) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const { data, error } = await supabase
    .from('user_feedback')
    .insert({ contract_id, user_id: user.id, rating, comment: comment ?? null })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to save feedback', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
