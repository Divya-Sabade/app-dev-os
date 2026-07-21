'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ContractTypeSelector from '@/components/upload/ContractTypeSelector'
import FileDropzone from '@/components/upload/FileDropzone'
import CustomTermInput from '@/components/upload/CustomTermInput'
import ProcessingProgress from '@/components/upload/ProcessingProgress'
import TermsPreviewCard from '@/components/upload/TermsPreviewCard'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants'

type Step = 'upload' | 'preview' | 'processing'

interface UploadResult {
  contract_id: string
  page_count: number
  token_count: number | null
  standard_terms_preview: string[]
}

const PROGRESS_STEPS = ['Uploading…', 'Extracting text…', 'Analyzing with AI…']

export default function UploadPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>('upload')
  const [contractType, setContractType] = useState<'nda' | 'msa' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [customTerms, setCustomTerms] = useState<string[]>([])

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [progressStep, setProgressStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  function handleFileSelect(selected: File) {
    setError(null)
    if (selected.type !== 'application/pdf') {
      setFileError('Only PDF files are accepted')
      setFile(null)
      return
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File must be under 10 MB')
      setFile(null)
      return
    }
    setFileError(null)
    setFile(selected)
  }

  async function handleUpload() {
    if (!file || !contractType) return

    setError(null)
    setStep('processing')
    setProgressStep(1)

    try {
      // Step 1: Upload PDF
      const formData = new FormData()
      formData.append('file', file)
      formData.append('contract_type', contractType)
      formData.append('contract_name', file.name)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })

      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}))
        throw new Error(body.error ?? 'Upload failed. Please try again.')
      }

      const uploadData: UploadResult = await uploadRes.json()
      setProgressStep(2)
      setUploadResult(uploadData)
      setStep('preview')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStep('upload')
    }
  }

  async function handleProcess() {
    if (!uploadResult) return

    setError(null)
    setStep('processing')
    setProgressStep(2)

    try {
      // Step 2: Extract key terms via AI
      setProgressStep(3)
      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: uploadResult.contract_id,
          custom_terms: customTerms,
        }),
      })

      if (!processRes.ok) {
        const body = await processRes.json().catch(() => ({}))
        throw new Error(body.error ?? 'Analysis failed. Please try again.')
      }

      // Poll until status = 'complete'
      await pollForCompletion(uploadResult.contract_id)
      router.push(`/contracts/${uploadResult.contract_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStep('preview')
    }
  }

  async function pollForCompletion(contractId: string) {
    const maxAttempts = 20
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const res = await fetch(`/api/contracts/${contractId}`)
      if (!res.ok) continue
      const data = await res.json()
      if (data.status === 'complete') return
      if (data.status === 'error') throw new Error('Analysis failed. Please try again.')
    }
    throw new Error('Analysis timed out. Please try again.')
  }

  function handleRetry() {
    setError(null)
    setRetrying(true)
    setStep('upload')
    setFile(null)
    setFileError(null)
    setUploadResult(null)
    setProgressStep(1)
    setRetrying(false)
  }

  const canUpload = !!file && !fileError && !!contractType

  if (step === 'processing') {
    return (
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="bg-white border border-grey-100 rounded-lg p-10 w-full max-w-lg flex flex-col gap-8">
          <div>
            <h2 className="text-xl font-semibold text-grey-900 mb-1">Analyzing your contract</h2>
            <p className="text-sm text-grey-500">This typically takes 10–30 seconds.</p>
          </div>
          <ProcessingProgress
            currentStep={progressStep}
            steps={PROGRESS_STEPS}
          />
          {error && (
            <div className="bg-error-50 border border-error-100 rounded p-4">
              <p className="text-sm text-error-700 mb-3">{error}</p>
              <button
                onClick={handleRetry}
                className="text-sm font-medium text-brand-500 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'preview' && uploadResult) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-10">
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-grey-900">Ready to analyze</h1>
            <p className="text-sm text-grey-500 mt-1">
              Review the terms below, then run the analysis.
            </p>
          </div>

          <TermsPreviewCard
            contractType={contractType!}
            standardTerms={uploadResult.standard_terms_preview}
            customTerms={customTerms}
            pageCount={uploadResult.page_count}
            tokenCount={uploadResult.token_count}
          />

          <CustomTermInput terms={customTerms} onChange={setCustomTerms} />

          {error && (
            <div className="bg-error-50 border border-error-100 rounded p-4">
              <p className="text-sm text-error-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="flex-1 py-3 rounded border border-grey-100 text-sm font-medium text-grey-500 hover:bg-grey-25 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleProcess}
              className="flex-1 py-3 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
            >
              Run Analysis
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step: upload
  return (
    <div className="flex-1 flex items-center justify-center px-8 py-10">
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-grey-900">Review a Contract</h1>
          <p className="text-sm text-grey-500 mt-1">
            Upload an NDA or MSA to extract key terms automatically.
          </p>
        </div>

        <div className="bg-white border border-grey-100 rounded-lg p-6 flex flex-col gap-6">
          <ContractTypeSelector value={contractType} onChange={setContractType} />
          <FileDropzone onFileSelect={handleFileSelect} error={fileError} />
        </div>

        {error && (
          <div className="bg-error-50 border border-error-100 rounded p-4">
            <p className="text-sm text-error-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="w-full py-3 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Upload & Extract Text
        </button>
      </div>
    </div>
  )
}
