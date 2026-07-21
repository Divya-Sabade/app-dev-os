interface ProcessingProgressProps {
  currentStep: 1 | 2 | 3
  steps: string[]
}

export default function ProcessingProgress({ currentStep, steps }: ProcessingProgressProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, index) => {
        const stepNum = index + 1
        const isComplete = stepNum < currentStep
        const isActive = stepNum === currentStep

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  isComplete
                    ? 'bg-success-500 text-white'
                    : isActive
                    ? 'bg-brand-500 text-white'
                    : 'bg-grey-100 text-grey-400',
                ].join(' ')}
              >
                {isComplete ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7l3 3 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={[
                  'text-xs whitespace-nowrap',
                  isComplete
                    ? 'text-success-700 font-medium'
                    : isActive
                    ? 'text-brand-500 font-medium'
                    : 'text-grey-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-2 mb-4 transition-colors',
                  stepNum < currentStep ? 'bg-success-500' : 'bg-grey-100',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
