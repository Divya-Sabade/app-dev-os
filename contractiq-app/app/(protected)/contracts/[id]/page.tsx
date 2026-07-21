import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import ResultsLayout from '@/components/contract/ResultsLayout'
import RunAnalysisPrompt from '@/components/contract/RunAnalysisPrompt'
import type { Contract, KeyTerm } from '@/types'

export default async function ContractResultsPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createSupabaseServerClient()

  const [
    { data: contract, error: contractError },
    { data: keyTerms },
    { data: chatSession },
  ] = await Promise.all([
    supabase
      .from('contracts')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase
      .from('key_terms')
      .select('*')
      .eq('contract_id', params.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('chat_sessions')
      .select('id')
      .eq('contract_id', params.id)
      .maybeSingle(),
  ])

  if (contractError || !contract) {
    redirect('/dashboard')
  }

  await supabase
    .from('contracts')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', params.id)

  if (contract.status === 'pending') {
    return (
      <RunAnalysisPrompt
        contractId={contract.id}
        contractName={contract.contract_name}
      />
    )
  }

  if (contract.status === 'processing') {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="text-center max-w-sm">
          <span className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <h2 className="text-base font-semibold text-grey-900 mb-2">Analyzing contract…</h2>
          <p className="text-sm text-grey-500">Refresh the page in a moment to see the results.</p>
        </div>
      </div>
    )
  }

  if (contract.status === 'error') {
    return (
      <RunAnalysisPrompt
        contractId={contract.id}
        contractName={contract.contract_name}
      />
    )
  }

  return (
    <ResultsLayout
      contract={contract as Contract}
      keyTerms={(keyTerms ?? []) as KeyTerm[]}
      chatSessionId={chatSession?.id ?? null}
    />
  )
}
