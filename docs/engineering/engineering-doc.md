# ContractIQ — Engineering Document (High-Level Design)

**Version:** 1.0  
**Date:** July 16, 2026  
**Status:** Draft — Pending Approval  
**Based on PRD:** ContractIQ PRD v1.0 (June 24, 2026)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Scope](#2-product-scope)
3. [User Personas](#3-user-personas)
4. [User Flows](#4-user-flows)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Design and Schema](#7-database-design-and-schema)
8. [AI Architecture](#8-ai-architecture)
9. [API Specification](#9-api-specification)
10. [Feature Breakdown](#10-feature-breakdown)
11. [Folder Structure](#11-folder-structure)
12. [Naming Conventions](#12-naming-conventions)
13. [Testing Strategy](#13-testing-strategy)
14. [Specs to Implementation Mapping](#14-specs-to-implementation-mapping)

---

## 1. Executive Summary

**Project:** ContractIQ  
**Business Goal:** Reduce NDA and MSA contract review time from 90 minutes (manual) to ≤15 minutes end-to-end, making contract review affordable and accessible for SMBs and freelancers without in-house legal counsel.

**Problem Statement:** Business professionals routinely sign NDAs and MSAs without fully understanding what they are agreeing to. Without legal teams, reviewing a single contract takes 90–120 minutes, costs $250–$500/hr in lawyer time, and frequently results in missed obligations, unfavourable terms, or costly disputes. Existing tools (DocuSign CLM, Ironclad, Kira) are built for enterprise legal teams at $50k–$500k/year. Generic AI tools (ChatGPT) produce unstructured summaries with no page references, no confidence scoring, and no contract-type-specific term libraries.

**Solution:** ContractIQ automatically extracts the key terms from any NDA or MSA, attributes each term to its page in the document, scores its confidence, and enables the user to ask plain-English follow-up questions — all grounded strictly in the uploaded contract text.

**Target Users:**
- Founders, COOs, and Procurement Managers at 5–250 person companies with no in-house legal
- Freelancers and consultants signing client MSAs without legal support

**Success Criteria (MVP Launch):**

| Metric | Target |
|---|---|
| Key-term extraction accuracy (F1) | ≥ 88% F1 on NDA test set; ≥ 85% on MSA |
| End-to-end extraction latency | ≤ 30 seconds P95 for contracts ≤ 20 pages |
| Chat response latency | ≤ 15 seconds P95 |
| Confidence score calibration error | ≤ 0.10 per bucket |
| Term correction rate (users editing AI output) | ≤ 12% of extracted terms |
| 30-day user retention | ≥ 45% |
| Cost per contract analysis | ≤ $0.25 (extraction ≤ $0.20) |
| Uptime SLA | 99.5% |

---

## 2. Product Scope

### In Scope (MVP)

- Email/password authentication via Supabase Auth
- PDF upload with file validation (≤10 MB, ≤20 pages, text-layer only)
- Server-side PDF text extraction using `pdf-parse` with `[PAGE N]` markers, stored once at upload
- GPT-4o key term extraction (NDA: 10 standard terms; MSA: 12 standard terms) with confidence scores and source sentences
- Custom key terms (up to 5 per analysis) added before processing
- Results page: two-panel layout — interactive PDF viewer (PDF.js) + key terms panel, with text viewer fallback
- Click-to-navigate from key term panel to corresponding page in PDF viewer
- Confidence colour-coding (green ≥ 80%, amber 50–79%, red < 50%) with non-dismissible ⚠️ warning below 50%
- Expandable "Why?" tooltip per term showing verbatim source sentence
- Inline key term editing with "Edited" badge and immutable original AI value stored separately
- Contract Q&A chat grounded in full contract text (GPT-4o), with mandatory page citations
- Persistent chat history per contract stored in Supabase
- Dashboard: total contracts reviewed, NDA/MSA breakdown, sortable contract history list
- Feedback submission: thumbs up/down + optional text comment per contract review
- User-initiated contract deletion (all associated data)
- "Not legal advice" disclaimer on every results page
- WCAG 2.1 AA compliance

### Out of Scope (MVP)

- Scanned PDF / OCR support
- Non-English contracts or non-US/UK contract law
- Export to CSV or PDF report
- Batch upload (multiple contracts at once)
- Multi-user workspaces and team plans
- Fine-tuned LLM models
- Contract comparison view
- Email notifications
- Dashboard analytics charts

### Future Enhancements (v1.1–v1.2)

- Export key terms to CSV and PDF summary report
- Batch upload (up to 5 contracts)
- Scanned PDF support via OCR (AWS Textract)
- Dashboard analytics charts (contracts by month, correction rate trend)
- Contract comparison (side-by-side key terms across 2 contracts)
- Multi-user workspace (team plans, up to 5 seats)
- Non-US/non-UK contract jurisdiction support with jurisdiction-specific few-shot examples

---

## 3. User Personas

| Attribute | Primary — Time-Pressed Founder / Ops Lead | Secondary — Freelancer / Consultant |
|---|---|---|
| **Role** | Founder, COO, Procurement Manager, Legal Ops Manager | Individual contributor (designer, developer, marketer, consultant) |
| **Company size** | 5–250 employees, no in-house legal | Solo or 1–5 person practice |
| **Contract volume** | 5–15 NDAs or MSAs per month | 1–4 MSAs per month from larger clients |
| **Current behaviour** | Google searches or ad-hoc legal consultations; spends 90–120 min per contract | Signs without reading carefully; power imbalance discourages pushback |
| **Core pain** | Misses auto-renewal, indemnification limits, IP assignment clauses; pays $250–$500/hr for routine review | Cannot afford legal review; no tool gives page-level references with confidence scores |
| **Key needs** | Fast extraction, confidence scoring, page attribution, chat Q&A | Plain-English explanations, low cost, no legal expertise required |
| **Access level** | Authenticated user; owns all contracts they upload | Authenticated user; owns all contracts they upload |
| **Primary workflow** | Upload NDA/MSA → review key terms → ask questions via chat → edit if needed | Upload MSA → check specific clauses → verify low-confidence terms against PDF |

---

## 4. User Flows

### Flow 1 — New Visitor → Sign Up → Dashboard

```
User clicks "Get Started Free" on Landing Page
  → Frontend renders Supabase Auth sign-up modal (email + password)
    → Supabase Auth creates user in auth.users + sends verification email
      → On email verification, Supabase session token stored in browser cookie
        → Middleware detects authenticated session → redirects to /dashboard
          → Dashboard renders empty state: "No contracts reviewed yet"
```

**Error path:** Invalid email format or weak password → inline validation error before submit. Duplicate email → Supabase returns error → display "An account with this email already exists."

---

### Flow 2 — Returning User → Sign In → Dashboard

```
User clicks "Sign In" on Landing Page
  → Frontend renders Supabase Auth sign-in modal (email + password)
    → Supabase Auth validates credentials → returns session token
      → Middleware confirms session → redirects to /dashboard
        → Dashboard renders contract history list (sorted by created_at DESC)
```

**Error path:** Wrong password → "Invalid email or password" (no enumeration). Session expired → redirect to /auth/signin with `?redirect=/dashboard`.

---

### Flow 3 — Core Contract Review Flow

```
Step 1 — Upload
  User clicks "Review a Contract" on Dashboard
    → /upload page renders contract type selector (NDA | MSA) + drag-and-drop zone
      → User selects contract type + drops/selects PDF file
        → Frontend: validates file type (PDF only), size (≤10MB) client-side
          → POST /api/upload (multipart: file, contract_type, contract_name)
            → Backend: pdf-parse extracts text with [PAGE N] markers
              → Backend: validates page count (≤20), token count (≤15,000), extracted text length (≥100 words)
                → Backend: writes contract row to DB (status: 'pending', contract_text stored, file_path: null initially)
                  → Backend: non-blocking Supabase Storage upload (failure only hides PDF viewer)
                    → Response: { contract_id, page_count, standard_terms_preview[] }
                      → Frontend: navigates to /upload?step=preview&contract_id=<id>

Step 2 — Pre-Processing Preview
  /upload page renders preview card listing standard terms for selected contract type
    → "+ Add Key Term" button allows typing custom term names (up to 5)
      → Custom terms appear in preview list with "Custom" badge
        → User clicks "Process Contract"
          → Progress indicator: Step 1: Extracting text ✓ → Step 2: Analysing with AI… → Step 3: Compiling results…
            → POST /api/process { contract_id, custom_terms: string[] }
              → Backend: reads contract_text from DB (never re-downloads PDF)
                → Backend: builds extraction prompt (NDA or MSA few-shot + custom terms appended)
                  → Backend: calls GPT-4o with JSON mode, temperature 0.1
                    → Backend: parses JSON response → validates schema → retries once if parse fails
                      → Backend: writes key_terms rows to DB (status → 'complete')
                        → Response: { key_terms[] }
                          → Frontend: navigates to /contracts/[id]

Step 3 — Results Page
  /contracts/[id] renders two-panel layout:
    LEFT: PDFViewer (PDF.js with signed URL) OR TextViewer fallback if Storage unavailable
    RIGHT: KeyTermsPanel — list of TermCard components
      → Each TermCard shows: Term Name | Extracted Value | Page Number | Confidence Score (colour-coded)
        → Confidence < 50%: ⚠️ icon + non-dismissible tooltip: "Low confidence — verify in document"
          → Clicking page number: PDFViewer/TextViewer scrolls to targetPage prop
            → Clicking "Why?": expands source_sentence verbatim tooltip
              → Clicking TermCard to edit: opens TermEditModal
                → PATCH /api/key-terms/:id { value }
                  → Backend: updates value, sets is_edited=true, preserves ai_value
                    → TermCard shows "Edited" badge

Step 4 — Chat (optional, from results page)
  User clicks "Chat with Contract" floating button or tab
    → ChatInterface renders (right panel or full-width overlay)
      → User types question → POST /api/chat { session_id, message, contract_id }
        → Backend: loads full contract_text + all prior chat_messages (up to 200, ascending)
          → Backend: applies query classification (contract / history / both)
            → Backend: calls GPT-4o with document-only system prompt, temperature 0.4
              → Response includes [Page X] citation in content
                → Backend: writes user message + assistant response to chat_messages
                  → Frontend: renders ChatMessage components (user right-aligned, AI left-aligned)
                    → [Page X] citation is clickable → scrolls PDF/Text viewer to that page
```

---

### Flow 4 — Dashboard Contract History

```
User lands on /dashboard (authenticated)
  → GET /api/contracts
    → Backend: queries contracts table WHERE user_id = auth.uid() ORDER BY created_at DESC
      → Response: [{ id, contract_name, contract_type, status, created_at, page_count }]
        → Dashboard renders:
            - Stats row: total contracts, NDA count, MSA count
            - ContractList: sortable by date / name / type
              → Clicking a row: navigates to /contracts/[id] (loads existing key_terms + chat session)
```

---

### Flow 5 — Feedback Submission

```
User clicks thumbs up or thumbs down on results page
  → FeedbackModal opens: rating pre-selected, optional text comment field
    → User clicks "Submit"
      → POST /api/feedback { contract_id, rating: 'up'|'down', comment? }
        → Backend: writes to user_feedback table
          → Modal closes, confirmation toast shown
```

---

### Flow 6 — Contract Deletion

```
User clicks "Delete" on a contract (dashboard or results page)
  → Confirmation dialog: "This will permanently delete the contract and all associated data"
    → User confirms
      → DELETE /api/contracts/:id
        → Backend: deletes key_terms, chat_messages, chat_sessions, user_feedback, then contract row
          → Backend: removes file from Supabase Storage (if file_path not null)
            → Response: { success: true }
              → Frontend: removes contract from dashboard list
```

---

## 5. Frontend Architecture

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | Fixed per project convention; server components reduce client bundle; API routes co-located |
| Styling | Tailwind CSS | Utility-first; consistent with design system in `docs/design.md` |
| State management | React Context + `useState`/`useReducer` | MVP scale; no cross-app global state beyond auth session |
| Auth | `@supabase/ssr` | Manages session tokens in cookies; works with Next.js middleware |
| PDF rendering | PDF.js (client-side) | No server load for rendering; page navigation + zoom; lazy page loading for large files |
| Real-time | Supabase Realtime (optional, v1.0) | For streaming chat message appearance |

### Route Map

| Route | Protection | Purpose |
|---|---|---|
| `/` | Public | Landing page — value prop, demo GIF, Sign In / Get Started CTAs |
| `/auth/signin` | Public | Supabase Auth sign-in form |
| `/auth/signup` | Public | Supabase Auth sign-up form |
| `/dashboard` | Protected | Contract history, stats, "Review a Contract" CTA |
| `/upload` | Protected | Contract type selector, file upload, pre-processing preview, custom terms |
| `/contracts/[id]` | Protected (owner) | Results: PDF viewer + key terms panel + chat tab |

### Route Protection

`middleware.ts` intercepts all requests under `/(protected)` group, checks Supabase session cookie, and redirects unauthenticated users to `/auth/signin?redirect=<current-path>`.

### Page & Component Hierarchy

```
app/layout.tsx (AuthProvider wraps all routes)
├── app/page.tsx → <LandingPage />
├── app/(auth)/signin/page.tsx → <AuthForm mode="signin" />
├── app/(auth)/signup/page.tsx → <AuthForm mode="signup" />
├── app/(protected)/dashboard/page.tsx
│   ├── <StatsRow />                    # total contracts, NDA/MSA breakdown
│   └── <ContractList />               # sortable table rows
│       └── <ContractRow />
├── app/(protected)/upload/page.tsx
│   ├── <ContractTypeSelector />
│   ├── <FileDropzone />
│   ├── <TermsPreviewCard />           # standard terms for selected type
│   ├── <CustomTermInput />            # + Add Key Term
│   └── <ProcessButton />             # triggers /api/process
└── app/(protected)/contracts/[id]/page.tsx
    ├── <ResultsLayout />              # two-panel wrapper
    │   ├── <PDFViewer />              # PDF.js; receives targetPage prop
    │   └── <TextViewer />            # fallback; parses [PAGE N] markers
    ├── <KeyTermsPanel />
    │   └── <TermCard />              # per term; clickable, expandable, editable
    │       ├── <ConfidenceIndicator />
    │       └── <SourceSentenceTooltip />
    ├── <TermEditModal />
    ├── <ChatInterface />             # floating button or tab
    │   └── <ChatMessage />           # per message; [Page X] citation clickable
    ├── <FeedbackModal />
    └── <LegalDisclaimer />           # "Not legal advice" — always visible
```

### UX States

| State | Behaviour |
|---|---|
| Loading | Skeleton cards for key terms panel; progress stepper during extraction |
| Empty (dashboard) | "No contracts reviewed yet — upload your first contract to begin" + CTA |
| Empty (chat) | "Ask a question about your contract" placeholder |
| Error (upload) | Inline banner with specific error code message (scanned PDF, file too large, page limit) |
| Error (OpenAI timeout) | "Analysis is taking longer than expected. Try again in a few minutes." + Retry button |
| Low confidence | ⚠️ icon on TermCard; non-dismissible tooltip; PDF viewer auto-highlights nearest page span |
| Edited term | "Edited" badge replaces confidence indicator; original AI value stored |
| Responsive | Desktop-first two-panel layout; mobile collapses to stacked single-column view |
| Accessibility | WCAG 2.1 AA: keyboard navigation for all interactive elements, ARIA labels on icons, sufficient colour contrast for confidence indicators |

---

## 6. Backend Architecture

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Next.js 14 API Routes (Vercel) | Co-located with frontend; zero-config deploy; Edge Functions for lower latency if needed |
| PDF extraction | `pdf-parse` (Node.js) | Open-source; handles text-layer PDFs; no data egress to third parties |
| LLM | OpenAI API (GPT-4o) | Server-side only — API key never exposed to client |
| Database client | `@supabase/supabase-js` (server) | Service role key for server routes; anon key + RLS for client |
| Auth validation | `@supabase/ssr` `createServerClient` | Validates session on every protected API route |
| Rate limiting | `@upstash/ratelimit` (Redis) OR in-memory with sliding window | Per-user limit on `/api/process` (5/hr) and `/api/chat` (60/hr) |

### Core Modules

| Module | Path | Responsibility |
|---|---|---|
| OpenAI client | `lib/openai.ts` | GPT-4o client instantiation; `buildExtractionPrompt(type, customTerms)`; `buildChatPrompt(contractText, history, query)`; retry logic |
| Supabase server client | `lib/supabase.ts` | Service-role client for API routes; auth session validation helper |
| Supabase browser client | `lib/supabase-browser.ts` | Anon-key client for client components |
| PDF utility | `lib/pdf.ts` | `extractTextWithPageMarkers(buffer): { text, pageCount }`; wraps `pdf-parse` |
| Validation | `lib/validation.ts` | `validateUpload(file)`: size, page count, token count, scanned-PDF detection; `validateCustomTerms(terms[])` |
| Constants | `lib/constants.ts` | `MAX_FILE_SIZE_MB`, `MAX_PAGES`, `MAX_TOKENS`, `MAX_CUSTOM_TERMS`, `CONFIDENCE_THRESHOLD_LOW`, confidence colour thresholds |

### Request Lifecycle (Extraction)

```
POST /api/process
  1. Validate session (createServerClient → getUser())
  2. Validate request body (contract_id, custom_terms[])
  3. Confirm user owns contract_id (SELECT user_id FROM contracts WHERE id = :id)
  4. Read contract_text from DB (no file download)
  5. Update contracts.status = 'processing'
  6. Build extraction prompt (buildExtractionPrompt)
  7. Call GPT-4o with JSON mode, temperature 0.1, max_tokens 2000
  8. Parse JSON response → validate schema
     - On parse error: single retry with correction prompt
     - On second failure: set status = 'error', return 500 with user-facing message
  9. Insert key_terms rows (batch insert)
  10. Update contracts.status = 'complete'
  11. Return { key_terms[] }
```

### Error Handling

| Error | Response | DB State |
|---|---|---|
| Scanned PDF (< 100 words extracted) | 422 `{ error: "Scanned PDFs are not supported yet", code: "SCANNED_PDF" }` | Contract row not created |
| File > 10 MB | 413 `{ error: "File must be under 10 MB", code: "FILE_TOO_LARGE" }` | Contract row not created |
| Page count > 20 | 422 `{ error: "Contracts over 20 pages are not supported in MVP", code: "PAGE_LIMIT_EXCEEDED" }` | Contract row not created |
| Token count > 15,000 | 422 `{ error: "Contract text exceeds processing limit", code: "TOKEN_LIMIT_EXCEEDED" }` | Contract row not created |
| OpenAI timeout / error | 502 with retry CTA | `contracts.status = 'error'` — user can retry without re-upload |
| JSON parse failure (after retry) | 502 with retry CTA | `contracts.status = 'error'` |
| Unauthorized (wrong user_id) | 403 `{ error: "Forbidden", code: "FORBIDDEN" }` | No change |

### Service Interaction Diagram

```
Browser (Next.js client components)
       │
       │  HTTPS / Supabase JS (anon key + RLS)
       ▼
Supabase Auth ──── session tokens (cookies) ────► Next.js Middleware
                                                          │
                                        Protected route? Yes → continue
                                                          │
                                                          ▼
                                              Next.js API Routes (server)
                                            ┌─────────────────────────────┐
                                            │  lib/supabase.ts            │
                                            │  lib/openai.ts              │
                                            │  lib/pdf.ts                 │
                                            │  lib/validation.ts          │
                                            └──────┬──────────────────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                       Supabase DB          Supabase Storage       OpenAI API
                    (PostgreSQL + RLS)   (PDF files, signed URLs)   (GPT-4o)
```

---

## 7. Database Design and Schema

### Overview

Single Supabase project. All tables live in the `public` schema. All tables have Row Level Security enabled. The `auth.users` table is managed by Supabase Auth — all other tables reference it via `user_id` foreign key.

The complete database setup (tables, indexes, RLS policies, Storage bucket, Storage RLS policies) is expressed as a single paste-and-run SQL file: `supabase/database.sql`.

---

### Table: `contracts`

**Purpose:** One row per uploaded contract. Stores extracted text and processing status.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | RLS pivot |
| `contract_name` | `text` | NOT NULL | Original filename (sanitised) |
| `contract_type` | `text` | NOT NULL, CHECK IN ('nda', 'msa') | User-selected |
| `contract_text` | `text` | NOT NULL | Full text with `[PAGE N]` markers |
| `file_path` | `text` | NULLABLE | Storage path: `contracts/{user_id}/{id}/{filename}.pdf`; null if Storage upload failed |
| `status` | `text` | NOT NULL, default 'pending', CHECK IN ('pending', 'processing', 'complete', 'error') | |
| `page_count` | `integer` | NOT NULL | Extracted by pdf-parse |
| `token_count` | `integer` | NULLABLE | Approximate token count at upload |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `last_accessed_at` | `timestamptz` | NULLABLE | Updated on each /contracts/:id GET |

**Indexes:** `contracts_user_id_idx ON contracts(user_id)`  
**RLS policies:**
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

---

### Table: `key_terms`

**Purpose:** One row per extracted (or custom) key term per contract. Stores both the current value and the immutable original AI value for feedback loop.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `contract_id` | `uuid` | FK → `contracts(id)` ON DELETE CASCADE, NOT NULL | |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | Denormalised for RLS |
| `term_name` | `text` | NOT NULL | e.g. "Governing Law", "Notice Period" |
| `value` | `text` | NOT NULL | Current value (may be user-edited) |
| `ai_value` | `text` | NOT NULL | Immutable original AI-extracted value |
| `page_number` | `integer` | NOT NULL | 1-indexed |
| `confidence_score` | `float` | NOT NULL, CHECK BETWEEN 0 AND 1 | 0.0–1.0 from model self-report |
| `source_sentence` | `text` | NOT NULL | Verbatim sentence from contract used for extraction |
| `is_manual` | `boolean` | NOT NULL, default false | true for user-added custom terms |
| `is_edited` | `boolean` | NOT NULL, default false | true if user corrected the value |
| `sort_order` | `integer` | NULLABLE | For preserving display order of standard terms |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:** `key_terms_contract_id_idx ON key_terms(contract_id)`  
**RLS policies:** SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id`

---

### Table: `chat_sessions`

**Purpose:** One chat session per contract per user. Serves as the parent for all chat messages on a contract.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `contract_id` | `uuid` | FK → `contracts(id)` ON DELETE CASCADE, NOT NULL | |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:** `chat_sessions_contract_id_idx ON chat_sessions(contract_id)`  
**RLS policies:** SELECT/INSERT/DELETE: `auth.uid() = user_id`

---

### Table: `chat_messages`

**Purpose:** All messages (user and assistant) for a chat session, in chronological order.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `session_id` | `uuid` | FK → `chat_sessions(id)` ON DELETE CASCADE, NOT NULL | |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | Denormalised for RLS |
| `role` | `text` | NOT NULL, CHECK IN ('user', 'assistant') | |
| `content` | `text` | NOT NULL | Full message text including `[Page X]` citations |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:** `chat_messages_session_id_idx ON chat_messages(session_id)`  
**RLS policies:** SELECT/INSERT: `auth.uid() = user_id`

---

### Table: `user_feedback`

**Purpose:** Thumbs-up / thumbs-down feedback per contract review, with optional comment.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `contract_id` | `uuid` | FK → `contracts(id)` ON DELETE CASCADE, NOT NULL | |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | |
| `rating` | `text` | NOT NULL, CHECK IN ('up', 'down') | |
| `comment` | `text` | NULLABLE | Optional free-text |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:** `user_feedback_contract_id_idx ON user_feedback(contract_id)`  
**RLS policies:** SELECT/INSERT: `auth.uid() = user_id`

---

### Supabase Storage

**Bucket:** `contracts` (private, not public)  
**File path pattern:** `contracts/{user_id}/{contract_id}/{filename}.pdf`

Created via SQL (not dashboard):
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
```

**Storage RLS policies:**
```sql
-- INSERT: user can only upload to their own folder
CREATE POLICY "Users can upload their own contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: user can only read their own files
CREATE POLICY "Users can read their own contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: user can only delete their own files
CREATE POLICY "Users can delete their own contracts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Signed URL expiry:** 1 hour (3600 seconds). Generated server-side via `supabase.storage.from('contracts').createSignedUrl(path, 3600)`.

**Non-blocking upload:** Storage upload failure sets `file_path = null` in the contracts table. The AI extraction pipeline reads from `contracts.contract_text` (DB) and is unaffected. The PDF viewer is hidden; the TextViewer fallback renders from `contract_text`.

---

### Entity Relationship Diagram

```
auth.users (managed by Supabase)
    │
    │ 1:N
    ▼
contracts ──────────────────────────────────┐
    │ 1:N                    │ 1:N           │ 1:1 (optional)
    ▼                        ▼               ▼
key_terms              chat_sessions    user_feedback
                            │ 1:N
                            ▼
                       chat_messages
```

---

## 8. AI Architecture

### Provider & Model

| Parameter | Value |
|---|---|
| Provider | OpenAI API |
| Model | GPT-4o |
| Context window | 128k tokens |
| Response format (extraction) | `{ "type": "json_object" }` (JSON mode) |
| Response format (chat) | Free text |
| Temperature (extraction) | 0.1 |
| Temperature (chat) | 0.4 |
| Max output tokens (extraction) | 2,000 |
| Max output tokens (chat) | 1,000 |
| Latency target | ≤ 20 seconds P95 per call |
| Estimated cost per analysis | ≈ $0.097 (15,000 input + 1,500 output at GPT-4o pricing) |

---

### Key Term Extraction

**Technique:** Few-shot prompting  
**Examples in system prompt:** 3 labelled NDA contract examples + 3 labelled MSA examples (injected as full system prompt at build time, not per-request user data)

**Extraction prompt structure:**
```
SYSTEM:
You are a contract analysis assistant. Extract the following key terms from the contract text below.
For each term, return a JSON object with these exact fields:
  - term_name (string)
  - value (string — the extracted value or "Not found")
  - page_number (integer — 1-indexed page where the term appears)
  - confidence_score (float 0.0–1.0 — your confidence in this extraction)
  - source_sentence (string — verbatim sentence from the contract supporting this extraction)

Standard terms to extract: [<NDA or MSA term list>]
Custom terms to extract: [<user's custom terms if any>]

<3 labelled examples for the selected contract type>

CONTRACT TEXT:
{contract_text}

Return only the JSON array. No explanation.

USER:
Extract the key terms.
```

**Standard NDA terms:** Parties, Effective Date, Confidentiality Obligations, Permitted Disclosures, Term & Duration, Governing Law, Jurisdiction, IP Ownership, Non-Solicitation, Breach & Remedy

**Standard MSA terms:** Parties, Service Scope, Payment Terms, Invoice Schedule, Late Payment Penalty, Liability Cap, Indemnification, IP Ownership, Termination Clause, Governing Law, Dispute Resolution, Notice Period

**Custom terms:** Appended to the standard term list as additional zero-shot targets with the same JSON schema output requirement.

**JSON parse failure recovery:** If response is not valid parseable JSON:
1. Single automatic retry prompt: `"Your previous response was not valid JSON. Return only the JSON array, no explanation."`
2. If second response also fails: return error to user; set `contracts.status = 'error'`; user can retry without re-uploading.

---

### Contract Chat (Q&A)

**Technique:** Full-context RAG (no vector chunking at MVP)  
**Context:** Full `contracts.contract_text` + all prior `chat_messages` for the session (up to 200 messages, ascending order)

**Chat prompt structure:**
```
SYSTEM:
You are a contract review assistant. Answer questions strictly based on the contract document provided below.
Do not use any general legal knowledge or information not present in this document.
If the answer to a question is not in the document, respond with: "I cannot find this in the document."
Every response must include a page citation in the format [Page X].
Begin every response with "Based on the document, ..."

CONTRACT TEXT:
{contract_text}

USER: {user_message}
ASSISTANT: [previous messages as context]
USER: {current_message}
```

**Query classification:** A lightweight classification step (no extra API call) inspects the user's message:
- `contract` — question is about the contract content → include full contract text in context
- `history` — question is about prior chat ("what did you say about X?") → include message history, omit contract text to save tokens
- `both` — complex question → include both

**Mandatory `[Page X]` citation:** System prompt enforces it; response validation checks for presence of `[Page X]` pattern before returning to user. If absent, a warning is logged (not shown to user) and the response is still returned.

**"Not found" as correct:** `"I cannot find this in the document"` is a valid and expected response — not a failure.

---

### Confidence Scoring

| Score Range | Display | Colour | Action |
|---|---|---|---|
| 80%–100% | Green badge | `#22c55e` | No additional action |
| 50%–79% | Amber badge | `#f59e0b` | No additional action |
| 0%–49% | Red badge + ⚠️ | `#ef4444` | Non-dismissible tooltip: "Low confidence — verify in document"; PDF viewer auto-highlights nearest matching page span |

Confidence is self-reported by the model within the extraction JSON — no separate calibration call. Monthly calibration evaluation checks predicted confidence vs. actual accuracy per 10% bucket. A UI calibration warning is shown if eval reveals ≥ 15% miscalibration.

---

### Hallucination Guardrails Summary

| Layer | Guardrail |
|---|---|
| Extraction | Confidence score per term; source sentence required per term; temperature 0.1; JSON mode |
| Extraction | Low-confidence ⚠️ warning (non-dismissible, never hidden) |
| Extraction | Source sentence expandable "Why?" section for human verification |
| Chat | System prompt: document-only answers |
| Chat | Mandatory `[Page X]` citation on every response |
| Chat | "Based on the document…" framing prefix |
| Chat | "I cannot find this in the document" expected fallback |
| Chat | Automated regression test: off-topic question → assert "I cannot find" response |
| UI | "Not legal advice" disclaimer on every results page |
| UI | Inline correction: user can edit any term; original AI value preserved for feedback loop |

---

### Rate Limiting & Cost Controls

| Endpoint | Limit | Window |
|---|---|---|
| `/api/process` | 5 extractions | Per user per hour |
| `/api/chat` | 60 messages | Per user per hour |

Cost alert: if per-analysis token cost exceeds $0.20 (extraction) → alert to Slack / monitoring dashboard.

OpenAI retry strategy: 3 attempts with exponential backoff (1s, 2s, 4s) on 429 / 5xx responses before returning error to user.

---

## 9. API Specification

All routes require `Authorization: Bearer <supabase_session_token>` (validated via `@supabase/ssr`). All responses return `Content-Type: application/json`.

---

### POST `/api/upload`

**Purpose:** Accept PDF, extract text, create contract row, start non-blocking Storage upload.  
**Auth:** Required  
**Content-Type:** `multipart/form-data`

**Request:**
```
file          — PDF binary (required)
contract_type — "nda" | "msa" (required)
contract_name — string, original filename (required)
```

**Response 200:**
```json
{
  "contract_id": "uuid",
  "page_count": 12,
  "standard_terms_preview": ["Parties", "Effective Date", "Governing Law", "..."]
}
```

**Validation errors:**
| Code | HTTP | Message |
|---|---|---|
| `FILE_TOO_LARGE` | 413 | "File must be under 10 MB" |
| `PAGE_LIMIT_EXCEEDED` | 422 | "Contracts over 20 pages are not supported yet" |
| `SCANNED_PDF` | 422 | "Scanned PDFs are not supported yet. Please upload a text-layer PDF." |
| `TOKEN_LIMIT_EXCEEDED` | 422 | "Contract text exceeds the processing limit. Please upload a shorter contract." |
| `INVALID_FILE_TYPE` | 415 | "Only PDF files are accepted" |

---

### POST `/api/process`

**Purpose:** Run GPT-4o key term extraction on a previously uploaded contract.  
**Auth:** Required  
**Content-Type:** `application/json`

**Request:**
```json
{
  "contract_id": "uuid",
  "custom_terms": ["Non-compete radius", "Auto-renewal clause"]
}
```

**Response 200:**
```json
{
  "key_terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "California, USA",
      "page_number": 8,
      "confidence_score": 0.94,
      "source_sentence": "This Agreement shall be governed by and construed in accordance with the laws of the State of California.",
      "is_manual": false,
      "is_edited": false
    }
  ]
}
```

**Errors:** `429` rate limit; `502` OpenAI failure (with `retry: true` flag); `403` user does not own contract; `404` contract not found

---

### GET `/api/contracts`

**Purpose:** List all contracts for the authenticated user.  
**Auth:** Required

**Query params:** `sort` (date | name | type), `order` (asc | desc), `page`, `limit`

**Response 200:**
```json
{
  "contracts": [
    {
      "id": "uuid",
      "contract_name": "Acme NDA 2026.pdf",
      "contract_type": "nda",
      "status": "complete",
      "page_count": 12,
      "created_at": "2026-07-10T14:23:00Z"
    }
  ],
  "total": 14
}
```

---

### GET `/api/contracts/:id`

**Purpose:** Get single contract with all key terms and active chat session ID.  
**Auth:** Required (owner only)

**Response 200:**
```json
{
  "contract": {
    "id": "uuid",
    "contract_name": "...",
    "contract_type": "nda",
    "status": "complete",
    "page_count": 12,
    "created_at": "..."
  },
  "key_terms": [ /* same schema as /api/process */ ],
  "chat_session_id": "uuid | null"
}
```

---

### PATCH `/api/key-terms/:id`

**Purpose:** Save a user's inline correction to a key term.  
**Auth:** Required (owner only)  
**Content-Type:** `application/json`

**Request:**
```json
{ "value": "36 months" }
```

**Response 200:**
```json
{
  "id": "uuid",
  "value": "36 months",
  "is_edited": true,
  "ai_value": "24 months"
}
```

---

### POST `/api/chat`

**Purpose:** Send a user message and receive a grounded GPT-4o response.  
**Auth:** Required  
**Content-Type:** `application/json`

**Request:**
```json
{
  "contract_id": "uuid",
  "session_id": "uuid",
  "message": "What happens if I breach the NDA?"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "role": "assistant",
  "content": "Based on the document, if you breach the NDA, the non-breaching party may seek injunctive relief and recover all reasonable costs and attorneys' fees. [Page 7]",
  "created_at": "2026-07-16T09:12:00Z"
}
```

**Errors:** `429` rate limit; `502` OpenAI failure

---

### GET `/api/chat/:sessionId`

**Purpose:** Load full chat history for a session (for persistent chat on page reload).  
**Auth:** Required (owner only)

**Response 200:**
```json
{
  "messages": [
    { "id": "uuid", "role": "user", "content": "...", "created_at": "..." },
    { "id": "uuid", "role": "assistant", "content": "...", "created_at": "..." }
  ]
}
```

---

### POST `/api/feedback`

**Purpose:** Submit thumbs-up / thumbs-down rating for a contract review.  
**Auth:** Required  
**Content-Type:** `application/json`

**Request:**
```json
{
  "contract_id": "uuid",
  "rating": "up",
  "comment": "Very accurate extraction of the governing law clause"
}
```

**Response 201:**
```json
{ "id": "uuid" }
```

---

### DELETE `/api/contracts/:id`

**Purpose:** Permanently delete a contract and all associated data (key_terms, chat_sessions, chat_messages, user_feedback, Storage file).  
**Auth:** Required (owner only)

**Response 200:**
```json
{ "success": true }
```

---

### GET `/api/storage/signed-url/:contractId`

**Purpose:** Generate a 1-hour signed URL for the PDF viewer.  
**Auth:** Required (owner only)

**Response 200:**
```json
{ "signed_url": "https://..." }
```

**Response 404:** `{ "error": "PDF file not available", "code": "NO_FILE_PATH" }` — Frontend renders TextViewer fallback.

---

## 10. Feature Breakdown

### Phase 1 — Foundation (v0.1, Weeks 1–2)

| Feature | Acceptance Criteria | Dependencies |
|---|---|---|
| Supabase project setup + all DB tables | All tables created via single paste-and-run SQL; RLS enabled; Storage bucket created | Supabase project provisioned |
| Landing page (static) | Value prop, demo GIF, Sign In / Get Started CTAs render correctly | None |
| Email/password sign-up | Auth flow completes in ≤10s; user redirected to /dashboard on success; invalid credentials return clear error | Supabase Auth configured |
| Email/password sign-in | Same as sign-up; session persists across browser refresh | Supabase Auth |
| Sign-out | Session cleared; user redirected to landing page | Supabase Auth |
| Empty dashboard state | "No contracts reviewed yet" state renders; "Review a Contract" CTA visible | Auth, DB |

---

### Phase 2 — Core Review Flow (v0.2, Weeks 3–5)

| Feature | Acceptance Criteria | Dependencies |
|---|---|---|
| Contract type selector | NDA / MSA dropdown renders; selection persists through upload flow | Phase 1 |
| PDF upload + validation | Accepts ≤10 MB PDF; rejects scanned PDFs, files >20 pages, non-PDFs with clear error | pdf-parse |
| Text extraction + storage | `contract_text` stored with `[PAGE N]` markers; `page_count` accurate | pdf-parse |
| GPT-4o extraction (NDA) | All 10 standard NDA terms extracted; each has value, page, confidence, source_sentence | OpenAI API key |
| GPT-4o extraction (MSA) | All 12 standard MSA terms extracted; same structure | OpenAI API key |
| Key terms panel | All terms display with name, value, page number, confidence colour-coded badge | Phase 2 extraction |
| Low-confidence warnings | Terms < 50% confidence show ⚠️ + non-dismissible tooltip; terms are NOT hidden | Phase 2 panel |
| Results stored in Supabase | `key_terms` rows created; `contracts.status = 'complete'` | DB |

---

### Phase 3 — Enriched Experience (v0.3, Weeks 6–8)

| Feature | Acceptance Criteria | Dependencies |
|---|---|---|
| Pre-processing preview | Standard term names listed on upload screen before processing triggers | Phase 2 |
| Custom key term addition | Up to 5 custom terms added; appear in preview with "Custom" badge; processed results include them with same schema | Phase 2 |
| Inline PDF viewer (PDF.js) | All pages render; user can scroll, zoom; correct page loads on term click | Supabase Storage signed URL |
| TextViewer fallback | Renders when Storage unavailable; parses `[PAGE N]` markers; supports same `targetPage` navigation | Phase 2 contract_text |
| Click-to-navigate | Clicking page number in TermCard scrolls PDF/Text viewer to that page with highlight | PDF viewer + TermCard |
| Source sentence tooltip | "Why?" expand on each TermCard shows verbatim `source_sentence` | Phase 2 extraction |

---

### Phase 4 — Chat & History (v0.4, Weeks 9–11)

| Feature | Acceptance Criteria | Dependencies |
|---|---|---|
| Contract chat interface | Chat responds in ≤15s; all responses grounded in document; `[Page X]` citation in every response | OpenAI API; contract_text in DB |
| "Not found" fallback | Off-topic question returns "I cannot find this in the document" | Chat prompt |
| Persistent chat history | Reopening /contracts/[id] loads prior chat messages in order | chat_messages table |
| Dashboard contract history | All contracts listed; sortable by date/name/type; clicking opens results | DB |
| Inline key term editing | Inline edit saves ≤2s; "Edited" badge appears; ai_value unchanged | PATCH /api/key-terms/:id |
| Error states | Upload failure, OpenAI timeout errors show human-readable message + Retry CTA | API error handling |

---

### Phase 5 — Launch (v1.0, Weeks 12–14)

| Feature | Acceptance Criteria | Dependencies |
|---|---|---|
| Feedback submission | Thumbs up/down + comment submits in ≤2s; stored in user_feedback | Phase 4 |
| End-to-end performance | Upload-to-results ≤30s P95; chat ≤15s P95 | Phase 2–4 |
| Security audit | RLS cross-user access test passes; signed URLs expire at 1 hour; API key not in client bundle | All phases |
| WCAG 2.1 AA | Keyboard navigation works for all interactions; colour contrast passes; ARIA labels present | All phases |
| Rate limiting | /api/process: 5/hr per user; /api/chat: 60/hr per user | Upstash / middleware |
| Onboarding tooltips | First-time user sees walkthrough overlay on dashboard and upload screen | Auth |
| "Not legal advice" disclaimer | Visible on every /contracts/[id] page; cannot be dismissed | Results page |

---

## 11. Folder Structure

```
contractiq/
├── app/
│   ├── (auth)/
│   │   ├── signin/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   ├── (protected)/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── upload/
│   │   │   └── page.tsx
│   │   └── contracts/
│   │       └── [id]/
│   │           └── page.tsx              # results: PDF viewer + key terms + chat
│   ├── api/
│   │   ├── upload/
│   │   │   └── route.ts
│   │   ├── process/
│   │   │   └── route.ts
│   │   ├── contracts/
│   │   │   ├── route.ts                  # GET list
│   │   │   └── [id]/
│   │   │       └── route.ts              # GET single, DELETE
│   │   ├── key-terms/
│   │   │   └── [id]/
│   │   │       └── route.ts              # PATCH inline edit
│   │   ├── chat/
│   │   │   ├── route.ts                  # POST send message
│   │   │   └── [sessionId]/
│   │   │       └── route.ts              # GET history
│   │   ├── feedback/
│   │   │   └── route.ts                  # POST submit
│   │   └── storage/
│   │       └── signed-url/
│   │           └── [contractId]/
│   │               └── route.ts
│   ├── layout.tsx
│   └── page.tsx                          # landing page
│
├── components/
│   ├── ui/                               # primitive components (Button, Badge, Tooltip, Modal)
│   ├── auth/
│   │   └── AuthForm.tsx
│   ├── contract/
│   │   ├── ContractUpload.tsx            # upload screen orchestrator
│   │   ├── FileDropzone.tsx
│   │   ├── ContractTypeSelector.tsx
│   │   ├── TermsPreviewCard.tsx
│   │   ├── CustomTermInput.tsx
│   │   ├── KeyTermsPanel.tsx
│   │   ├── TermCard.tsx
│   │   ├── TermEditModal.tsx
│   │   ├── ConfidenceIndicator.tsx
│   │   └── SourceSentenceTooltip.tsx
│   ├── viewer/
│   │   ├── PDFViewer.tsx                 # PDF.js wrapper; accepts targetPage prop
│   │   └── TextViewer.tsx               # fallback; parses [PAGE N] markers
│   ├── chat/
│   │   ├── ChatInterface.tsx
│   │   └── ChatMessage.tsx
│   ├── dashboard/
│   │   ├── ContractList.tsx
│   │   ├── ContractRow.tsx
│   │   └── StatsRow.tsx
│   ├── feedback/
│   │   └── FeedbackModal.tsx
│   └── layout/
│       ├── Navbar.tsx
│       ├── LegalDisclaimer.tsx           # "Not legal advice" — always visible on results
│       └── ProcessingProgress.tsx        # 3-step progress stepper
│
├── lib/
│   ├── openai.ts                         # GPT-4o client; buildExtractionPrompt; buildChatPrompt; retry
│   ├── supabase.ts                       # server-side client (service role)
│   ├── supabase-browser.ts              # client-side client (anon key)
│   ├── pdf.ts                            # extractTextWithPageMarkers(); wraps pdf-parse
│   ├── validation.ts                     # validateUpload(); validateCustomTerms()
│   └── constants.ts                      # MAX_FILE_SIZE_MB, MAX_PAGES, MAX_TOKENS, etc.
│
├── prompts/
│   ├── extraction-nda.ts                 # NDA few-shot system prompt builder
│   ├── extraction-msa.ts                 # MSA few-shot system prompt builder
│   └── chat.ts                           # chat system prompt builder; query classifier
│
├── types/
│   └── index.ts                          # Contract, KeyTerm, ChatSession, ChatMessage, UserFeedback
│
├── hooks/
│   ├── useContractChat.ts               # chat state management
│   └── usePDFViewer.ts                  # page navigation state
│
├── middleware.ts                          # auth session check; protected route redirect
│
├── supabase/
│   └── database.sql                      # paste-and-run: all tables + indexes + RLS + storage bucket + storage RLS
│
├── .env.example                          # all required env vars grouped by service
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 12. Naming Conventions

### Files & Folders

| Artifact | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `KeyTermsPanel.tsx`, `ConfidenceIndicator.tsx` |
| API routes | lowercase `route.ts` in kebab-case folders | `app/api/key-terms/[id]/route.ts` |
| Lib modules | camelCase `.ts` | `lib/openai.ts`, `lib/validation.ts` |
| Hooks | camelCase `.ts` with `use` prefix | `hooks/useContractChat.ts` |
| Prompt builders | kebab-case `.ts` | `prompts/extraction-nda.ts` |
| SQL files | kebab-case `.sql` | `supabase/database.sql` |

### Code

| Artifact | Convention | Example |
|---|---|---|
| React components | PascalCase | `<KeyTermsPanel />`, `<TermCard />` |
| Custom hooks | camelCase with `use` prefix | `useContractChat`, `usePDFViewer` |
| TypeScript interfaces | PascalCase | `Contract`, `KeyTerm`, `ChatMessage`, `UserFeedback` |
| TypeScript types | PascalCase | `ContractType` (`'nda' \| 'msa'`), `ConfidenceLevel` |
| Functions | camelCase | `buildExtractionPrompt()`, `extractTextWithPageMarkers()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE_MB`, `MAX_PAGES`, `CONFIDENCE_THRESHOLD_LOW` |

### API Routes

| Pattern | Convention | Example |
|---|---|---|
| Resource collections | Plural noun | `/api/contracts`, `/api/key-terms` |
| Resource instances | Plural noun + `[id]` | `/api/contracts/[id]`, `/api/key-terms/[id]` |
| Nested resources | Parent → child | `/api/chat/[sessionId]` |
| Actions on resources | Verb in path only when not expressible via HTTP method | `/api/storage/signed-url/[contractId]` |

### Database

| Artifact | Convention | Example |
|---|---|---|
| Tables | snake_case, plural | `contracts`, `key_terms`, `chat_sessions`, `chat_messages`, `user_feedback` |
| Columns | snake_case | `contract_text`, `confidence_score`, `is_edited`, `ai_value` |
| Indexes | `{table}_{column}_idx` | `contracts_user_id_idx`, `key_terms_contract_id_idx` |
| RLS policies | Descriptive string | `"Users can read their own contracts"` |

### Environment Variables

| Category | Convention | Examples |
|---|---|---|
| Server-only | `SCREAMING_SNAKE_CASE` (no `NEXT_PUBLIC_` prefix) | `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Client-exposed | `NEXT_PUBLIC_` prefix | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

---

## 13. Testing Strategy

### Unit Tests — Vitest

**Target:** `lib/` modules and pure utility functions  
**Coverage target:** ≥ 80% line coverage on all `lib/` modules

| Test Suite | What It Covers |
|---|---|
| `lib/pdf.test.ts` | `extractTextWithPageMarkers()`: correct `[PAGE N]` marker insertion; accurate page count; < 100 word detection triggers SCANNED_PDF |
| `lib/validation.test.ts` | File size limit, page count limit, token count limit, custom terms array length limit |
| `lib/openai.test.ts` | `buildExtractionPrompt()` correctly injects contract type, term list, custom terms; `buildChatPrompt()` includes full contract text and history |
| `prompts/extraction-nda.test.ts` | System prompt includes all 10 NDA standard terms; few-shot examples present |
| `prompts/extraction-msa.test.ts` | System prompt includes all 12 MSA standard terms |
| `lib/constants.test.ts` | Confidence colour thresholds return correct values |

### Integration Tests — Vitest + Supabase Local Dev

**Target:** API routes and database interactions  
**Setup:** `supabase start` (local Docker); seed with test users and contracts

| Test Suite | What It Covers |
|---|---|
| `api/upload.test.ts` | Valid PDF → 200 + contract row created; scanned PDF → 422 SCANNED_PDF; >10MB → 413; >20 pages → 422 |
| `api/process.test.ts` | Valid contract_id → 200 + key_terms rows created in DB; >5 custom_terms → 422; wrong user_id → 403 |
| `api/chat.test.ts` | Message saved to chat_messages; response contains `[Page X]` citation; off-topic question returns "I cannot find" |
| `api/key-terms.test.ts` | PATCH saves new value, sets is_edited=true, preserves ai_value |
| RLS policies | Test user A cannot SELECT/UPDATE/DELETE user B's contracts, key_terms, chat_messages |
| `api/feedback.test.ts` | Feedback row created; duplicate submissions allowed (multiple feedback per contract) |

### E2E Tests — Playwright

**Target:** Critical user journeys on the full application  
**Environment:** Staging deployment with test Supabase project and OpenAI API

| Test | Flow Covered |
|---|---|
| `signup-and-dashboard.spec.ts` | Sign up → verify email → dashboard empty state |
| `upload-and-extract.spec.ts` | Upload NDA → process → all 10 standard terms appear with confidence badges |
| `low-confidence-warning.spec.ts` | Term with confidence < 50% shows ⚠️ tooltip; tooltip cannot be dismissed |
| `pdf-viewer-navigation.spec.ts` | Click page number on TermCard → PDF viewer scrolls to correct page |
| `text-viewer-fallback.spec.ts` | Simulate Storage unavailable (mock signed-url route to 404) → TextViewer renders |
| `chat-grounding.spec.ts` | Ask question not in document → response contains "I cannot find this in the document" |
| `chat-citation.spec.ts` | Ask question about document content → response contains `[Page X]` |
| `inline-edit.spec.ts` | Edit term value → "Edited" badge appears; PATCH saved within 2s |
| `dashboard-history.spec.ts` | Upload 3 contracts → all appear in dashboard list; sortable by date |
| `delete-contract.spec.ts` | Delete contract → removed from dashboard; 404 on direct URL |

### AI Regression Suite

**Purpose:** Automated eval on every deploy to catch prompt regressions  
**Dataset:** 30 manually labelled NDA contracts + 20 manually labelled MSA contracts  
**Execution:** CI pipeline step after build; fails deploy if thresholds not met

| Metric | Threshold | Action on Failure |
|---|---|---|
| F1 — NDA extraction | ≥ 88% | Block deploy; trigger prompt review |
| F1 — MSA extraction | ≥ 85% | Block deploy; trigger prompt review |
| Page attribution accuracy | ≥ 92% | Block deploy |
| Chat hallucination rate | ≤ 5% | Alert; manual review before deploy |
| Confidence calibration error | ≤ 0.10 | Alert; schedule prompt tuning |

### Hallucination Regression Test

A dedicated test in the regression suite:
1. Select 10 questions about topics not present in the test contracts
2. Send each via `/api/chat`
3. Assert each response contains "I cannot find this in the document"
4. Failure threshold: > 0 hallucinated responses blocks the deploy

---

## 14. Specs to Implementation Mapping

| User Story | Functional Req | Implementation Files | Key Logic |
|---|---|---|---|
| US-001 — Sign Up / Sign In | FR-01, FR-13 | `app/(auth)/signin/page.tsx`, `app/(auth)/signup/page.tsx`, `components/auth/AuthForm.tsx`, `middleware.ts`, `lib/supabase-browser.ts` | Supabase `signInWithPassword`, `signUp`; middleware checks session cookie |
| US-002 — PDF Upload + Extraction | FR-02, FR-03 | `app/api/upload/route.ts`, `lib/pdf.ts`, `lib/validation.ts`, `supabase/database.sql` | `extractTextWithPageMarkers()` → validate → INSERT contracts row; non-blocking Storage upload |
| US-003 — Page Number Attribution | FR-04, FR-07 | `app/api/process/route.ts`, `components/contract/TermCard.tsx`, `components/viewer/PDFViewer.tsx`, `components/viewer/TextViewer.tsx` | `page_number` returned in extraction JSON; TermCard click fires `setTargetPage`; PDFViewer/TextViewer respond to prop |
| US-004 — Confidence Score Display | FR-04, FR-11 | `components/contract/ConfidenceIndicator.tsx`, `prompts/extraction-nda.ts`, `prompts/extraction-msa.ts`, `lib/constants.ts` | Model self-reports `confidence_score`; ConfidenceIndicator applies colour thresholds from constants |
| US-005 — Custom Key Terms | FR-05 | `app/(protected)/upload/page.tsx`, `components/contract/CustomTermInput.tsx`, `app/api/process/route.ts`, `supabase/database.sql` | Custom terms appended to extraction prompt; `is_manual=true` in key_terms insert |
| US-006 — Inline PDF Viewer | FR-06 | `components/viewer/PDFViewer.tsx`, `components/viewer/TextViewer.tsx`, `app/api/storage/signed-url/[contractId]/route.ts` | PDF.js renders from signed URL; fallback to TextViewer if URL unavailable; both accept `targetPage` prop |
| US-007 — Chat with Contract | FR-08 | `app/api/chat/route.ts`, `prompts/chat.ts`, `components/chat/ChatInterface.tsx`, `components/chat/ChatMessage.tsx` | Full contract_text + message history sent to GPT-4o; document-only system prompt; `[Page X]` citation enforced |
| US-008 — Dashboard History | FR-10 | `app/(protected)/dashboard/page.tsx`, `app/api/contracts/route.ts`, `components/dashboard/ContractList.tsx`, `components/dashboard/StatsRow.tsx` | `SELECT * FROM contracts WHERE user_id = auth.uid() ORDER BY created_at DESC` |
| US-009 — Inline Term Editing | (FR-09 adjacent) | `app/api/key-terms/[id]/route.ts`, `components/contract/TermCard.tsx`, `components/contract/TermEditModal.tsx` | PATCH sets `value`, `is_edited=true`; `ai_value` column never updated; "Edited" badge shown when `is_edited=true` |
| US-010 — Feedback Submission | FR-12 | `app/api/feedback/route.ts`, `components/feedback/FeedbackModal.tsx` | INSERT into user_feedback; confirmation toast on success |
| US-012 — Persistent Chat History | FR-09 | `app/api/chat/[sessionId]/route.ts`, `components/chat/ChatInterface.tsx`, `supabase/database.sql` | On page load, GET `/api/chat/:sessionId` fetches all messages ascending; renders in ChatInterface |
| FR-13 — RLS on all tables | FR-13 | `supabase/database.sql` | All tables: `CREATE POLICY … USING (auth.uid() = user_id)` |
| FR-14 — Single paste-and-run SQL | FR-14 | `supabase/database.sql` | Includes: CREATE TABLE, indexes, RLS ENABLE + policies, `INSERT INTO storage.buckets`, `CREATE POLICY ON storage.objects` |
| FR-06 — TextViewer fallback | FR-06 | `components/viewer/TextViewer.tsx` | Parses `[PAGE N]` markers from `contract_text`; renders each page as a labelled section; responds to `targetPage` prop identical to PDFViewer |

---

*This document is the authoritative engineering reference for ContractIQ MVP. No implementation begins until this document is reviewed and approved. Questions or change requests should be directed to the Product and Engineering leads before Stage 2 (Implementation Specs) commences.*
