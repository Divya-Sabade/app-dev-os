import { createSupabaseServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

type ContractRow = { id: string; user_id: string; contract_text: string; status: string }

type ContractResult =
  | { contract: ContractRow; error?: never }
  | { contract?: never; error: NextResponse }

type SessionResult =
  | { valid: true; error?: never }
  | { valid?: never; error: NextResponse }

export async function verifyContractOwnership(
  contractId: string,
  userId: string
): Promise<ContractResult> {
  const supabase = createSupabaseServerClient()
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, user_id, contract_text, status')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return {
      error: NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 }),
    }
  }
  if (contract.user_id !== userId) {
    return {
      error: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }
  if (contract.status !== 'complete') {
    return {
      error: NextResponse.json(
        { error: 'Contract analysis is not yet complete', code: 'NOT_READY' },
        { status: 409 }
      ),
    }
  }

  return { contract }
}

export async function verifySessionOwnership(
  sessionId: string,
  userId: string
): Promise<SessionResult> {
  const supabase = createSupabaseServerClient()
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return {
      error: NextResponse.json({ error: 'Chat session not found', code: 'NOT_FOUND' }, { status: 404 }),
    }
  }
  if (session.user_id !== userId) {
    return {
      error: NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }

  return { valid: true }
}
