import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, user_id')
    .eq('id', params.sessionId)
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found', code: 'NOT_FOUND' }, { status: 404 })
  if (session.user_id !== user.id) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', params.sessionId)
    .order('created_at', { ascending: true })
    .limit(200)

  return NextResponse.json({ messages: messages ?? [], session_id: params.sessionId })
}
