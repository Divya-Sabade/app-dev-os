# Spec 02 — PDF Upload & Text Extraction

## Overview

User uploads a PDF contract. The server extracts text using `pdf-parse`, stores it in `contracts.contract_text` with `[PAGE N]` markers, creates the contract DB row, and non-blockingly uploads the PDF file to Supabase Storage. The AI pipeline and chat both read from `contract_text` in the DB — they never re-download the file.

---

## Upload Screen — User Flow

1. User navigates to `/upload` (protected route)
2. Selects contract type: NDA or MSA (dropdown, required before upload)
3. Drags and drops or file-picks a PDF
4. Client-side validation runs immediately (before submit):
   - File type = `application/pdf`
   - File size ≤ 10 MB
5. On validation pass → POST `/api/upload` (multipart)
6. Progress stepper appears:
   - Step 1: "Uploading..." → Step 2: "Extracting text..." → Step 3: "Ready to process"
7. On success → navigate to `/upload?step=preview&contract_id=<id>`
8. Pre-processing preview screen renders (see Spec 03)

---

## Component Spec

**File:** `app/(protected)/upload/page.tsx`

Orchestrates the full upload + preview flow. Manages `step` state: `'upload' | 'preview' | 'processing'`.

**File:** `components/contract/ContractTypeSelector.tsx`

Props:
```typescript
interface ContractTypeSelectorProps {
  value: 'nda' | 'msa' | null
  onChange: (type: 'nda' | 'msa') => void
}
```

Renders a styled dropdown. Required — Process button disabled until type is selected.

**File:** `components/contract/FileDropzone.tsx`

Props:
```typescript
interface FileDropzoneProps {
  onFileSelect: (file: File) => void
  error: string | null
}
```

- Accepts drag-and-drop and click-to-browse
- Validates MIME type (`application/pdf`) and size (≤ 10 MB) on `onChange`
- Shows error inline if validation fails
- Shows selected filename + size on success

---

## API Route: POST `/api/upload`

**File:** `app/api/upload/route.ts`

### Request
`Content-Type: multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File (PDF binary) | Yes | |
| `contract_type` | `"nda"` \| `"msa"` | Yes | |
| `contract_name` | string | Yes | Original filename, max 255 chars |

### Processing Steps (in order)

1. **Auth check** — `getUser(request)` → 401 if not authenticated
2. **File validation** — check MIME type, size ≤ 10 MB → 413/415 on failure
3. **Read file buffer** — `await file.arrayBuffer()` → `Buffer.from(...)`
4. **Extract text** — `extractTextWithPageMarkers(buffer)` → `{ text, pageCount }`
5. **Validate page count** — `pageCount > 20` → 422 `PAGE_LIMIT_EXCEEDED`
6. **Validate extracted text** — `text.split(' ').length < 100` → 422 `SCANNED_PDF`
7. **Estimate token count** — `Math.ceil(text.length / 4)` → if > 15,000 → 422 `TOKEN_LIMIT_EXCEEDED`
8. **Insert contract row** — `status: 'pending'`, `contract_text: text`, `file_path: null`
9. **Non-blocking Storage upload** — run in background (no `await` in main path):
   - Path: `contracts/{user_id}/{contract_id}/{sanitised_filename}.pdf`
   - On success: `UPDATE contracts SET file_path = <path> WHERE id = <contract_id>`
   - On failure: leave `file_path = null`; log error server-side; do NOT surface to user
10. **Return** `{ contract_id, page_count, standard_terms_preview }`

### Response 200
```json
{
  "contract_id": "uuid",
  "page_count": 12,
  "token_count": 9840,
  "standard_terms_preview": [
    "Parties", "Effective Date", "Confidentiality Obligations",
    "Permitted Disclosures", "Term & Duration", "Governing Law",
    "Jurisdiction", "IP Ownership", "Non-Solicitation", "Breach & Remedy"
  ]
}
```

`standard_terms_preview` is determined server-side from `contract_type`:
- `nda` → the 10 NDA standard terms
- `msa` → the 12 MSA standard terms

### Error Responses

| Code | HTTP | `code` field | Message |
|---|---|---|---|
| Not authenticated | 401 | `UNAUTHORIZED` | "Authentication required" |
| Not a PDF | 415 | `INVALID_FILE_TYPE` | "Only PDF files are accepted" |
| File > 10 MB | 413 | `FILE_TOO_LARGE` | "File must be under 10 MB" |
| > 20 pages | 422 | `PAGE_LIMIT_EXCEEDED` | "Contracts over 20 pages are not supported yet" |
| < 100 words extracted | 422 | `SCANNED_PDF` | "Scanned PDFs are not supported yet. Please upload a text-layer PDF." |
| > 15,000 tokens | 422 | `TOKEN_LIMIT_EXCEEDED` | "Contract text exceeds the processing limit. Please upload a shorter contract." |
| DB insert fails | 500 | `DB_ERROR` | "Something went wrong. Please try again." |

---

## Text Extraction Utility

**File:** `lib/pdf.ts`

```typescript
import pdf from 'pdf-parse'

