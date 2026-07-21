'use client'
import { useEffect, useRef } from 'react'

interface TextViewerProps {
  contractText: string
  targetPage: number
}

interface ParsedPage {
  num: number
  content: string
}

function parsePages(text: string): ParsedPage[] {
  const segments = text.split(/\[PAGE (\d+)\]/)
  const pages: ParsedPage[] = []
  for (let i = 1; i < segments.length; i += 2) {
    const num = parseInt(segments[i], 10)
    const content = (segments[i + 1] ?? '').trim()
    if (!isNaN(num)) pages.push({ num, content })
  }
  return pages.length > 0 ? pages : [{ num: 1, content: text }]
}

export default function TextViewer({ contractText, targetPage }: TextViewerProps) {
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pages = parsePages(contractText)

  useEffect(() => {
    const el = pageRefs.current.get(targetPage)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('bg-yellow-50', 'ring-2', 'ring-warning-500')

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    highlightTimeoutRef.current = setTimeout(() => {
      el.classList.remove('bg-yellow-50', 'ring-2', 'ring-warning-500')
    }, 2000)

    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [targetPage])

  return (
    <div className="h-full overflow-y-auto bg-grey-25">
      <div className="max-w-2xl mx-auto px-8 py-6 flex flex-col gap-6">
        <div className="bg-warning-50 border border-warning-200 rounded px-3 py-2 text-xs text-warning-800">
          PDF viewer unavailable — showing extracted text.
        </div>

        {pages.map(page => (
          <div
            key={page.num}
            ref={el => {
              if (el) pageRefs.current.set(page.num, el)
              else pageRefs.current.delete(page.num)
            }}
            className="transition-colors duration-300 rounded-lg p-4"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-grey-500 uppercase tracking-wide">
                Page {page.num}
              </span>
              <div className="flex-1 h-px bg-grey-100" />
            </div>
            <p className="text-sm text-grey-700 whitespace-pre-wrap leading-relaxed font-mono">
              {page.content || <span className="text-grey-300 italic">(no text on this page)</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
