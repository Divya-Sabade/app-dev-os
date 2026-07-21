'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ContractRow from './ContractRow'
import type { Contract } from '@/types'

type SortKey = 'date' | 'name' | 'type'
type SortOrder = 'asc' | 'desc'

interface ContractListProps {
  contracts: Pick<Contract, 'id' | 'contract_name' | 'contract_type' | 'status' | 'page_count' | 'created_at'>[]
  total: number
  sort: SortKey
  order: SortOrder
  currentPage: number
  limit: number
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return <span className="text-grey-200 ml-1">↕</span>
  return <span className="text-brand-500 ml-1">{order === 'asc' ? '↑' : '↓'}</span>
}

export default function ContractList({
  contracts,
  total,
  sort,
  order,
  currentPage,
  limit,
}: ContractListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function buildUrl(params: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => next.set(k, v))
    return `/dashboard?${next.toString()}`
  }

  function handleSort(col: SortKey) {
    if (col === sort) {
      router.push(buildUrl({ sort: col, order: order === 'asc' ? 'desc' : 'asc', page: '1' }))
    } else {
      router.push(buildUrl({ sort: col, order: 'desc', page: '1' }))
    }
  }

  const totalPages = Math.ceil(total / limit)
  const start = (currentPage - 1) * limit + 1
  const end = Math.min(currentPage * limit, total)

  if (contracts.length === 0) {
    return (
      <div className="bg-white border border-grey-100 rounded-lg flex flex-col items-center justify-center py-20 gap-4">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="8" y="6" width="32" height="36" rx="3" fill="#F0F0F1" />
          <rect x="14" y="14" width="20" height="2" rx="1" fill="#C1C2C3" />
          <rect x="14" y="20" width="16" height="2" rx="1" fill="#C1C2C3" />
          <rect x="14" y="26" width="12" height="2" rx="1" fill="#C1C2C3" />
        </svg>
        <div className="text-center">
          <p className="text-base font-medium text-grey-900 mb-1">No contracts reviewed yet</p>
          <p className="text-sm text-grey-500">Upload your first contract to begin.</p>
        </div>
        <Link
          href="/upload"
          className="mt-2 px-5 py-2.5 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
        >
          Review a Contract
        </Link>
      </div>
    )
  }

  const columns: { key: SortKey; label: string; sortable: boolean }[] = [
    { key: 'name', label: 'Contract Name', sortable: true },
    { key: 'type', label: 'Type', sortable: true },
  ]

  return (
    <div className="bg-white border border-grey-100 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-grey-25">
              <th
                className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => handleSort('name')}
              >
                Contract Name <SortIcon active={sort === 'name'} order={order} />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => handleSort('type')}
              >
                Type <SortIcon active={sort === 'type'} order={order} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">
                Pages
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase tracking-wide">
                Status
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-grey-500 uppercase tracking-wide cursor-pointer select-none"
                onClick={() => handleSort('date')}
              >
                Date <SortIcon active={sort === 'date'} order={order} />
              </th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <ContractRow key={contract.id} contract={contract} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-grey-50">
          <span className="text-xs text-grey-500">
            Showing {start}–{end} of {total} contracts
          </span>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => router.push(buildUrl({ page: String(currentPage - 1) }))}
              className="px-3 py-1.5 text-xs rounded border border-grey-100 text-grey-500 hover:bg-grey-25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => router.push(buildUrl({ page: String(currentPage + 1) }))}
              className="px-3 py-1.5 text-xs rounded border border-grey-100 text-grey-500 hover:bg-grey-25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
