interface ContractTypeSelectorProps {
  value: 'nda' | 'msa' | null
  onChange: (type: 'nda' | 'msa') => void
}

export default function ContractTypeSelector({ value, onChange }: ContractTypeSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-grey-900 mb-2">
        Contract Type <span className="text-error-500">*</span>
      </label>
      <div className="flex gap-3">
        {(['nda', 'msa'] as const).map((type) => {
          const selected = value === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={[
                'flex-1 py-3 rounded border text-sm font-semibold transition-colors',
                selected
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-white border-grey-100 text-grey-500 hover:border-brand-500 hover:text-brand-500',
              ].join(' ')}
            >
              {type.toUpperCase()}
              <span className="ml-2 text-xs font-normal opacity-75">
                {type === 'nda' ? 'Non-Disclosure Agreement' : 'Master Service Agreement'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
