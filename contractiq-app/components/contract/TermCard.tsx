'use client'
import { useState } from 'react'
import ConfidenceIndicator from './ConfidenceIndicator'
import SourceSentenceTooltip from './SourceSentenceTooltip'
import TermEditModal from './TermEditModal'
import type { KeyTerm } from '@/types'
import { CONFIDENCE_LOW_THRESHOLD } from '@/lib/constants'

interface TermCardProps {
  term: KeyTerm
  onPageNavigate: (page: number) => void
  onEdit: (id: string, newValue: string) => void
}

export default function TermCard({ term, onPageNavigate, onEdit }: TermCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [localTerm, setLocalTerm] = useState(term)

  function handleSave(id: string, newValue: string) {
    setLocalTerm(prev => ({ ...prev, value: newValue, is_edited: true }))
    onEdit(id, newValue)
  }

  const isNotFound = localTerm.value === 'Not found'
  const showLowConfidenceWarning = localTerm.confidence_score < CONFIDENCE_LOW_THRESHOLD && !isNotFound

  return (
    <>
      <div className="bg-white border border-grey-100 rounded-lg p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h4 className="text-sm font-semibold text-grey-900">{localTerm.term_name}</h4>
            {localTerm.is_edited && (
              <span className="badge-edited">Edited</span>
            )}
            {localTerm.is_manual && !localTerm.is_edited && (
              <span className="badge-custom">Custom</span>
            )}
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="shrink-0 p-1 text-grey-300 hover:text-brand-500 transition-colors"
            aria-label={`Edit ${localTerm.term_name}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {isNotFound ? (
          <p className="text-sm text-grey-400 italic">Not found</p>
        ) : (
          <p className="text-sm text-grey-700 leading-relaxed">{localTerm.value}</p>
        )}

        {showLowConfidenceWarning && (
          <p className="confidence-warning">
            ⚠️ Low confidence — verify this in the document directly.
          </p>
        )}

        <div className="flex items-center gap-3 mt-1">
          {localTerm.page_number > 0 && (
            <button
              onClick={() => onPageNavigate(localTerm.page_number)}
              className="text-xs text-brand-500 hover:underline font-medium"
            >
              Page {localTerm.page_number}
            </button>
          )}
          {!isNotFound && (
            <ConfidenceIndicator score={localTerm.confidence_score} />
          )}
        </div>

        {!isNotFound && (
          <SourceSentenceTooltip sourceSentence={localTerm.source_sentence} />
        )}
      </div>

      <TermEditModal
        term={localTerm}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}
