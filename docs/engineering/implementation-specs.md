# ContractIQ — Implementation Specs

**Version:** 1.0  
**Date:** July 16, 2026  
**Companion doc:** `docs/engineering/engineering-doc.md`  
**Status:** Draft — Pending Approval

One detailed spec block per feature. Each block covers the complete implementation surface for that feature: user flow, database, API, state, components, design, and edge cases. These specs are the authoritative reference for building each feature in Stage 4.

---

## Table of Contents

1. [Feature 1 — User Authentication & Session Management](#feature-1--user-authentication--session-management)
2. [Feature 2 — PDF Upload & Text Extraction](#feature-2--pdf-upload--text-extraction)
3. [Feature 3 — Key Term Extraction (AI)](#feature-3--key-term-extraction-ai)
4. [Feature 4 — Results Display](#feature-4--results-display)
5. [Feature 5 — Contract Chat (Q&A)](#feature-5--contract-chat-qa)
6. [Feature 6 — Dashboard & Contract History](#feature-6--dashboard--contract-history)
7. [Feature 7 — Feedback Collection](#feature-7--feedback-collection)

---

## Feature 1 — User Authentication & Session Management

### User Flow

1. New user lands on `/` (landing page) → clicks "Get Started Free"
2. Supabase Auth sign-up modal opens: email + password fields
3. On valid submission → Supabase creates `auth.users` row + sends verification email
4. User confirms email → Supabase issues session → middleware stores cookie
5. User redirected to `/dashboard`
6. Returning user clicks "Sign In" → email + password → session issued → `/dashboard`
7. Sign-out: session cookie cleared → redirect to `/`
8. On any protected route without session → redirect to `/auth/signin?redirect=<path>`

### DB Schema

No custom tables. Relies entirely on Supabase `auth.users` (managed). All other tables reference `auth.users(id)` via `user_id` foreign key — this FK is the RLS pivot across the entire application.

### DB Tasks

| Task | Query |
|---|---|
| Create user | Handled by `supabase.auth.signUp()` — no direct SQL |
| Validate session | `supabase.auth.getUser()` via `@supabase/ssr` in middleware and API routes |
| Sign out | `supabase.auth.signOut()` — clears session cookie |
| Get current user id | `const { data: { user } } = await supabase.auth.getUser()` → `user.id` |

### API Routes

| Method | Path | Purpose |
|---|---|---|
| — | — | Auth is handled entirely by Supabase Auth client — no custom API routes for auth |
| All protected routes | `middleware.ts` | Validates session cookie; redirects if invalid |

All other API routes validate auth at the top of each handler:
```typescript
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### State Management

- Auth state lives in Supabase browser client — no custom React context needed
- `useEffect` on layout to subscribe to `supabase.auth.onAuthStateChange` for real-time session updates
- `user.id` passed as prop or read from client where needed (not stored in separate state)

### Component Spec

**`components/auth/AuthForm.tsx`**
```typescript
props: { mode: 'signin' | 'signup' }
state: { email, password, loading, error }
```
- Client-side validation: email format, password ≥ 8 chars
- Calls `supabase.auth.signUp()` or `supabase.auth.signInWithPassword()`
- On success: `router.push(redirectParam ?? '/dashboard')`
- On error: show inline error message (no toast — stays on form)

**`middleware.ts`**
- Intercepts all routes matching `/dashboard/*`, `/upload/*`, `/contracts/*`, `/api/*`
- Uses `createServerClient` from `@supabase/ssr` with request cookies
- If no valid session → `NextResponse.redirect('/auth/signin?redirect=<path>')`

### Design Notes

- Auth forms are centred cards on a neutral background — no sidebar, no distractions
- Error messages displayed in a red inline banner directly below the submit button
- "Sign In" link on signup page and vice versa — simple text link, not a button
- Mobile: full-width card with generous padding
- WCAG: form labels explicitly associated with inputs via `htmlFor`; error state announced via `aria-live="polite"`

### Edge Cases

| Scenario | Handling |
|---|---|
| Email already registered (sign-up) | "An account with this email already exists" |
| Wrong password (sign-in) | "Invalid email or password" — no enumeration |
| Email not yet verified | "Please verify your email before signing in" |
| Session expired mid-session | Middleware catches on next request → redirect to sign-in |
| Network failure during auth | "Something went wrong. Please try again." |
| `?redirect` param with external URL | Sanitise: only allow paths starting with `/`; default to `/dashboard` |

---

## Feature 2 — PDF Upload & Text Extraction

### User Flow

1. Authenticated user navigates to `/upload`
2. Selects contract type: NDA or MSA from dropdown (required before upload is enabled)
3. Drags or picks a PDF file
4. Client validates: PDF MIME type + size ≤ 10 MB → shows inline error if invalid
5. On valid file: POST `/api/upload` (multipart) fires
6. Progress stepper renders: "Uploading…" → "Extracting text…" → "Ready to process"
7. Server runs `pdf-parse` → extracts text with `[PAGE N]` markers → validates (page count, token count, scanned PDF check)
8. Contract row inserted into DB (`status: 'pending'`, `contract_text` stored)
9. Non-blocking Storage upload fires in background (does NOT delay response)
10. Response `{ contract_id, page_count, standard_terms_preview }` returned
11. Page advances to pre-processing preview (step 2 of the upload flow)

### DB Schema

**Table: `contracts`** — columns written at upload time:

| Column | Written at Upload | Value |
|---|---|---|
| `id` | Yes | `gen_random_uuid()` |
| `user_id` | Yes | `auth.uid()` |
| `contract_name` | Yes | sanitised filename |
| `contract_type` | Yes | `'nda'` or `'msa'` |
| `contract_text` | Yes | full text with `[PAGE N]` markers |
| `file_path` | Async (non-blocking) | `contracts/{user_id}/{id}/{filename}.pdf` or null |
| `status` | Yes | `'pending'` |
| `page_count` | Yes | from pdf-parse |
| `token_count` | Yes | `Math.ceil(text.length / 4)` |

### DB Tasks

| Task | Query |
|---|---|
| Insert contract row | `INSERT INTO contracts (...) VALUES (...) RETURNING id` |
| Update file_path after Storage upload | `UPDATE contracts SET file_path = :path WHERE id = :id` |
| Update status on processing start | `UPDATE contracts SET status = 'processing' WHERE id = :id` |

### API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/upload` | Required | Accept PDF, extract text, create contract row, trigger non-blocking Storage upload |

**Request:** `multipart/form-data` — `file`, `contract_type`, `contract_name`  
**Response 200:** `{ contract_id, page_count, token_count, standard_terms_preview[] }`  
**Errors:** 401, 413 (file too large), 415 (not PDF), 422 (scanned PDF / page limit / token limit), 500

### State Management

**`app/(protected)/upload/page.tsx`** owns:
```typescript
state: {
  step: 'upload' | 'preview' | 'processing' | 'done'
  contractType: 'nda' | 'msa' | null
  selectedFile: File | null
  uploadError: string | null
  contractId: string | null
  pageCount: number | null
  standardTermsPreview: string[]
  customTerms: string[]
  uploadLoading: boolean
}
```

### Component Spec

**`components/contract/ContractTypeSelector.tsx`**
```typescript
props: { value: 'nda' | 'msa' | null; onChange: (v) => void }
```
Renders a styled `<select>`. "Process" button disabled until value is set.

**`components/contract/FileDropzone.tsx`**
```typescript
props: { onFileSelect: (file: File) => void; error: string | null }
```
Drag-and-drop zone + click to browse. Validates MIME type and size on select.

**`components/layout/ProcessingProgress.tsx`**
```typescript
props: { currentStep: 1 | 2 | 3; steps: string[] }
```
3-step linear stepper. Each step completes when the corresponding async operation resolves.

### Design Notes

- Upload zone: dashed border, file icon, "Drag your PDF here or click to browse"; on file hover turns solid border
- Progress stepper: horizontal on desktop, vertical on mobile
- Contract type selector sits above the dropzone — disabled once a file is selected (don't let user change type mid-flow)
- Error messages: red inline banner with specific message (not generic "error")
- File size and page count shown as metadata once file is selected: "12 pages · 2.4 MB"

### Edge Cases

| Scenario | Handling |
|---|---|
| User drops a non-PDF (e.g. DOCX) | Client rejects immediately: "Only PDF files are accepted" |
| File > 10 MB | Client rejects immediately: "File must be under 10 MB" |
| Scanned PDF (< 100 words extracted) | Server rejects: "Scanned PDFs are not supported yet. Please upload a text-layer PDF." |
| Contract > 20 pages | Server rejects: "Contracts over 20 pages are not supported yet" |
| Contract > 15,000 tokens | Server rejects: "Contract text exceeds the processing limit" |
| Storage upload fails silently | `file_path` stays null; AI pipeline unaffected; only PDF viewer hidden |
| Network drops during upload | Upload spinner shows error after timeout; retry button shown |
| User tries to change contract type after file selected | Dropdown locked; user must remove file first |

---

## Feature 3 — Key Term Extraction (AI)

### User Flow

1. User is on `/upload` step 2 (pre-processing preview) after successful upload
2. Screen shows list of standard terms that will be extracted for selected contract type
3. User optionally adds up to 5 custom terms via "+ Add Key Term" input
4. Custom terms appear in the preview list with "Custom" badge
5. User clicks "Process Contract"
6. Three-step progress stepper: "Extracting text ✓" → "Analysing with AI…" → "Compiling results…"
7. POST `/api/process` fires → reads `contract_text` from DB → builds GPT-4o prompt → calls OpenAI
8. JSON response parsed + validated → `key_terms` rows inserted in batch
9. `contracts.status` set to `'complete'`
10. User navigated to `/contracts/[id]` (results page)

### DB Schema

**Table: `key_terms`** — all columns written at extraction time:

| Column | Value |
|---|---|
| `contract_id` | FK to contracts |
| `user_id` | `auth.uid()` (for RLS) |
| `term_name` | from extraction JSON |
| `value` | current value (AI-extracted initially) |
| `ai_value` | same as `value` at insert — immutable copy |
| `page_number` | 1-indexed, from AI JSON |
| `confidence_score` | 0.0–1.0 float from AI JSON |
| `source_sentence` | verbatim sentence from AI JSON |
| `is_manual` | `true` for custom terms |
| `is_edited` | `false` at insert |
| `sort_order` | array index (preserves display order) |

### DB Tasks

| Task | Query |
|---|---|
| Read contract for processing | `SELECT contract_text, contract_type FROM contracts WHERE id = :id AND user_id = :uid` |
| Set status to processing | `UPDATE contracts SET status = 'processing' WHERE id = :id` |
| Batch insert key terms | `INSERT INTO key_terms (...) SELECT unnest(...)` or loop insert |
| Set status to complete | `UPDATE contracts SET status = 'complete' WHERE id = :id` |
| Set status to error | `UPDATE contracts SET status = 'error' WHERE id = :id` |

### API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/process` | Required | Run GPT-4o extraction; insert key_terms; update contract status |

**Request:** `{ contract_id: string; custom_terms: string[] }`  
**Response 200:** `{ key_terms: KeyTerm[] }`  
**Errors:** 401, 403 (wrong owner), 404, 422 (> 5 custom terms), 429 (rate limit: 5/hr), 502 (OpenAI error)

### State Management

State lives in `/upload/page.tsx` during processing, then handed off to `/contracts/[id]/page.tsx` via router navigation.

```typescript
// upload/page.tsx processing state
processingStep: 1 | 2 | 3
processingError: string | null

// contracts/[id]/page.tsx receives key_terms via GET /api/contracts/:id
keyTerms: KeyTerm[]
targetPage: number        // shared between panel and viewer
```

### Component Spec

**`components/contract/TermsPreviewCard.tsx`**
```typescript
props: {
  contractType: 'nda' | 'msa'
  standardTerms: string[]
  customTerms: string[]
}
```
Shows all terms in a scrollable list. Standard terms in default style; custom terms with "Custom" grey badge.

**`components/contract/CustomTermInput.tsx`**
```typescript
props: {
  terms: string[]
  onAdd: (term: string) => void
  onRemove: (index: number) => void
  maxTerms: 5
}
```
Text input + Add button. Added terms shown as dismissible pills. Input hidden when `terms.length >= 5`.

**`components/contract/ConfidenceIndicator.tsx`**
```typescript
props: { score: number }
// score >= 0.8 → green badge
// 0.5 <= score < 0.8 → amber badge
// score < 0.5 → red badge + ⚠️ prefix
```

### Design Notes

- Preview card uses a clean 2-column list on desktop (term name only — no values yet, those come after processing)
- Custom terms section has a visual divider below standard terms
- Progress stepper during processing: step 1 auto-completes (text already extracted at upload); step 2 takes longest; step 3 is near-instant after AI returns
- On mobile, preview list is single-column
- Confidence badges are colour-coded pills (not just text); sufficient contrast ratio for WCAG AA

### Edge Cases

| Scenario | Handling |
|---|---|
| OpenAI returns malformed JSON | Single automatic retry with correction prompt; if still fails → status = 'error'; user sees retry option |
| OpenAI timeout (> 20s) | `AbortController` timeout; status = 'error'; "Analysis timed out. Try again." |
| GPT-4o returns fewer terms than expected | Display only what was returned; no error — user can re-run or edit manually |
| Term schema validation fails on a term | That term is dropped; rest are saved; no error surfaced |
| Custom term duplicates a standard term name | Client blocks: "This term is already in the standard list" |
| User navigates away during processing | Contract row stays in 'processing' state; on next visit status shows "Processing" badge in dashboard |
| Rate limit hit (5/hr) | 429 returned; client shows: "You've reached the analysis limit. Try again in an hour." |

---

## Feature 4 — Results Display

### User Flow

1. User lands on `/contracts/[id]` (navigated from upload or dashboard)
2. Page loads: GET `/api/contracts/:id` → returns contract metadata + `key_terms[]` + `chat_session_id`
3. Simultaneously: GET `/api/storage/signed-url/:contractId` → returns `signed_url` or 404
4. If signed URL: render PDF.js viewer with the URL
5. If 404 (no `file_path`): render TextViewer with `contract_text` from DB
6. Key Terms Panel renders on right: all terms as TermCards, sorted by `sort_order`
7. User clicks a page number on any TermCard → viewer scrolls to that page (both viewers)
8. User clicks "Why?" on any term → `source_sentence` expands below
9. User clicks edit (pencil) on any term → TermEditModal opens
10. User saves edit → PATCH `/api/key-terms/:id`; "Edited" badge replaces confidence badge
11. "Not legal advice" disclaimer is always visible at page bottom

### DB Schema

**Tables read on this page:**
- `contracts` — `contract_name`, `contract_type`, `status`, `contract_text` (for TextViewer)
- `key_terms` — all columns (for panel display and editing)
- `chat_sessions` — `id` (to check if prior chat session exists)

**Tables written on this page:**
- `key_terms` — `value`, `is_edited = true` on PATCH (never updates `ai_value`)
- `contracts` — `last_accessed_at = now()` on page load

### DB Tasks

| Task | Query |
|---|---|
| Load contract + key terms | `SELECT * FROM contracts WHERE id = :id AND user_id = :uid` + `SELECT * FROM key_terms WHERE contract_id = :id ORDER BY sort_order ASC` |
| Check for prior chat session | `SELECT id FROM chat_sessions WHERE contract_id = :id AND user_id = :uid LIMIT 1` |
| Update last accessed | `UPDATE contracts SET last_accessed_at = now() WHERE id = :id` |
| Edit key term | `UPDATE key_terms SET value = :value, is_edited = true WHERE id = :id AND user_id = :uid RETURNING *` |

### API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/contracts/:id` | Required | Load contract + key_terms + chat_session_id |
| GET | `/api/storage/signed-url/:contractId` | Required | Generate 1-hour signed URL for PDF viewer |
| PATCH | `/api/key-terms/:id` | Required | Inline edit a key term value |

### State Management

**`app/(protected)/contracts/[id]/page.tsx`** owns:

```typescript
state: {
  contract: Contract
  keyTerms: KeyTerm[]
  chatSessionId: string | null
  signedUrl: string | null
  pdfAvailable: boolean
  targetPage: number          // drives both PDFViewer and TextViewer scroll
  editingTermId: string | null
}
```

`targetPage` is the only shared state between the viewer and the key terms panel. It is set by TermCard clicks and consumed by the viewer via a prop.

### Component Spec

**`components/viewer/PDFViewer.tsx`**
```typescript
props: { signedUrl: string; targetPage: number; onPageChange?: (p: number) => void }
```
PDF.js integration. Lazy-loads pages. Smooth scroll to `targetPage` when prop changes. Brief yellow page highlight on navigation.

**`components/viewer/TextViewer.tsx`**
```typescript
props: { contractText: string; targetPage: number }
```
Parses `[PAGE N]` markers with regex. Renders each page as a labelled section. `scrollIntoView` on `targetPage` change. Identical navigation behaviour to PDFViewer.

**`components/contract/KeyTermsPanel.tsx`**
```typescript
props: { keyTerms: KeyTerm[]; onPageNavigate: (p: number) => void; onTermEdit: (id, value) => void }
```
Scrollable list. Two sections: standard terms (by `sort_order`) and custom terms (`is_manual = true`) below a divider.

**`components/contract/TermCard.tsx`**
```typescript
props: { term: KeyTerm; onPageNavigate: (p: number) => void; onEdit: (id, value) => void }
```
Displays: term name, value, clickable page number, confidence badge, "Why?" accordion, edit button. Shows "Edited" badge when `is_edited = true`.

**`components/contract/TermEditModal.tsx`**
```typescript
props: { term: KeyTerm; isOpen: boolean; onClose: () => void; onSave: (id, value) => void }
```
Modal with read-only AI value field and editable textarea. Optimistic update on save.

**`components/contract/ConfidenceIndicator.tsx`** (reused from Feature 3)  
**`components/contract/SourceSentenceTooltip.tsx`**
```typescript
props: { sentence: string }
```
Accordion section within TermCard. Hidden when `sentence` is empty.

**`components/layout/LegalDisclaimer.tsx`**
Static text: "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer." Non-dismissible. Footer position.

### Design Notes

- Desktop: 50/50 split (or 55/45 viewer/panel). Viewer on left, key terms panel on right with independent scroll
- Mobile: stacked. Viewer first (collapsed to fixed height), panel below (expanded)
- Low-confidence terms (< 0.5): red `⚠️` badge + non-dismissible paragraph warning below the value. Never hidden
- Terms with `value = 'Not found'`: value shown in grey italic; "Why?" section hidden (no source sentence)
- "Edited" badge replaces confidence badge position (not added alongside — one or the other)
- PDF viewer toolbar: zoom in/out, page counter, download fallback link
- Signed URL is fetched fresh on each page load (1-hour expiry; not cached in DB)

### Edge Cases

| Scenario | Handling |
|---|---|
| `file_path = null` in DB | Skip signed-URL fetch; render TextViewer immediately |
| Signed URL fetch returns 404 | `pdfAvailable = false`; TextViewer rendered; no error shown to user |
| PDF.js fails to render a page | Show "Download PDF" fallback link in viewer for that page |
| key_terms is empty array | Panel shows: "No terms were extracted. The AI may have had difficulty with this contract." |
| Edit save fails (network error) | Optimistic update reverted; error toast: "Could not save your edit. Please try again." |
| User visits contract they don't own | RLS returns empty; page shows 404 / "Contract not found" |
| `contracts.status = 'error'` | Results page shows error banner: "Processing failed. Return to upload to try again." — no key terms panel rendered |

---

## Feature 5 — Contract Chat (Q&A)

### User Flow

1. User is on `/contracts/[id]` results page
2. Clicks "Chat with Contract" floating button (bottom-right corner)
3. Chat panel opens (right panel expansion on desktop; full-screen overlay on mobile)
4. If `chat_session_id` exists: GET `/api/chat/:sessionId` → prior messages load in order
5. If no prior session: empty state shown: "Ask a question about your contract"
6. User types question + hits Enter (or clicks Send)
7. User message appears immediately (right-aligned, optimistic)
8. Loading indicator (3-dot pulse) appears in left position
9. POST `/api/chat` fires: reads `contract_text` from DB; builds prompt; calls GPT-4o
10. AI response appears (left-aligned) with `[Page X]` citation as a clickable button
11. Clicking `[Page X]` → calls `onPageNavigate(X)` → viewer scrolls to that page
12. Conversation saved to `chat_messages`; auto-scroll to latest message

### DB Schema

**Table: `chat_sessions`** — one per contract per user, created on first message

| Column | Value |
|---|---|
| `contract_id` | FK to contracts |
| `user_id` | `auth.uid()` |
| `created_at` | `now()` |

**Table: `chat_messages`** — one per message (user and assistant)

| Column | Value |
|---|---|
| `session_id` | FK to chat_sessions |
| `user_id` | `auth.uid()` |
| `role` | `'user'` or `'assistant'` |
| `content` | full message text including `[Page X]` citations |
| `created_at` | `now()` |

### DB Tasks

| Task | Query |
|---|---|
| Check for existing session | `SELECT id FROM chat_sessions WHERE contract_id = :cid AND user_id = :uid LIMIT 1` |
| Create new session | `INSERT INTO chat_sessions (contract_id, user_id) VALUES (:cid, :uid) RETURNING id` |
| Load message history | `SELECT * FROM chat_messages WHERE session_id = :sid ORDER BY created_at ASC LIMIT 200` |
| Save user message | `INSERT INTO chat_messages (session_id, user_id, role, content) VALUES (...)` |
| Save assistant message | Same as above with `role = 'assistant'` |
| Read contract text for prompt | `SELECT contract_text FROM contracts WHERE id = :id AND user_id = :uid` |

### API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/chat` | Required | Send message; get grounded AI response; save both to DB |
| GET | `/api/chat/:sessionId` | Required | Load full message history for a session |

### State Management

**`components/chat/ChatInterface.tsx`** owns its own state:

```typescript
state: {
  messages: ChatMessage[]
  inputValue: string
  loading: boolean
  error: string | null
  sessionId: string | null     // initialised from parent; updated on first message if null
}
```

Receives as props:
- `contractId: string`
- `initialSessionId: string | null`
- `onPageNavigate: (page: number) => void` — wired to viewer scroll

### Component Spec

**`components/chat/ChatInterface.tsx`**
```typescript
props: {
  contractId: string
  initialSessionId: string | null
  onPageNavigate: (page: number) => void
}
```
- On mount: if `initialSessionId`, fetch message history
- Textarea: Enter = submit; Shift+Enter = newline
- Disabled while `loading = true`
- Auto-scrolls `messagesEndRef` after each message append

**`components/chat/ChatMessage.tsx`**
```typescript
props: { message: ChatMessage; onPageNavigate: (page: number) => void }
```
- `role === 'user'`: right-aligned coloured bubble
- `role === 'assistant'`: left-aligned grey bubble, "ContractIQ" label
- Parses `[Page X]` in content → renders as underlined clickable `<button>`
- Timestamp shown below bubble in locale time

### Design Notes

- Chat panel opens as a right-panel expansion on desktop — key terms panel slides left to make room or collapses
- Mobile: full-screen overlay with a back arrow to return to results
- Loading indicator: three animated dots in assistant bubble position
- Empty state graphic: simple icon + "Ask a question about your contract — e.g., 'What happens if I breach this NDA?'"
- `[Page X]` citation buttons: underlined, blue, inline within the response text
- Error state: red banner below input: "Something went wrong. Please try again."

### Edge Cases

| Scenario | Handling |
|---|---|
| OpenAI timeout on chat | 3-retry with backoff; if all fail: "The AI couldn't respond right now. Please try again." |
| Response missing `[Page X]` citation | Log warning server-side; return response as-is; no client-side error |
| Question about topic not in document | AI responds: "I cannot find this in the document." — rendered as normal message |
| Rate limit hit (60/hr) | 429 returned; inline error: "You've reached the chat limit. Please wait before sending more." |
| User sends empty message | Send button disabled if `inputValue.trim() === ''` |
| Session not found (stale URL) | POST `/api/chat` creates a new session; history from old session not recoverable |
| 200+ messages in history | Capped at 200 messages (ascending); oldest messages are truncated from context |

---

## Feature 6 — Dashboard & Contract History

### User Flow

1. Authenticated user lands on `/dashboard`
2. GET `/api/contracts` fires (default sort: date descending)
3. Stats row renders: total contracts, NDA count, MSA count
4. Contract list renders: table rows, one per contract
5. User clicks column header → sort order changes → new GET fires → list re-renders
6. User clicks a row → `router.push('/contracts/${id}')`
7. Pagination: next/previous navigate between pages of 20 contracts
8. Empty state (0 contracts): CTA card with "Review a Contract" button → `/upload`

### DB Schema

**Table: `contracts`** — read only on this page:

Columns read: `id`, `contract_name`, `contract_type`, `status`, `page_count`, `created_at`

No writes on the dashboard page (read-only view).

### DB Tasks

| Task | Query |
|---|---|
| List contracts (paginated) | `SELECT id, contract_name, contract_type, status, page_count, created_at FROM contracts WHERE user_id = :uid ORDER BY <col> <dir> LIMIT :limit OFFSET :offset` |
| Count total | `SELECT COUNT(*) FROM contracts WHERE user_id = :uid` |

### API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/contracts` | Required | List user's contracts with sort, order, pagination params |

**Query params:** `sort` (date/name/type), `order` (asc/desc), `page` (≥1), `limit` (1–50, default 20)

### State Management

**`app/(protected)/dashboard/page.tsx`** owns:

```typescript
state: {
  contracts: Contract[]
  total: number
  sort: 'date' | 'name' | 'type'
  order: 'asc' | 'desc'
  page: number
  loading: boolean
}
```

Sort + page state is mirrored in URL query params (`?sort=date&order=desc&page=1`) so refreshing the page restores the same view.

### Component Spec

**`components/dashboard/StatsRow.tsx`**
```typescript
props: { total: number; ndaCount: number; msaCount: number }
```
Three stat cards side by side. Desktop: row. Mobile: 2-up grid (total card full width, NDA/MSA beside each other).

**`components/dashboard/ContractList.tsx`**
```typescript
props: { contracts: Contract[]; total: number; sort; order; onSortChange; page; onPageChange }
```
Table with sortable column headers (↑/↓ arrows). Pagination controls below table.

**`components/dashboard/ContractRow.tsx`**
```typescript
props: { contract: Contract }
```
Full-row clickable `<tr>`. Status badge: green "Complete", yellow "Processing", red "Error". Error rows show "Retry" text link (goes to `/upload`).

### Design Notes

- Dashboard header: "Welcome back" + user email or first name (from `auth.users`)
- Stats cards: large number, small label below; subtle border; no chart at MVP
- Table: alternating row shading; hover state on clickable rows
- Contract name truncated at 60 chars with ellipsis; full name in `title` attribute for tooltip
- Sortable columns have a cursor pointer and sort arrow; non-sortable columns (Pages, Status) have no pointer
- Mobile: table collapses to card list (one card per contract showing name, type, date, status)

### Edge Cases

| Scenario | Handling |
|---|---|
| 0 contracts | Skip table; render empty state CTA card |
| Contract with `status = 'processing'` | Row is still clickable; results page shows partial state with "Still processing" banner |
| Contract with `status = 'error'` | Red "Error" badge; "Retry" text link goes to `/upload` |
| `total = 0` but `page > 1` in URL | Reset to page 1 automatically |
| Invalid sort param in URL | Ignored; default to `date desc` |
| Very long contract name | Truncate at 60 chars; full name visible on row hover via browser tooltip |

---

## Feature 7 — Feedback Collection

### User Flow

1. User is on `/contracts/[id]` (results page), has finished reviewing key terms
2. At the bottom of the Key Terms Panel: "Rate this review: 👍 👎"
3. User clicks 👍 or 👎
4. `FeedbackModal` opens with selected rating pre-highlighted
5. Optional text area: "Tell us more (optional)" — max 500 chars
6. User clicks "Submit" → POST `/api/feedback` fires
7. Modal closes → success toast: "Thanks for your feedback!"
8. Prompt in Key Terms Panel replaced with "Feedback submitted ✓"
9. User can click "Skip" to close modal without saving

### DB Schema

**Table: `user_feedback`** — one row per submission:

| Column | Value |
|---|---|
| `contract_id` | FK to contracts |
| `user_id` | `auth.uid()` |
| `rating` | `'up'` or `'down'` |
| `comment` | optional text ≤ 500 chars |
| `created_at` | `now()` |

No unique constraint — multiple feedback submissions per contract are allowed.

### DB Tasks

| Task | Query |
|---|---|
| Insert feedback | `INSERT INTO user_feedback (contract_id, user_id, rating, comment) VALUES (:cid, :uid, :rating, :comment) RETURNING id` |

### API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/feedback` | Required | Store thumbs rating + optional comment |

**Request:** `{ contract_id: string; rating: 'up' | 'down'; comment?: string }`  
**Response 201:** `{ id: string }`  
**Errors:** 401, 403, 404, 422 (invalid rating or comment too long)

### State Management

State is local to the Key Terms Panel footer and FeedbackModal — no page-level state needed.

```typescript
// In KeyTermsPanel.tsx or its parent
state: {
  feedbackModalOpen: boolean
  initialRating: 'up' | 'down' | null
  feedbackSubmitted: boolean
}
```

### Component Spec

**`components/feedback/FeedbackModal.tsx`**
```typescript
props: {
  contractId: string
  isOpen: boolean
  initialRating: 'up' | 'down' | null
  onClose: () => void
  onSubmit: (rating: 'up' | 'down', comment: string) => Promise<void>
}
state: { rating, comment, loading, error }
```
- Pre-selects `initialRating` on open
- Submit disabled until `rating` is selected
- Character counter below textarea: "0 / 500"
- On submit: loading state on button; close on success; show inline error on failure

**Trigger UI (inline in KeyTermsPanel footer):**
- Two icon buttons: 👍 and 👎 — clicking either opens modal with that rating pre-selected
- After submission: buttons replaced with static "Feedback submitted ✓" text

### Design Notes

- Modal is centred, medium-width (max 480px), with a dark backdrop overlay
- Thumbs buttons: large, clearly selectable; selected state shows highlighted border + fill
- Textarea: resize: vertical only; placeholder: "The governing law extraction was slightly off…"
- "Skip" is a plain text link, not a button — visually secondary to "Submit"
- Toast notification on success appears at top-right of the screen; auto-dismisses after 3 seconds
- On mobile: modal is bottom-sheet style

### Edge Cases

| Scenario | Handling |
|---|---|
| User submits without selecting rating | Submit button is disabled — impossible to submit without a rating |
| Comment exceeds 500 chars | Client blocks: character counter turns red; Submit disabled |
| Network failure on submit | Error shown inline in modal: "Could not save feedback. Please try again." — modal stays open |
| User submits feedback twice for same contract | Allowed — new row inserted; "Feedback submitted ✓" persists from first submission (UI doesn't reset) |
| User dismisses modal via Skip | Nothing saved; "Rate this review" prompt remains active |
