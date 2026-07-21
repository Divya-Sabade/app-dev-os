import { CONFIDENCE_HIGH_THRESHOLD, CONFIDENCE_LOW_THRESHOLD } from '@/lib/constants'

interface ConfidenceIndicatorProps {
  score: number
}

export default function ConfidenceIndicator({ score }: ConfidenceIndicatorProps) {
  const pct = Math.round(score * 100)

  if (score >= CONFIDENCE_HIGH_THRESHOLD) {
    return (
      <span className="confidence-high text-xs font-medium px-2 py-0.5 rounded-full">
        {pct}%
      </span>
    )
  }
  if (score >= CONFIDENCE_LOW_THRESHOLD) {
    return (
      <span className="confidence-medium text-xs font-medium px-2 py-0.5 rounded-full">
        {pct}%
      </span>
    )
  }
  return (
    <span className="confidence-low text-xs font-medium px-2 py-0.5 rounded-full">
      ⚠️ {pct}%
    </span>
  )
}
