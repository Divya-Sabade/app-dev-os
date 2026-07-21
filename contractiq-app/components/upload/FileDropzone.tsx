'use client'
import { useRef, useState } from 'react'
import { MAX_FILE_SIZE_BYTES } from '@/lib/constants'

interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  error: string | null
  disabled?: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function FileDropzone({ onFileSelect, error, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      onFileSelect(file) // let parent handle error
      setSelectedFile(file)
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      onFileSelect(file)
      setSelectedFile(file)
      return
    }
    setSelectedFile(file)
    onFileSelect(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-grey-900 mb-2">
        PDF Contract <span className="text-error-500">*</span>
      </label>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          'border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          dragging
            ? 'border-brand-500 bg-brand-50'
            : error
            ? 'border-error-500 bg-error-50'
            : selectedFile && !error
            ? 'border-success-500 bg-success-50'
            : 'border-grey-200 bg-white hover:border-brand-500 hover:bg-grey-25',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />

        {selectedFile && !error ? (
          <>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="16" fill="#E7F6E7" />
              <path d="M10 16l4 4 8-8" stroke="#13A10E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-grey-900">{selectedFile.name}</p>
              <p className="text-xs text-grey-500 mt-0.5">{formatBytes(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (inputRef.current) inputRef.current.value = '' }}
              className="text-xs text-grey-400 hover:text-error-500 transition-colors"
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="6" y="4" width="20" height="24" rx="2" fill="#F0F0F1" />
              <path d="M6 4h14l6 6v18a2 2 0 01-2 2H8a2 2 0 01-2-2V4z" fill="#DADADB" />
              <path d="M20 4l6 6h-6V4z" fill="#C1C2C3" />
              <path d="M12 16h8M16 12v8" stroke="#8F9193" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-grey-900">
                Drop PDF here or <span className="text-brand-500">browse</span>
              </p>
              <p className="text-xs text-grey-500 mt-1">PDF only · max 10 MB · max 20 pages</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-error-500 mt-2">{error}</p>
      )}
    </div>
  )
}
