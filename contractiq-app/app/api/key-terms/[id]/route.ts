import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { keyTermUpdateSchema } from '@/lib/security/inputValidator'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const rawBody = await request.json().catch(() => null)
  const parsed = keyTermUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('key_terms')
    .update({ value: parsed.data.value.trim(), is_edited: true })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update term', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, value: data.value, is_edited: true, ai_value: data.ai_value })
}
