import type { ChatMessage as ChatMessageType } from '@/types'

interface ChatMessageProps {
  message: ChatMessageType
  onPageNavigate: (page: number) => void
}

function parseContent(content: string, onPageNavigate: (page: number) => void) {
  const parts = content.split(/(\[Page \d+\])/gi)
  return parts.map((part, i) => {
    const match = part.match(/\[Page (\d+)\]/i)
    if (match) {
      const pageNum = parseInt(match[1], 10)
      return (
        <button
          key={i}
          onClick={() => onPageNavigate(pageNum)}
          className="text-brand-500 underline font-medium hover:text-brand-600 transition-colors"
        >
          {part}
        </button>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ChatMessage({ message, onPageNavigate }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <span className="text-[10px] font-semibold text-grey-400 uppercase tracking-wide px-1">
            ContractIQ
          </span>
        )}
        <div
          className={[
            'px-3 py-2 rounded-lg text-sm leading-relaxed',
            isUser
              ? 'bg-brand-500 text-white rounded-br-none'
              : 'bg-grey-50 border border-grey-100 text-grey-700 rounded-bl-none',
          ].join(' ')}
        >
          {isUser
            ? message.content
            : parseContent(message.content, onPageNavigate)
          }
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-grey-300">{formatTime(message.created_at)}</span>
          {!isUser && message.context_type && (
            <span className="text-[10px] text-grey-300">
              {message.context_type === 'contract' && '· from contract'}
              {message.context_type === 'history' && '· from conversation'}
              {message.context_type === 'both' && '· from contract & conversation'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
