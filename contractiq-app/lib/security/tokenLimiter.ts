export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_PAGE_COUNT = 200
export const MAX_MESSAGE_LENGTH = 5000
export const MAX_KEY_TERM_VALUE_LENGTH = 1000
export const MAX_CHAT_HISTORY = parseInt(process.env.MAX_CHAT_HISTORY ?? '100', 10)

export function validateMessageLength(message: string): { valid: boolean; error?: string } {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer`,
    }
  }
  return { valid: true }
}

export function validatePageCount(count: number): { valid: boolean; error?: string } {
  if (count > MAX_PAGE_COUNT) {
    return {
      valid: false,
      error: `Contract exceeds the maximum ${MAX_PAGE_COUNT}-page limit`,
    }
  }
  return { valid: true }
}
