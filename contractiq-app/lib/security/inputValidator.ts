import { z } from 'zod'

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.js', '.mjs', '.cjs', '.php',
  '.zip', '.sh', '.bat', '.cmd', '.py', '.rb', '.ps1',
])
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx'])
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function validateFileUpload(
  file: File
): { valid: boolean; error?: string; status?: number } {
  const name = file.name.toLowerCase()
  const dotIndex = name.lastIndexOf('.')
  const ext = dotIndex >= 0 ? name.slice(dotIndex) : ''

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type ${ext} is not allowed`, status: 415 }
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Only PDF files are accepted', status: 415 }
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: 'Invalid file MIME type', status: 415 }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { valid: false, error: 'File must be under 10 MB', status: 413 }
  }

  return { valid: true }
}

// Zod schemas — one per API endpoint
export const processBodySchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  custom_terms: z.array(z.string().max(60)).max(5).default([]),
})

export const chatBodySchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  session_id: z.string().uuid('Invalid session ID').nullable().optional(),
  message: z.string().min(1, 'Message is required').max(5000, 'Message must be 5,000 characters or fewer'),
})

export const feedbackBodySchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  rating: z.enum(['up', 'down'], { required_error: 'Rating must be "up" or "down"' }),
  comment: z.string().max(500, 'Comment must be 500 characters or fewer').nullable().optional(),
})

export const keyTermUpdateSchema = z.object({
  value: z.string().min(1, 'Value is required').max(1000, 'Value must be 1,000 characters or fewer'),
})
