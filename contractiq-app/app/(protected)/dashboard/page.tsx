import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase'
import StatsRow from '@/components/dashboard/StatsRow'
import ContractList from '@/components/dashboard/ContractList'
import type { Contract } from '@/types'

type SortKey = 'date' | 'name' | 'type'
type SortOrder = 'asc' | 'desc'

const SORT_COLUMN_MAP: Record<SortKey, string> = {
  date: 'created_at',
  name: 'contract_name',
  type: 'contract_type',
}

const LIMIT = 20

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { sort?: string; order?: string; page?: string }
}) {
  const sort = (['date', 'name', 'type'].includes(searchParams.sort ?? '')
    ? searchParams.sort
    : 'date') as SortKey
  const order = (['asc', 'desc'].includes(searchParams.order ?? '')
    ? searchParams.order
    : 'desc') as SortOrder
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const offset = (page - 1) * LIMIT

  const supabase = createSupabaseServerClient()

  const [{ data: contracts, error }, { count }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, contract_name, contract_type, status, page_count, created_at')
      .order(SORT_COLUMN_MAP[sort], { ascending: order === 'asc' })
      .range(offset, offset + LIMIT - 1),
    supabase
      .from('contracts')
      .select('id', { count: 'exact', head: true }),
  ])

  const contractList = (contracts ?? []) as Pick<
    Contract,
    'id' | 'contract_name' | 'contract_type' | 'status' | 'page_count' | 'created_at'
  >[]

  const total = count ?? 0

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-error-500 mb-2">Failed to load contracts</p>
          <Link href="/dashboard" className="text-sm text-brand-500 hover:underline">
            Try again
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 px-8 py-10 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-grey-900">Dashboard</h1>
          <p className="text-sm text-grey-500 mt-1">Your contract review history</p>
        </div>
        <Link
          href="/upload"
          className="px-5 py-2.5 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
        >
          Review a Contract
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        <StatsRow contracts={contractList} total={total} />
        <ContractList
          contracts={contractList}
          total={total}
          sort={sort}
          order={order}
          currentPage={page}
          limit={LIMIT}
        />
      </div>
    </div>
  )
}
