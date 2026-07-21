'use client'
import { useState, useEffect } from 'react'
import type { KeyTerm } from '@/types'

interface TermEditModalProps {
  term: KeyTerm
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, newValue: string) => void
}

export default function TermEditModal({ term, isOpen, onClose, onSave }: TermEditModalProps) {
  const [value, setValue] = useState(term.value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(term.value)
      setError(null)
    }
  }, [isOpen, term.value])

  if (!isOpen) return null

  async function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) {
      setError('Value cannot be empty')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/key-terms/${term.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to save. Please try again.')
      }
      onSave(term.id, trimmed)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-grey-900 opacity-40" aria-hidden="true" />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-grey-900">Edit Term</h3>
          <button
            onClick={onClose}
            className="text-grey-400 hover:text-grey-700 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">Term</label>
          <p className="text-sm font-medium text-grey-900">{term.term_name}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">Original AI value</label>
          <p className="text-sm text-grey-500 italic bg-grey-25 px-3 py-2 rounded">{term.ai_value}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-grey-500 mb-1">
            Corrected value
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-grey-100 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 text-grey-900 resize-none"
            placeholder="Enter corrected value…"
          />
        </div>

        {error && (
          <p className="text-xs text-error-500">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded border border-grey-100 text-sm font-medium text-grey-500 hover:bg-grey-25 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="flex-1 py-2.5 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
