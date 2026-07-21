import type { ChatMessage, ContextType } from '@/types'
import OpenAI from 'openai'

export type QueryType = ContextType

const HISTORY_SIGNALS = [
  'what did you say',
  'earlier you said',
  'previously you',
  'your last answer',
  'you mentioned',
  'before you said',
  'what you told me',
  'what have we discussed',
  'what did we talk about',
  'in our conversation',
  'you said that',
  'you told me',
]

const BOTH_SIGNALS = [
  'also in the contract',
  'and in the document',
  'what you said and',
  'along with what',
  'as well as the contract',
  'combine',
  'together with what',
  'and also find',
]

export function classifyQuery(message: string): QueryType {
  const lower = message.toLowerCase()
  const isHistory = HISTORY_SIGNALS.some(s => lower.includes(s))
  const isBoth = BOTH_SIGNALS.some(s => lower.includes(s))
  if (isHistory && isBoth) return 'both'
  if (isBoth) return 'both'
  if (isHistory) return 'history'
  return 'contract'
}

const SYSTEM_PROMPTS: Record<QueryType, string> = {
  contract: `You are a contract review assistant. Answer questions strictly from the contract document provided.

Rules:
1. Answer ONLY from the contract text. Do not use general legal knowledge or information not in the document.
2. If the answer is not in the document, say exactly: "I cannot find this in the document."
3. Every response must cite the page number in the format [Page X].
4. Be concise and specific. Do not summarise the entire contract unless explicitly asked.`,

  history: `You are a contract review assistant. The user is asking about your previous conversation, not the contract.

Rules:
1. Answer ONLY from the conversation history provided. Do not reference the contract document.
2. If the answer is not in the conversation history, say exactly: "I don't recall discussing that."
3. End every response with [From conversation].
4. Be concise and specific.`,

  both: `You are a contract review assistant. The user's question references both the contract document and the conversation history.

Rules:
1. Answer using both the contract text and the conversation history.
2. Clearly attribute each fact: use [Page X] for facts from the contract, and [From conversation] for facts from prior messages.
3. If something is not found in either source, say so explicitly.
4. Be concise and specific.`,
}

export function buildChatPrompt(
  contractText: string,
  history: ChatMessage[],
  currentMessage: string,
  queryType: QueryType = 'contract'
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPTS[queryType] },
  ]

  if (queryType === 'contract' || queryType === 'both') {
    messages.push({ role: 'user', content: `CONTRACT TEXT:\n${contractText}` })
    messages.push({ role: 'assistant', content: 'I have read the contract. Please ask your questions.' })
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content })
    }
  } else {
    // history only — no contract text, up to 20 prior turns
    for (const msg of history.slice(-20)) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  messages.push({ role: 'user', content: currentMessage })

  return messages
}
