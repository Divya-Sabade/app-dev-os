import {
  MAX_FILE_SIZE_BYTES,
  MAX_PAGES,
  MAX_TOKENS,
  MIN_WORDS_FOR_TEXT_LAYER,
  MAX_CUSTOM_TERMS,
} from './constants'

export interface ValidationResult {
  valid: boolean
  errorCode?: string
  message?: string
  status?: number
}

export function validateFileType(mimeType: string): ValidationResult {
  if (mimeType !== 'application/pdf') {
    return {
      valid: false,
      errorCode: 'INVALID_FILE_TYPE',
      message: 'Only PDF files are accepted',
      status: 415,
    }
  }
  return { valid: true }
}

export function validateFileSize(sizeBytes: number): ValidationResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      message: 'File must be under 10 MB',
      status: 413,
    }
  }
  return { valid: true }
}

export function validateExtractedText(
  text: string,
  pageCount: number
): ValidationResult {
  const wordCount = text.trim().split(/\s+/).length
  if (wordCount < MIN_WORDS_FOR_TEXT_LAYER) {
    return {
      valid: false,
      errorCode: 'SCANNED_PDF',
      message:
        'Scanned PDFs are not supported yet. Please upload a text-layer PDF.',
      status: 422,
    }
  }
  if (pageCount > MAX_PAGES) {
    return {
      valid: false,
      errorCode: 'PAGE_LIMIT_EXCEEDED',
      message: 'Contracts over 20 pages are not supported yet',
      status: 422,
    }
  }
  const estimatedTokens = Math.ceil(text.length / 4)
  if (estimatedTokens > MAX_TOKENS) {
    return {
      valid: false,
      errorCode: 'TOKEN_LIMIT_EXCEEDED',
      message: 'Contract text exceeds the processing limit. Please upload a shorter contract.',
      status: 422,
    }
  }
  return { valid: true }
}

export function validateCustomTerms(terms: string[]): ValidationResult {
  if (terms.length > MAX_CUSTOM_TERMS) {
    return {
      valid: false,
      errorCode: 'INVALID_CUSTOM_TERMS',
      message: `Maximum ${MAX_CUSTOM_TERMS} custom terms allowed`,
      status: 422,
    }
  }
  for (const term of terms) {
    if (!term || term.trim().length === 0) {
      return {
        valid: false,
        errorCode: 'INVALID_CUSTOM_TERMS',
        message: 'Custom term names cannot be empty',
        status: 422,
      }
    }
    if (term.length > 60) {
      return {
        valid: false,
        errorCode: 'INVALID_CUSTOM_TERMS',
        message: 'Custom term names must be 60 characters or fewer',
        status: 422,
      }
    }
  }
  return { valid: true }
}
