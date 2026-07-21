import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err: any) {
      const isRetryable =
        err?.status === 429 || (err?.status >= 500 && err?.status < 600)
      if (!isRetryable || attempt === retries - 1) throw err
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt)))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function callExtractionModel(prompt: {
  system: string
  user: string
}): Promise<string> {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    })
    return response.choices[0].message.content ?? ''
  })
}

export async function callChatModel(
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<string> {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.4,
      max_tokens: 1000,
      messages,
    })
    return response.choices[0].message.content ?? ''
  })
}
