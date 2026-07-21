'use client'
import { useState } from 'react'

interface SourceSentenceTooltipProps {
  sourceSentence: string
}

export default function SourceSentenceTooltip({ sourceSentence }: SourceSentenceTooltipProps) {
  const [expanded, setExpanded] = useState(false)

  if (!sourceSentence || sourceSentence.trim() === '') return null

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-grey-400 hover:text-brand-500 transition-colors flex items-center gap-1"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {expanded ? 'Hide source' : 'Show source'}
      </button>
      {expanded && (
        <div className="mt-2">
          <p className="text-xs text-grey-400 mb-1">Source text from document:</p>
          <blockquote className="source-sentence">{sourceSentence}</blockquote>
        </div>
      )}
    </div>
  )
}
