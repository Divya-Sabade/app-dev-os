import TermCard from './TermCard'
import type { KeyTerm } from '@/types'

interface KeyTermsPanelProps {
  keyTerms: KeyTerm[]
  onPageNavigate: (page: number) => void
  onTermEdit: (id: string, newValue: string) => void
  onFeedbackOpen: () => void
}

export default function KeyTermsPanel({
  keyTerms,
  onPageNavigate,
  onTermEdit,
  onFeedbackOpen,
}: KeyTermsPanelProps) {
  const standardTerms = keyTerms.filter(t => !t.is_manual)
  const customTerms = keyTerms.filter(t => t.is_manual)

  if (keyTerms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-grey-500">No terms extracted yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {standardTerms.map(term => (
          <TermCard
            key={term.id}
            term={term}
            onPageNavigate={onPageNavigate}
            onEdit={onTermEdit}
          />
        ))}

        {customTerms.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-grey-100" />
              <span className="text-xs font-medium text-grey-400 uppercase tracking-wide">
                Custom Terms
              </span>
              <div className="flex-1 h-px bg-grey-100" />
            </div>
            {customTerms.map(term => (
              <TermCard
                key={term.id}
                term={term}
                onPageNavigate={onPageNavigate}
                onEdit={onTermEdit}
              />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-grey-100 p-4 shrink-0">
        <button
          onClick={onFeedbackOpen}
          className="w-full py-2 text-sm font-medium text-grey-500 hover:text-grey-900 border border-grey-100 rounded hover:bg-grey-25 transition-colors"
        >
          Rate this analysis
        </button>
      </div>
    </div>
  )
}
