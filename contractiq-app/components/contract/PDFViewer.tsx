'use client'
import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import TextViewer from './TextViewer'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  contractId: string
  contractText: string
  targetPage: number
}

export default function PDFViewer({ contractId, contractText, targetPage }: PDFViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [pdfAvailable, setPdfAvailable] = useState<boolean | null>(null) // null = loading
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    fetch(`/api/storage/signed-url/${contractId}`)
      .then(async (res) => {
        if (!res.ok) {
          setPdfAvailable(false)
          return
        }
        const data = await res.json()
        setSignedUrl(data.signed_url)
        setPdfAvailable(true)
      })
      .catch(() => setPdfAvailable(false))
  }, [contractId])

  useEffect(() => {
    if (targetPage >= 1 && targetPage <= numPages) {
      setCurrentPage(targetPage)
    }
  }, [targetPage, numPages])

  if (pdfAvailable === null) {
    return (
      <div className="h-full bg-grey-25 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-grey-400">Loading PDF…</p>
        </div>
      </div>
    )
  }

  if (!pdfAvailable || loadError) {
    return <TextViewer contractText={contractText} targetPage={targetPage} />
  }

  return (
    <div className="h-full flex flex-col bg-grey-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-grey-100 px-4 py-2 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded text-grey-500 hover:bg-grey-50 disabled:opacity-40 transition-colors"
            aria-label="Previous page"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L5 7l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-xs text-grey-500 min-w-[72px] text-center">
            Page {currentPage} / {numPages || '–'}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded text-grey-500 hover:bg-grey-50 disabled:opacity-40 transition-colors"
            aria-label="Next page"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="p-1.5 rounded text-grey-500 hover:bg-grey-50 transition-colors text-xs"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-xs text-grey-500 min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.1))}
            className="p-1.5 rounded text-grey-500 hover:bg-grey-50 transition-colors text-xs"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setScale(1.0)}
            className="px-2 py-1 text-xs rounded text-grey-400 hover:bg-grey-50 transition-colors"
            aria-label="Reset zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* PDF canvas */}
      <div className="flex-1 overflow-auto flex justify-center py-4">
        <Document
          file={signedUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setLoadError(true)}
          loading={
            <div className="flex items-center justify-center h-32">
              <span className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer
            renderAnnotationLayer
          />
        </Document>
      </div>
    </div>
  )
}
