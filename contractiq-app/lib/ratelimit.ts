import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function createLimiter(redis: Redis, requests: number, windowHours: number) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowHours} h`),
    analytics: false,
  })
}

let _extractionLimiter: Ratelimit | null = null
let _chatLimiter: Ratelimit | null = null

export function getExtractionLimiter(): Ratelimit | null {
  const redis = createRedis()
  if (!redis) {
    console.warn('[ratelimit] UPSTASH_REDIS_REST_URL not set — rate limiting disabled')
    return null
  }
  if (!_extractionLimiter) _extractionLimiter = createLimiter(redis, 5, 1)
  return _extractionLimiter
}

export function getChatLimiter(): Ratelimit | null {
  const redis = createRedis()
  if (!redis) {
    console.warn('[ratelimit] UPSTASH_REDIS_REST_URL not set — rate limiting disabled')
    return null
  }
  if (!_chatLimiter) _chatLimiter = createLimiter(redis, 60, 1)
  return _chatLimiter
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  userId: string
): Promise<{ limited: boolean; resetIn: number }> {
  if (!limiter) return { limited: false, resetIn: 0 }
  const result = await limiter.limit(userId)
  if (!result.success) {
    const resetIn = Math.ceil((result.reset - Date.now()) / 1000)
    return { limited: true, resetIn }
  }
  return { limited: false, resetIn: 0 }
}
