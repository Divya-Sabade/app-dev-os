interface TermsPreviewCardProps {
  contractType: 'nda' | 'msa'
  standardTerms: string[]
  customTerms: string[]
  pageCount: number
  tokenCount: number | null
}

export default function TermsPreviewCard({
  contractType,
  standardTerms,
  customTerms,
  pageCount,
  tokenCount,
}: TermsPreviewCardProps) {
  return (
    <div className="bg-white border border-grey-100 rounded-lg p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-grey-900">
          Ready to analyze
        </h3>
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{contractType.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-grey-400 text-xs">Pages</span>
          <p className="font-medium text-grey-900">{pageCount}</p>
        </div>
        {tokenCount != null && (
          <div>
            <span className="text-grey-400 text-xs">Estimated tokens</span>
            <p className="font-medium text-grey-900">{tokenCount.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-grey-500 uppercase tracking-wide mb-2">
          Standard terms to extract ({standardTerms.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {standardTerms.map((term) => (
            <span key={term} className="badge badge-neutral">{term}</span>
          ))}
        </div>
      </div>

      {customTerms.length > 0 && (
        <div>
          <p className="text-xs font-medium text-grey-500 uppercase tracking-wide mb-2">
            Custom terms ({customTerms.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {customTerms.map((term) => (
              <span key={term} className="badge-custom">{term}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
