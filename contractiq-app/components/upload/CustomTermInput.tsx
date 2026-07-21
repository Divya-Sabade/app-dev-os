'use client'
import { useState, useRef } from 'react'
import { MAX_CUSTOM_TERMS } from '@/lib/constants'

interface CustomTermInputProps {
  terms: string[]
  onChange: (terms: string[]) => void
}

export default function CustomTermInput({ terms, onChange }: CustomTermInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addTerm() {
    const trimmed = input.trim()
    if (!trimmed) return

    if (terms.length >= MAX_CUSTOM_TERMS) {
      setError(`Maximum ${MAX_CUSTOM_TERMS} custom terms allowed`)
      return
    }
    if (trimmed.length > 60) {
      setError('Term must be 60 characters or fewer')
      return
    }
    if (terms.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError('This term has already been added')
      return
    }

    setError(null)
    onChange([...terms, trimmed])
    setInput('')
  }

  function removeTerm(index: number) {
    onChange(terms.filter((_, i) => i !== index))
    setError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTerm()
    }
  }

  const remaining = MAX_CUSTOM_TERMS - terms.length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-grey-900">
          Custom Terms <span className="text-grey-400 font-normal">(optional)</span>
        </label>
        <span className="text-xs text-grey-400">
          {remaining} remaining
        </span>
      </div>

      {terms.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {terms.map((term, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-grey-50 border border-grey-100 text-grey-700 text-xs font-medium px-3 py-1 rounded"
            >
              {term}
              <button
                type="button"
                onClick={() => removeTerm(i)}
                className="ml-0.5 text-grey-400 hover:text-error-500 transition-colors leading-none"
                aria-label={`Remove ${term}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
          disabled={remaining === 0}
          placeholder={remaining === 0 ? 'Maximum terms reached' : 'e.g. Data Retention, Audit Rights'}
          maxLength={60}
          className="flex-1 px-3 py-2 text-sm border border-grey-100 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 text-grey-900 placeholder-grey-300 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={addTerm}
          disabled={remaining === 0 || !input.trim()}
          className="px-4 py-2 text-sm font-medium rounded border border-grey-100 text-grey-700 hover:bg-grey-25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>

      {error && <p className="text-xs text-error-500 mt-1.5">{error}</p>}

      <p className="text-xs text-grey-400 mt-1.5">
        Press Enter or click Add. Up to {MAX_CUSTOM_TERMS} terms, each ≤ 60 characters.
      </p>
    </div>
  )
}
