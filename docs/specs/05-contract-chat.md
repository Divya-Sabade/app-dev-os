# Spec 05 — Contract Chat (Q&A)

## Overview

Users can ask plain-English questions about a contract and receive answers grounded strictly in the uploaded document text. The chat is accessible from the results page via a floating button or tab. All messages are persisted in Supabase. Each AI response includes a mandatory `[Page X]` citation. The model cannot answer from general legal knowledge — only from the provided contract text.

---

## User Flow

1. User is on `/contracts/[id]` (results page)
2. Clicks "Chat with Contract" floating button (bottom-right) or chat tab in panel
3. Chat interface opens (right panel takeover or side drawer on mobile)
4. If a prior chat session exists for this contract → messages load (GET `/api/chat/:sessionId`)
5. If no prior session → one is created on first message send (POST `/api/process` already created `chat_sessions` row; or created lazily on first chat message)
6. User types a question → hits Enter or clicks Send
7. User message appears immediately (right-aligned)
8. Loading indicator (3-dot pulse) appears while awaiting AI response
9. AI response appears (left-aligned) with `[Page X]` citation as a clickable link
10. Clicking `[Page X]` link → calls `onPageNavigate(X)` → viewer scrolls to that page
11. Full conversation visible in scrollable message list; new messages append at bottom; auto-scroll to latest

---

## Chat Session Lifecycle

- One `chat_sessions` row per contract per user
- Created when: user sends their first message to a contract (lazy creation)
- `chat_session_id` is returned by GET `/api/contracts/:id` if a session exists (null otherwise)
- All subsequent chat messages reference this session ID

---

## Component Spec

**File:** `components/chat/ChatInterface.tsx`

Props:
```typescript
interface ChatInterfaceProps {
  contractId: string
  sessionId: string | null        // null if no prior session
  contractText: string            // available from parent page state — not fetched again
  onPageNavigate: (page: number) => void
}
```

State:
- `messages: ChatMessage[]` — loaded from GET `/api/chat/:sessionId` on mount; empty if no session
- `inputValue: string`
- `loading: boolean` — true while awaiting AI response
- `sessionId: string | null` — updated to new session ID on first message if was null

Behaviour:
- On mount: if `sessionId` is not null, fetch message history
- On send: POST `/api/chat`; append user message optimistically; await response; append AI message
- Auto-scroll `messagesEndRef` into view after each new message
- Textarea: Enter key submits; Shift+Enter inserts newline
- Disable send button + textarea while `loading = true`
- Empty state message: "Ask a question about your contract — e.g., 'What happens if I breach this NDA?'"

**File:** `components/chat/ChatMessage.tsx`

Props:
```typescript
interface ChatMessageProps {
  message: ChatMessage
  onPageNavigate: (page: number) => void
}
```

- `role === 'user'`: right-aligned, user colour bubble
- `role === 'assistant'`: left-aligned, grey bubble, "ContractIQ" label above
- Parses `[Page X]` in content → renders as `<button onClick={() => onPageNavigate(X)}>Page X</button>` (underlined, clickable)
- Renders `createdAt` timestamp below each message (locale time format)

---

## API Route: POST `/api/chat`

**File:** `app/api/chat/route.ts`

### Request
```json
{
  "contract_id": "uuid",
  "session_id": "uuid | null",
  "message": "What happens if I breach the NDA?"
}
```

If `session_id` is null, create a new `chat_sessions` row and use its ID.

### Processing Steps

1. **Auth check** — `getUser(request)` → 401
2. **Ownership check** — contract belongs to this user → 403/404
3. **Rate limit check** — 60 messages per user per hour → 429
4. **Resolve session** — if `session_id` null: `INSERT INTO chat_sessions → return new id`; else validate session belongs to user
5. **Save user message** — `INSERT INTO chat_messages { session_id, user_id, role: 'user', content: message }`
6. **Load history** — `SELECT * FROM chat_messages WHERE session_id = :session_id ORDER BY created_at ASC` (up to 200 messages)
7. **Read contract_text** — `SELECT contract_text FROM contracts WHERE id = :contract_id`
8. **Classify query** — `classifyQuery(message)` → `'contract' | 'history' | 'both'`
9. **Build chat prompt** — `buildChatPrompt(contractText, history, message, queryType)`
10. **Call GPT-4o** — temperature 0.4, max_tokens 1000, no JSON mode (free text)
11. **Extract response content** — `response.choices[0].message.content`
12. **Validate citation** — check response contains `/\[Page \d+\]/i` pattern; if absent, log warning (do not reject)
13. **Save assistant message** — `INSERT INTO chat_messages { session_id, user_id, role: 'assistant', content }`
14. **Return** `{ id, role: 'assistant', content, created_at, session_id }`

