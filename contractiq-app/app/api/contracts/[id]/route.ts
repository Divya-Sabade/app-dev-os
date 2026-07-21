import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !contract) return NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 })

  const { data: keyTerms } = await supabase
    .from('key_terms')
    .select('*')
    .eq('contract_id', params.id)
    .order('sort_order', { ascending: true })

  const { data: chatSession } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', params.id)
    .eq('user_id', user.id)
    .single()

  await supabase.from('contracts').update({ last_accessed_at: new Date().toISOString() }).eq('id', params.id)

  return NextResponse.json({
    contract,
    key_terms: keyTerms ?? [],
    chat_session_id: chatSession?.id ?? null,
  })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, file_path, user_id')
    .eq('id', params.id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  if (contract.user_id !== user.id) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  if (contract.file_path) {
    await supabase.storage.from('contracts').remove([contract.file_path])
  }

  await supabase.from('contracts').delete().eq('id', params.id)

  return NextResponse.json({ success: true })
}
