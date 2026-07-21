import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { extractTextWithPageMarkers } from '@/lib/pdf'
import { validateExtractedText } from '@/lib/validation'
import { NDA_STANDARD_TERMS, MSA_STANDARD_TERMS } from '@/lib/constants'
import { validateFileUpload } from '@/lib/security/inputValidator'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '@/lib/security/rateLimiter'

const ALLOWED_CONTRACT_TYPES = new Set(['nda', 'msa'])

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { limited, resetIn } = await checkRateLimit(user.id, RATE_LIMITS.upload)
  if (limited) return rateLimitResponse(resetIn)

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const contractType = formData.get('contract_type') as string | null
  const contractName = formData.get('contract_name') as string | null

  if (!file || !contractType || !contractName) {
    return NextResponse.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, { status: 400 })
  }

  // Validate contract type before touching the file
  if (!ALLOWED_CONTRACT_TYPES.has(contractType)) {
    return NextResponse.json({ error: 'contract_type must be "nda" or "msa"', code: 'INVALID_CONTRACT_TYPE' }, { status: 422 })
  }

  // Extension + MIME + size check (replaces old validateFileType/validateFileSize)
  const fileCheck = validateFileUpload(file)
  if (!fileCheck.valid) {
    return NextResponse.json({ error: fileCheck.error, code: 'INVALID_FILE' }, { status: fileCheck.status ?? 415 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { text, pageCount } = await extractTextWithPageMarkers(buffer)

  const textCheck = validateExtractedText(text, pageCount)
  if (!textCheck.valid) {
    return NextResponse.json({ error: textCheck.message, code: textCheck.errorCode }, { status: textCheck.status })
  }

  const tokenCount = Math.ceil(text.length / 4)
  const sanitisedName = contractName.replace(/[^a-zA-Z0-9.\-_\s]/g, '_').trim().slice(0, 255)

  const { data: contract, error: insertError } = await supabase
    .from('contracts')
    .insert({
      user_id: user.id,
      contract_name: sanitisedName || 'Untitled',
      contract_type: contractType,
      contract_text: text,
      file_path: null,
      status: 'pending',
      page_count: pageCount,
      token_count: tokenCount,
    })
    .select('id')
    .single()

  if (insertError || !contract) {
    return NextResponse.json({ error: 'Failed to create contract', code: 'DB_ERROR' }, { status: 500 })
  }

  // Non-blocking Storage upload — private bucket, path scoped to user
  const storageName = contractName.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 100)
  const filePath = `contracts/${user.id}/${contract.id}/${storageName}.pdf`
  supabase.storage
    .from('contracts')
    .upload(filePath, buffer, { contentType: 'application/pdf' })
    .then(({ error }) => {
      if (!error) {
        supabase.from('contracts').update({ file_path: filePath }).eq('id', contract.id)
      }
    })

  const standardTermsPreview = contractType === 'nda' ? NDA_STANDARD_TERMS : MSA_STANDARD_TERMS

  return NextResponse.json({
    contract_id: contract.id,
    page_count: pageCount,
    token_count: tokenCount,
    standard_terms_preview: standardTermsPreview,
  })
}
