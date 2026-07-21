'use client'
import { useState, useEffect, useRef } from 'react'
import ChatMessageComponent from './ChatMessage'
import type { ChatMessage } from '@/types'

interface ChatInterfaceProps {
  contractId: string
  initialSessionId: string | null
  onPageNavigate: (page: number) => void
}

export default function ChatInterface({ contractId, initialSessionId, onPageNavigate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(!!initialSessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!initialSessionId) {
      setHistoryLoading(false)
      return
    }
    fetch(`/api/chat/${initialSessionId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.messages) setMessages(data.messages)
      })
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [initialSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    setError(null)
    setInput('')
    setLoading(true)

    const optimisticMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      session_id: sessionId ?? '',
      user_id: '',
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMessage])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          session_id: sessionId,
          message: trimmed,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
        setInput(trimmed)
        if (res.status === 429) {
          setError(data.error ?? 'Too many messages. Please wait before sending more.')
        } else {
          setError(data.error ?? 'Failed to send. Please try again.')
        }
        return
      }

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id)
      }

      const assistantMessage: ChatMessage = {
        id: data.id,
        session_id: data.session_id,
        user_id: '',
        role: 'assistant',
        content: data.content,
        created_at: data.created_at,
        context_type: data.context_type,
      }
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticMessage.id),
        { ...optimisticMessage, id: `user-${data.id}` },
        assistantMessage,
      ])
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id))
      setInput(trimmed)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {historyLoading ? (
          <div className="flex items-center justify-center py-8">
            <span className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <p className="text-sm text-grey-500 leading-relaxed">
                Ask a question about your contract
              </p>
              <p className="text-xs text-grey-400 mt-1">
                e.g. "What happens if I breach this NDA?"
              </p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessageComponent
              key={msg.id}
              message={msg}
              onPageNavigate={onPageNavigate}
            />
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-grey-50 border border-grey-100 rounded-lg rounded-bl-none px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-grey-300 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-grey-300 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-grey-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 pb-2">
          <div className="bg-error-50 border border-error-100 rounded px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-error-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-error-400 hover:text-error-700 ml-2 text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-grey-100 p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={2}
            placeholder="Ask about this contract… (Enter to send)"
            className="flex-1 px-3 py-2 text-sm border border-grey-100 rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 text-grey-900 placeholder-grey-300 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8l12-6-5 6 5 6-12-6z" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-grey-300 mt-1.5">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  )
}
