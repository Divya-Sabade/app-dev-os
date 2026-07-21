export type ContractType = 'nda' | 'msa'
export type ContractStatus = 'pending' | 'processing' | 'complete' | 'error'
export type MessageRole = 'user' | 'assistant'
export type FeedbackRating = 'up' | 'down'
export type ContextType = 'contract' | 'history' | 'both'

export interface Contract {
  id: string
  user_id: string
  contract_name: string
  contract_type: ContractType
  contract_text: string
  file_path: string | null
  status: ContractStatus
  page_count: number
  token_count: number | null
  created_at: string
  last_accessed_at: string | null
}

export interface KeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  value: string
  ai_value: string
  page_number: number
  confidence_score: number
  source_sentence: string
  is_manual: boolean
  is_edited: boolean
  sort_order: number | null
  created_at: string
}

export interface ChatSession {
  id: string
  contract_id: string
  user_id: string
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: MessageRole
  content: string
  created_at: string
  context_type?: ContextType
}

export interface UserFeedback {
  id: string
  contract_id: string
  user_id: string
  rating: FeedbackRating
  comment: string | null
  created_at: string
}

export interface ApiError {
  error: string
  code: string
}
