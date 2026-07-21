import type { Contract } from '@/types'

interface StatsRowProps {
  contracts: Pick<Contract, 'contract_type'>[]
  total: number
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-white border border-grey-100 rounded-lg p-6 flex flex-col gap-1">
      <span className="text-3xl font-semibold text-grey-900">{value}</span>
      <span className="text-sm text-grey-500">{label}</span>
    </div>
  )
}

export default function StatsRow({ contracts, total }: StatsRowProps) {
  const ndaCount = contracts.filter(c => c.contract_type === 'nda').length
  const msaCount = contracts.filter(c => c.contract_type === 'msa').length

  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard value={total} label="Contracts Reviewed" />
      <StatCard value={ndaCount} label="NDAs" />
      <StatCard value={msaCount} label="MSAs" />
    </div>
  )
}
