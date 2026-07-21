import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { SIGNED_URL_EXPIRY_SECONDS } from '@/lib/constants'

export async function GET(request: NextRequest, { params }: { params: { contractId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })

  const { data: contract } = await supabase
    .from('contracts')
    .select('file_path, user_id')
    .eq('id', params.contractId)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contract not found', code: 'NOT_FOUND' }, { status: 404 })
  if (contract.user_id !== user.id) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (!contract.file_path) return NextResponse.json({ error: 'PDF file not available', code: 'NO_FILE_PATH' }, { status: 404 })

  const { data, error } = await supabase.storage
    .from('contracts')
    .createSignedUrl(contract.file_path, SIGNED_URL_EXPIRY_SECONDS)

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to generate signed URL', code: 'STORAGE_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ signed_url: data.signedUrl })
}
