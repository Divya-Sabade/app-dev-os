'use client'
import { useState } from 'react'

interface FeedbackModalProps {
  contractId: string
  onClose: () => void
}

type RatingValue = 'up' | 'down' | null

export default function FeedbackModal({ contractId, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState<RatingValue>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!rating) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          rating,
          comment: comment.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to submit feedback. Please try again.')
      }
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-grey-900 opacity-40" aria-hidden="true" />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-grey-900">Rate this analysis</h3>
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

        {submitted ? (
          <div className="py-4 text-center">
            <div className="w-12 h-12 bg-success-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l5 5L20 7" stroke="#13A10E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-grey-900">Thank you for your feedback!</p>
            <p className="text-xs text-grey-500 mt-1">Your input helps us improve ContractIQ.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm font-medium rounded bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div>
              <p className="text-sm text-grey-700 mb-3">Was this analysis helpful?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRating('up')}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded border text-sm font-medium transition-colors',
                    rating === 'up'
                      ? 'bg-success-50 border-success-200 text-success-700'
                      : 'border-grey-100 text-grey-500 hover:border-success-200 hover:text-success-700',
                  ].join(' ')}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 9l1-5h8l1 5v6H4V9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M4 9H2V15h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M9 4V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Yes, helpful
                </button>
                <button
                  onClick={() => setRating('down')}
                  className={[
                    'flex-1 flex items-center justify-center gap-2 py-3 rounded border text-sm font-medium transition-colors',
                    rating === 'down'
                      ? 'bg-error-50 border-error-200 text-error-700'
                      : 'border-grey-100 text-grey-500 hover:border-error-200 hover:text-error-700',
                  ].join(' ')}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="rotate-180">
                    <path d="M4 9l1-5h8l1 5v6H4V9z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M4 9H2V15h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M9 4V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Needs work
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-grey-500 mb-1.5">
                Comments <span className="text-grey-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="What could be improved?"
                className="w-full px-3 py-2 text-sm border border-grey-100 rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 text-grey-900 placeholder-grey-300"
              />
              <p className="text-xs text-grey-300 text-right mt-0.5">
                {comment.length}/500
              </p>
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
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="flex-1 py-2.5 rounded bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
