'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RunAnalysisPromptProps {
  contractId: string
  contractName: string
}

export default function RunAnalysisPrompt({ contractId, contractName }: RunAnalysisPromptProps) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleRun() {
    setStatus('running')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contractId, custom_terms: [] }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Analysis failed')
      }

      // Poll until complete
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const pollRes = await fetch(`/api/contracts/${contractId}`)
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          if (pollData.contract?.status === 'complete') {
            router.refresh()
            return
          }
          if (pollData.contract?.status === 'error') {
            throw new Error('Analysis failed. Please try again.')
          }
        }
      }
      throw new Error('Analysis timed out. Please try again.')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="text-center max-w-sm">
        {status === 'running' ? (
          <>
            <span className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin inline-block mb-4" />
            <h2 className="text-base font-semibold text-grey-900 mb-2">Analyzing contract…</h2>
            <p className="text-sm text-grey-500">This typically takes 10–30 seconds.</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-grey-900 mb-2">Analysis not yet run</h2>
            <p className="text-sm text-grey-500 mb-1 truncate max-w-xs mx-auto">{contractName}</p>
            <p className="text-sm text-grey-400 mb-6">
              Run AI analysis to extract key terms and unlock chat.
            </p>
            {errorMsg && (
              <p className="text-sm text-error-600 mb-4">{errorMsg}</p>
            )}
            <button
              onClick={handleRun}
              className="px-6 py-2.5 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
            >
              Run Analysis
            </button>
          </>
        )}
      </div>
    </div>
  )
}
