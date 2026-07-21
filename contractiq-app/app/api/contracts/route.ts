import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') ?? 'date'
  const order = searchParams.get('order') ?? 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
  const offset = (page - 1) * limit

  const sortColumn = sort === 'name' ? 'contract_name' : sort === 'type' ? 'contract_type' : 'created_at'
  const ascending = order === 'asc'

  const { data: contracts, error, count } = await supabase
    .from('contracts')
    .select('id, contract_name, contract_type, status, page_count, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order(sortColumn, { ascending })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch contracts', code: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ contracts: contracts ?? [], total: count ?? 0, page, limit })
}
