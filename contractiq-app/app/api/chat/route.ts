import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { callChatModel } from '@/lib/openai'
import { buildChatPrompt, classifyQuery } from '@/prompts/chat'
import { getChatLimiter, checkRateLimit as checkUpstashLimit } from '@/lib/ratelimit'
import { chatBodySchema } from '@/lib/security/inputValidator'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { verifyContractOwnership, verifySessionOwnership } from '@/lib/security/chatSecurity'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rateLimiter'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  // Primary Supabase rate limit (30/min), Upstash as secondary if configured
  const { limited: dbLimited, resetIn: dbResetIn } = await checkRateLimit(user.id, RATE_LIMITS.chat)
  if (dbLimited) return rateLimitResponse(dbResetIn)

  const { limited, resetIn } = await checkUpstashLimit(getChatLimiter(), user.id)
  if (limited) {
    return NextResponse.json(
      { error: `Too many messages. Try again in ${resetIn}s.`, code: 'RATE_LIMIT' },
      { status: 429, headers: { 'Retry-After': String(resetIn) } }
    )
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = chatBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  const { contract_id, session_id, message } = parsed.data

  // Prompt injection guard — before any DB or AI calls
  const injectionCheck = sanitizeForLLM(message)
  if (!injectionCheck.safe) {
    return NextResponse.json(
      { error: 'Message contains disallowed content', code: 'PROMPT_INJECTION' },
      { status: 400 }
    )
  }

  // Verify contract ownership AND status === 'complete'
  const contractResult = await verifyContractOwnership(contract_id, user.id)
  if (contractResult.error) return contractResult.error

  // Resolve or create chat session
  let activeSessionId = session_id ?? null

  if (activeSessionId) {
    // Verify the provided session belongs to this user
    const sessionResult = await verifySessionOwnership(activeSessionId, user.id)
    if (sessionResult.error) return sessionResult.error
  } else {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({ contract_id, user_id: user.id })
      .select('id')
      .single()
    activeSessionId = newSession?.id ?? null
  }

  // Load history BEFORE saving the new message — classifier must see prior turns only
  const { data: history } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', activeSessionId)
    .order('created_at', { ascending: true })
    .limit(200)

  const queryType = classifyQuery(message)
  const messages = buildChatPrompt(contractResult.contract.contract_text, history ?? [], message, queryType)

  // Save user message after classification
  await supabase.from('chat_messages').insert({
    session_id: activeSessionId,
    user_id: user.id,
    role: 'user',
    content: message,
  })

  let aiContent: string
  try {
    aiContent = await callChatModel(messages)
  } catch (err: unknown) {
    console.error('[chat] OpenAI error:', err)
    return NextResponse.json({ error: 'AI response failed. Please try again.', code: 'AI_ERROR' }, { status: 502 })
  }

  const { data: assistantMsg } = await supabase
    .from('chat_messages')
    .insert({ session_id: activeSessionId, user_id: user.id, role: 'assistant', content: aiContent })
    .select()
    .single()

  return NextResponse.json({
    id: assistantMsg?.id,
    role: 'assistant',
    content: aiContent,
    created_at: assistantMsg?.created_at,
    session_id: activeSessionId,
    context_type: queryType,
  })
}