### Response 200
```json
{
  "id": "uuid",
  "role": "assistant",
  "content": "Based on the document, if you breach the NDA, the non-breaching party may seek injunctive relief and recover all reasonable costs and attorneys' fees. [Page 7]",
  "created_at": "2026-07-16T09:12:00Z",
  "session_id": "uuid"
}
```

### Error Responses

| Code | HTTP | Notes |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | contract_id belongs to another user |
| 429 | `RATE_LIMIT` | > 60 messages/hr for this user |
| 502 | `AI_ERROR` | OpenAI failure after 3 retries |

---

## API Route: GET `/api/chat/[sessionId]`

**File:** `app/api/chat/[sessionId]/route.ts`

1. Auth check + ownership check (session → contract → user)
2. `SELECT * FROM chat_messages WHERE session_id = :sessionId ORDER BY created_at ASC LIMIT 200`
3. Response:
```json
{
  "messages": [
    { "id": "uuid", "role": "user", "content": "...", "created_at": "..." },
    { "id": "uuid", "role": "assistant", "content": "...", "created_at": "..." }
  ],
  "session_id": "uuid"
}
```

---

## Chat Prompt

**File:** `prompts/chat.ts`

### `buildChatPrompt(contractText, history, currentMessage, queryType)`

Returns the message array for the OpenAI call.

#### System Message (always included)

```
You are a contract review assistant. Your only job is to answer questions based on the contract document provided to you.

Rules:
1. Answer ONLY from the contract text provided. Do not use general legal knowledge.
2. If the answer to a question is not in the document, respond with: "I cannot find this in the document."
3. Every response must include a page citation in the format [Page X] where X is the page number from the contract.
4. Begin every response with "Based on the document, ..."
5. Be concise and specific. Do not summarise the entire contract unless asked.
```

#### Message Array Construction

```
[
  { role: 'system', content: systemPrompt },
  
  // If queryType is 'contract' or 'both':
  { role: 'user', content: `CONTRACT TEXT:\n${contractText}` },
  { role: 'assistant', content: 'I have read the contract. Please ask your questions.' },
  
  // All prior messages (up to 200, ascending):
  ...history.map(m => ({ role: m.role, content: m.content })),
  
  // Current user message:
  { role: 'user', content: currentMessage }
]
```

When `queryType === 'history'`: omit the contract text injection (saves tokens for conversational questions like "what did you say about X?").

---

## Query Classifier

**File:** `prompts/chat.ts` (exported function)

```typescript
type QueryType = 'contract' | 'history' | 'both'

export function classifyQuery(message: string): QueryType {
  // Simple heuristics — no extra API call:
  // 'history' signals: "what did you say", "earlier", "previously", "your last answer"
  // 'both': default — include contract text + history
  // 'contract': pure contract question — include only contract text (omit history to save tokens)
  // Default: 'both'
}
```

---

## "Not Found" Fallback

When the model responds with "I cannot find this in the document" (case-insensitive match):
- Render the response normally in the chat bubble
- Do NOT show an error state — this is a valid, correct response
- The [Page X] citation is optional in this case (may be absent)

---

## Hallucination Guardrails (Chat-Specific)

| Guardrail | Implementation |
|---|---|
| Document-only system prompt | Rule #1 in system message: "Do not use general legal knowledge" |
| Mandatory citation | Rule #3: "[Page X]" required; validated server-side (warning logged if absent) |
| "Based on the document…" prefix | Rule #4: enforced via system prompt |
| "Not found" as valid answer | Rule #2: "I cannot find this in the document" is correct, not an error |
| Off-topic questions | System prompt scope restriction causes model to deflect to "not found" response |

---

## Rate Limiting

- 60 chat messages per user per hour
- Implemented via `@upstash/ratelimit` or in-memory sliding window in API route
- On limit exceeded: return 429 `{ error: "Too many messages. Please wait before sending more.", code: "RATE_LIMIT" }`
- Client shows this error as an inline error banner below the chat input

---

## Acceptance Criteria

- [ ] Chat responds within 15 seconds P95
- [ ] Every AI response contains a `[Page X]` citation
- [ ] Clicking `[Page X]` in a response navigates the viewer to page X
- [ ] Off-topic question (topic not in document) returns "I cannot find this in the document"
- [ ] All messages saved to `chat_messages` with correct `role` and `created_at`
- [ ] Reopening `/contracts/[id]` after closing loads all prior messages in order
- [ ] Rate limit: > 60 messages/hr returns 429 with user-facing error
- [ ] "Based on the document, …" prefix present on all AI responses
- [ ] Empty state shown when no prior messages exist
- [ ] Auto-scroll to newest message after each send
