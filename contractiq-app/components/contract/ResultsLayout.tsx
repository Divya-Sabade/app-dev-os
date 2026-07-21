'use client'
import { useState, lazy, Suspense } from 'react'
import KeyTermsPanel from './KeyTermsPanel'
import FeedbackModal from './FeedbackModal'
import type { Contract, KeyTerm, ChatSession } from '@/types'

const PDFViewer = lazy(() => import('./PDFViewer'))
const ChatInterface = lazy(() => import('./ChatInterface'))

interface ResultsLayoutProps {
  contract: Contract
  keyTerms: KeyTerm[]
  chatSessionId: string | null
}

type RightTab = 'terms' | 'chat'

export default function ResultsLayout({ contract, keyTerms: initialTerms, chatSessionId }: ResultsLayoutProps) {
  const [targetPage, setTargetPage] = useState(1)
  const [keyTerms, setKeyTerms] = useState(initialTerms)
  const [activeTab, setActiveTab] = useState<RightTab>('terms')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  function handleTermEdit(id: string, newValue: string) {
    setKeyTerms(prev =>
      prev.map(t => t.id === id ? { ...t, value: newValue, is_edited: true } : t)
    )
  }

  const contractTypeBadge = contract.contract_type === 'nda'
    ? 'NDA'
    : 'MSA'

  return (
    <>
      {/* Page header */}
      <div className="bg-white border-b border-grey-100 px-8 py-3 flex items-center gap-3 shrink-0">
        <h1
          className="text-sm font-semibold text-grey-900 truncate max-w-[360px]"
          title={contract.contract_name}
        >
          {contract.contract_name}
        </h1>
        <span
          className={`badge ${contract.contract_type === 'nda' ? 'badge-info' : ''}`}
          style={contract.contract_type === 'msa' ? { backgroundColor: '#F7F0FF', borderColor: '#E3C7FF', color: '#6600CC' } : {}}
        >
          {contractTypeBadge}
        </span>
        <span className="text-xs text-grey-400 ml-auto">
          {contract.page_count} pages
        </span>
      </div>

      {/* Two-panel body */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 128px)' }}
      >
        {/* Left: PDF/Text viewer */}
        <div className="flex-[55] border-r border-grey-100 overflow-hidden">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center bg-grey-25">
                <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <PDFViewer
              contractId={contract.id}
              contractText={contract.contract_text}
              targetPage={targetPage}
            />
          </Suspense>
        </div>

        {/* Right: Key Terms / Chat */}
        <div className="flex-[45] flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="bg-white border-b border-grey-100 flex shrink-0">
            {(['terms', 'chat'] as RightTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors',
                  activeTab === tab
                    ? 'text-brand-500 border-b-2 border-brand-500'
                    : 'text-grey-400 hover:text-grey-700',
                ].join(' ')}
              >
                {tab === 'terms' ? `Key Terms (${keyTerms.length})` : 'Chat'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'terms' ? (
              <KeyTermsPanel
                keyTerms={keyTerms}
                onPageNavigate={setTargetPage}
                onTermEdit={handleTermEdit}
                onFeedbackOpen={() => setFeedbackOpen(true)}
              />
            ) : (
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center">
                    <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <ChatInterface
                  contractId={contract.id}
                  initialSessionId={chatSessionId}
                  onPageNavigate={setTargetPage}
                />
              </Suspense>
            )}
          </div>
        </div>
      </div>

      {feedbackOpen && (
        <FeedbackModal
          contractId={contract.id}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </>
  )
}
