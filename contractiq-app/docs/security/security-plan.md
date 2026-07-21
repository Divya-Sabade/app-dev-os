# ContractIQ — Security Plan
**Version:** 1.0.0 | **Date:** 2026-07-17

---

## Issues Found and Fixed

| # | Issue | Severity | File | Fix Applied |
|---|---|---|---|---|
| 1 | No prompt injection guard — chat messages sent to OpenAI unfiltered | Critical | `api/chat` | `sanitizeForLLM()` blocks 17 injection patterns before any AI call |
| 2 | Session ownership never verified when `session_id` is provided in chat | High | `api/chat` | `verifySessionOwnership()` called before any session use |
| 3 | Chat allowed on contracts with any status (pending/processing/error) | High | `api/chat` | `verifyContractOwnership()` enforces `status === 'complete'` |
| 4 | No message length limit — arbitrarily large inputs reached the model | High | `api/chat` | Zod schema: max 5,000 characters, 422 on violation |
| 5 | No file extension check — MIME type spoofable client-side | High | `api/upload` | Extension validated against blocklist + allowlist before MIME check |
| 6 | `contract_type` not validated — invalid values inserted into DB | Medium | `api/upload` | Explicit check: must be `'nda'` or `'msa'` |
| 7 | No UUID validation on `contract_id`, `session_id` body params | Medium | `api/process`, `api/chat`, `api/feedback` | Zod `.uuid()` schema on all ID fields |
| 8 | No key term value length limit — unbounded writes to DB | Medium | `api/key-terms/[id]` | Zod schema: max 1,000 characters |
| 9 | No `Retry-After` header on 429 responses | Medium | All rate-limited routes | `Retry-After: <seconds>` header added to all 429s |
| 10 | Client-side `supabase.auth.signOut()` — session cookie not cleared server-side | Low | `Navbar.tsx` | `POST /api/auth/logout` route; client calls server logout |
| 11 | Injection patterns possible in custom term names sent to AI | Medium | `api/process` | `sanitizeForLLM()` called on each custom term before AI prompt build |
| 12 | AI response field values inserted without length cap | Low | `api/process` | `String(value).slice(0, 1000)` and `String(source_sentence).slice(0, 2000)` |

---

## Files Created

| File | Purpose |
|---|---|
| `lib/security/authGuard.ts` | `requireAuth()` — verifies session, returns user or 401 |
| `lib/security/promptInjectionGuard.ts` | `sanitizeForLLM()` — blocks 17 injection/jailbreak patterns |
| `lib/security/tokenLimiter.ts` | File size, page count, message length, chat history constants + validators |
| `lib/security/chatSecurity.ts` | `verifyContractOwnership()` and `verifySessionOwnership()` helpers |
| `lib/security/inputValidator.ts` | `validateFileUpload()` + Zod schemas for all API endpoints |
| `lib/security/rateLimiter.ts` | Supabase sliding-window rate limiting (fail-open, service role) |
| `app/api/auth/login/route.ts` | Server-side login — sets cookies via `createSupabaseServerClient()` |
| `app/api/auth/logout/route.ts` | Server-side logout — clears session server-side |
| `supabase/rls-policies.sql` | `rate_limit_events` table + all RLS policies (idempotent) |

---

## Files Modified

| File | Change |
|---|---|
| `app/api/upload/route.ts` | Added `validateFileUpload()` (extension + MIME + size), `contract_type` validation, upload rate limit, `Retry-After` header |
| `app/api/process/route.ts` | Zod schema validation, injection guard on custom terms, `Retry-After` header |
| `app/api/chat/route.ts` | Zod schema, injection guard, `verifyContractOwnership()`, `verifySessionOwnership()`, `Retry-After` header |
| `app/api/key-terms/[id]/route.ts` | Zod schema with 1,000-char value limit |
| `app/api/feedback/route.ts` | Zod schema with UUID validation on `contract_id` |
| `components/layout/Navbar.tsx` | `signOut()` → `POST /api/auth/logout` |
| `.env.example` | Added `MAX_CHAT_HISTORY` |

---

## Rate Limits

| Endpoint | Backend | Limit | Window |
|---|---|---|---|
| Upload | Supabase | 20 uploads | 24 hours |
| Process (AI extraction) | Supabase + Upstash | 5 requests | 1 hour |
| Chat | Supabase + Upstash | 30 messages | 1 minute |
| Auth (login) | Supabase (by IP) | 10 requests | 1 minute |

All rate limit responses include `Retry-After: <seconds>` header and `code: 'RATE_LIMIT'`.

---

## SQL to Run in Supabase

Run `supabase/rls-policies.sql` in the Supabase SQL Editor. This creates:
- `rate_limit_events` table (used by `lib/security/rateLimiter.ts`)
- RLS enabled + policies for all 5 app tables
- Storage RLS policies for the `contracts` bucket

**Note:** Run `database.sql` first if you haven't already.

---

## Environment Variables Added

| Variable | Where to add |
|---|---|
| `MAX_CHAT_HISTORY=100` | `.env.local` (optional — defaults to 100) |

---

## Security Architecture

### Auth Flow
- Supabase Auth with email + password
- Session cookies set/cleared server-side via `@supabase/ssr`
- Middleware protects all `/dashboard`, `/upload`, `/contracts`, `/api/*` routes
- Server-side routes: `POST /api/auth/login`, `POST /api/auth/logout`

### Data Isolation
- Every table has RLS enforced: `auth.uid() = user_id`
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — used only in `createSupabaseServiceClient()` for rate limiting
- Storage bucket `contracts` is private; paths scoped to `contracts/{user_id}/...`
- Signed URLs only (1-hour expiry) — no public URLs

### AI Safety
- Prompt injection guard on all user inputs before any LLM call
- Contract text not returned in API responses (only extracted terms and chat answers)
- Model never receives internal system variables or secrets
- Chat restricted to `status === 'complete'` contracts

### Input Validation
- All API endpoints validated with Zod before any DB or AI call
- File uploads: extension → MIME type → size (in that order)
- UUIDs validated on all ID parameters

### Secrets
- `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only (no `NEXT_PUBLIC_` prefix)
- Neither key is logged anywhere in the application

---

## Outstanding Items

| Item | Priority | Notes |
|---|---|---|
| Password reset flow | Medium | Not yet implemented — Supabase provides this via `supabase.auth.resetPasswordForEmail()` |
| Session timeout / refresh token rotation | Low | Configure in Supabase Dashboard → Auth → Settings |
| Rate limit event table cleanup | Low | Run `DELETE FROM rate_limit_events WHERE created_at < now() - interval '7 days'` on a schedule (pg_cron or external cron) |
| CSRF protection | Low | Next.js App Router server actions and API routes with `Content-Type: application/json` are not CSRF-vulnerable by default; revisit if form POST routes are added |
