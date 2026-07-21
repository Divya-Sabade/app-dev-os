import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { callExtractionModel } from '@/lib/openai'
import { buildNDAExtractionPrompt } from '@/prompts/extraction-nda'
import { buildMSAExtractionPrompt } from '@/prompts/extraction-msa'
import { getExtractionLimiter, checkRateLimit as checkUpstashLimit } from '@/lib/ratelimit'
import { processBodySchema } from '@/lib/security/inputValidator'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rateLimiter'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Primary Supabase rate limit (5/hr), Upstash as secondary if configured
  const { limited: dbLimited, resetIn: dbResetIn } = await checkRateLimit(user.id, RATE_LIMITS.process)
  if (dbLimited) return rateLimitResponse(dbResetIn)

  const { limited, resetIn } = await checkUpstashLimit(getExtractionLimiter(), user.id)
  if (limited) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${resetIn}s.`, code: 'RATE_LIMIT' },
      { status: 429, headers: { 'Retry-After': String(resetIn) } }
    )
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = processBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input', code: 'VALIDATION_ERROR' },
      { status: 422 }
    )
  }

  const { contract_id, custom_terms } = parsed.data

  // Injection guard on custom term names before they enter the AI prompt
  for (const term of custom_terms) {
    const check = sanitizeForLLM(term)
    if (!check.safe) {
      return NextResponse.json(
        { error: 'Custom term contains disallowed content', code: 'PROMPT_INJECTION' },
        { status: 400 }
      )
    }
  }

  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('id, user_id, contract_text, contract_type')
    .eq('id', contract_id)
    .single()

  if (fetchError || !contract) {
    return NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  if (contract.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  await supabase.from('contracts').update({ status: 'processing' }).eq('id', contract_id)

  const prompt =
    contract.contract_type === 'nda'
      ? buildNDAExtractionPrompt(contract.contract_text, custom_terms)
      : buildMSAExtractionPrompt(contract.contract_text, custom_terms)

  let rawContent: string
  try {
    rawContent = await callExtractionModel(prompt)
  } catch {
    await supabase.from('contracts').update({ status: 'error' }).eq('id', contract_id)
    return NextResponse.json({ error: 'AI extraction failed. Please try again.', code: 'AI_ERROR', retry: true }, { status: 502 })
  }

  let parsed2: { terms: any[] }
  try {
    parsed2 = JSON.parse(rawContent)
    if (!Array.isArray(parsed2.terms)) throw new Error('No terms array')
  } catch {
    try {
      const retryContent = await callExtractionModel({
        system: prompt.system,
        user: `Your previous response was not valid JSON. Return only the JSON object with a "terms" array, no explanation, no markdown.\n\n${prompt.user}`,
      })
      parsed2 = JSON.parse(retryContent)
    } catch {
      await supabase.from('contracts').update({ status: 'error' }).eq('id', contract_id)
      return NextResponse.json({ error: 'AI returned invalid response. Please try again.', code: 'AI_ERROR', retry: true }, { status: 502 })
    }
  }

  const customTermNames = new Set(custom_terms.map((t: string) => t.toLowerCase()))

  const validTerms = parsed2.terms.filter(
    (t: any) =>
      typeof t.term_name === 'string' &&
      typeof t.value === 'string' &&
      typeof t.page_number === 'number' &&
      Number.isInteger(t.page_number) &&
      t.page_number >= 1 &&
      typeof t.confidence_score === 'number' &&
      t.confidence_score >= 0 &&
      t.confidence_score <= 1 &&
      typeof t.source_sentence === 'string'
  )

  const rows = validTerms.map((term: any, index: number) => ({
    contract_id,
    user_id: user.id,
    term_name: String(term.term_name).slice(0, 120),
    value: String(term.value).slice(0, 1000),
    ai_value: String(term.value).slice(0, 1000),
    page_number: term.page_number,
    confidence_score: term.confidence_score,
    source_sentence: String(term.source_sentence).slice(0, 2000),
    is_manual: customTermNames.has(term.term_name.toLowerCase()),
    is_edited: false,
    sort_order: index,
  }))

  const { data: keyTerms, error: insertError } = await supabase
    .from('key_terms')
    .insert(rows)
    .select()

  if (insertError) {
    await supabase.from('contracts').update({ status: 'error' }).eq('id', contract_id)
    return NextResponse.json({ error: 'Failed to save key terms', code: 'DB_ERROR' }, { status: 500 })
  }

  await supabase.from('contracts').update({ status: 'complete' }).eq('id', contract_id)

  return NextResponse.json({ key_terms: keyTerms })
}
