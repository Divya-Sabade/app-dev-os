export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_PAGES = 20
export const MAX_TOKENS = 15_000
export const MIN_WORDS_FOR_TEXT_LAYER = 100
export const MAX_CUSTOM_TERMS = 5
export const CONFIDENCE_LOW_THRESHOLD = 0.5
export const CONFIDENCE_HIGH_THRESHOLD = 0.8
export const SIGNED_URL_EXPIRY_SECONDS = 3600
export const CHAT_RATE_LIMIT_PER_HOUR = 60
export const EXTRACTION_RATE_LIMIT_PER_HOUR = 5
export const MAX_CHAT_HISTORY_MESSAGES = 200

export const NDA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Term & Duration',
  'Governing Law',
  'Jurisdiction',
  'IP Ownership',
  'Non-Solicitation',
  'Breach & Remedy',
]

export const MSA_STANDARD_TERMS = [
  'Parties',
  'Service Scope',
  'Payment Terms',
  'Invoice Schedule',
  'Late Payment Penalty',
  'Liability Cap',
  'Indemnification',
  'IP Ownership',
  'Termination Clause',
  'Governing Law',
  'Dispute Resolution',
  'Notice Period',
]
