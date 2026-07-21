'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Contract } from '@/types'

interface ContractRowProps {
  contract: Pick<Contract, 'id' | 'contract_name' | 'contract_type' | 'status' | 'page_count' | 'created_at'>
}

function TypeBadge({ type }: { type: 'nda' | 'msa' }) {
  if (type === 'nda') {
    return <span className="badge badge-info">NDA</span>
  }
  return (
    <span
      className="badge"
      style={{ backgroundColor: '#F7F0FF', borderColor: '#E3C7FF', color: '#6600CC' }}
    >
      MSA
    </span>
  )
}

function StatusBadge({ status }: { status: Contract['status'] }) {
  switch (status) {
    case 'complete':
      return <span className="badge badge-success">Complete</span>
    case 'processing':
    case 'pending':
      return <span className="badge badge-warning">Processing</span>
    case 'error':
      return <span className="badge badge-error">Error</span>
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ContractRow({ contract }: ContractRowProps) {
  const router = useRouter()
  const nameDisplay =
    contract.contract_name.length > 60
      ? contract.contract_name.slice(0, 57) + '…'
      : contract.contract_name

  return (
    <tr
      onClick={() => router.push(`/contracts/${contract.id}`)}
      className="cursor-pointer hover:bg-grey-25 transition-colors border-t border-grey-50"
    >
      <td className="px-4 py-3 text-sm text-grey-900 font-medium max-w-[320px]">
        <span title={contract.contract_name}>{nameDisplay}</span>
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={contract.contract_type} />
      </td>
      <td className="px-4 py-3 text-sm text-grey-500">{contract.page_count}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={contract.status} />
          {contract.status === 'error' && (
            <Link
              href="/upload"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-brand-500 hover:underline"
            >
              Retry
            </Link>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-grey-500">{formatDate(contract.created_at)}</td>
    </tr>
  )
}