export interface ExtractedText {
  text: string      // full text with [PAGE N] markers
  pageCount: number
}

export async function extractTextWithPageMarkers(
  buffer: Buffer
): Promise<ExtractedText> {
  // pdf-parse options: render_page callback that prefixes each page with [PAGE N]\n
  // Returns { text, pageCount }
}
```

**[PAGE N] marker format:**
```
[PAGE 1]
Full text of page 1...

[PAGE 2]
Full text of page 2...
```

The marker `[PAGE N]` is always on its own line directly before the page content. This format is used by:
- The extraction prompt (model reads page numbers from markers)
- The TextViewer fallback (splits on `[PAGE N]` to render paginated sections)
- The chat route (model cites `[Page X]` based on these markers)

---

## Validation Utility

**File:** `lib/validation.ts`

```typescript
export interface ValidationResult {
  valid: boolean
  errorCode?: string
  message?: string
}

export function validateUpload(file: {
  type: string
  size: number
}): ValidationResult

export function validateExtractedText(text: string, pageCount: number): ValidationResult

export function validateCustomTerms(terms: string[]): ValidationResult
```

---

## Constants

**File:** `lib/constants.ts`

```typescript
export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_PAGES = 20
export const MAX_TOKENS = 15_000
export const MIN_WORDS_FOR_TEXT_LAYER = 100
export const MAX_CUSTOM_TERMS = 5
export const CONFIDENCE_LOW_THRESHOLD = 0.5
export const CONFIDENCE_HIGH_THRESHOLD = 0.8
export const SIGNED_URL_EXPIRY_SECONDS = 3600

export const NDA_STANDARD_TERMS = [
  'Parties',
  'Effective Date',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Term & Duration',
  'Governing Law',
  'Jurisdiction',
  'IP Ownership',
  'Non-Solicitation',
  'Breach & Remedy',
]

export const MSA_STANDARD_TERMS = [
  'Parties',
  'Service Scope',
  'Payment Terms',
  'Invoice Schedule',
  'Late Payment Penalty',
  'Liability Cap',
  'Indemnification',
  'IP Ownership',
  'Termination Clause',
  'Governing Law',
  'Dispute Resolution',
  'Notice Period',
]
```

---

## Storage Upload (Non-Blocking)

- Bucket: `contracts` (private, created via SQL)
- Path: `contracts/{user_id}/{contract_id}/{sanitised_filename}.pdf`
  - `sanitised_filename`: strip non-alphanumeric except `.`, `-`, `_`; max 100 chars
- Signed URL expiry: 3600 seconds (generated on demand via `/api/storage/signed-url/:contractId`)
- Failure behaviour: `file_path` stays `null`; no error shown to user; only PDF.js viewer is affected; TextViewer fallback renders from DB

---

## Progress Stepper Component

**File:** `components/layout/ProcessingProgress.tsx`

```typescript
interface ProcessingProgressProps {
  currentStep: 1 | 2 | 3
  steps: string[]  // e.g. ['Uploading...', 'Extracting text...', 'Ready to process']
}
```

Renders a 3-step linear progress indicator. Step completes visually when API response arrives.

---

## Acceptance Criteria

- [ ] Rejects non-PDF files with `INVALID_FILE_TYPE` (client-side + server-side)
- [ ] Rejects files > 10 MB with `FILE_TOO_LARGE` (client-side + server-side)
- [ ] Rejects contracts > 20 pages with `PAGE_LIMIT_EXCEEDED`
- [ ] Rejects scanned PDFs (< 100 words extracted) with `SCANNED_PDF`
- [ ] Rejects contracts > 15,000 tokens with `TOKEN_LIMIT_EXCEEDED`
- [ ] `contract_text` stored in DB with correct `[PAGE N]` markers on every page boundary
- [ ] `page_count` in DB matches actual PDF page count
- [ ] Storage upload failure does NOT block the upload response or show an error to the user
- [ ] `contract_id` returned in response and usable immediately for `/api/process`
- [ ] Upload + extraction completes in ≤ 30 seconds P95 for contracts ≤ 20 pages
