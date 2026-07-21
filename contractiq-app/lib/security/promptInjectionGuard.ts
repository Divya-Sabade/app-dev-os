const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|prior|above)\s+instructions?/i,
  /override\s+your\s+rules?/i,
  /reveal\s+system\s+prompt/i,
  /print\s+your\s+instructions?/i,
  /expose\s+(env(ironment)?\s+variables?|api\s+keys?|secrets?)/i,
  /show\s+(me\s+)?(your\s+)?(api\s+keys?|secrets?|env(ironment)?\s+variables?)/i,
  /you\s+are\s+now\s+a/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+if\s+you\s+(are|were)\s+/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /forget\s+your\s+previous\s+instructions?/i,
  /disregard\s+(all\s+)?instructions?/i,
  /new\s+system\s+prompt/i,
  /\[SYSTEM\]/,
  /\[INST\]/,
]

export function sanitizeForLLM(input: string): { safe: boolean; reason?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason: 'Input contains disallowed content' }
    }
  }
  return { safe: true }
}
