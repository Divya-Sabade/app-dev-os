# Spec 04 — Results Page

## Overview

The results page (`/contracts/[id]`) displays the extracted key terms alongside the contract PDF. It is a two-panel layout: left panel is the PDF viewer (PDF.js) or TextViewer fallback; right panel is the key terms panel. Clicking a term's page number scrolls the viewer to that page. Terms can be edited inline. A floating "Chat" button opens the chat interface (see Spec 05). A legal disclaimer is always visible.

---

## Page Route

**File:** `app/(protected)/contracts/[id]/page.tsx`

On load:
1. Auth check (middleware handles redirect if unauthenticated)
2. GET `/api/contracts/:id` → `{ contract, key_terms[], chat_session_id }`
3. GET `/api/storage/signed-url/:contractId` → `{ signed_url }` (or 404 if `file_path = null`)
4. Render `<ResultsLayout>` with contract data

State managed at this page level:
- `targetPage: number` — shared between KeyTermsPanel and viewer; updated by TermCard clicks
- `pdfAvailable: boolean` — false if signed-url returns 404
- `editingTermId: string | null`

---

## ResultsLayout Component

**File:** `components/contract/ResultsLayout.tsx` (or inline in page.tsx)

```
┌──────────────────────────────────────────────────────────────────┐
│ Navbar (contract name | contract type badge | status)            │
├──────────────────────┬───────────────────────────────────────────┤
│                      │                                           │
│   PDF Viewer         │   Key Terms Panel                         │
│   (PDF.js)           │   (scrollable list of TermCards)          │
│   OR                 │                                           │
│   TextViewer         │                                           │
│   (fallback)         │                                           │
│                      │                                           │
├──────────────────────┴───────────────────────────────────────────┤
│ LegalDisclaimer: "This is an AI-assisted review tool..."         │
└──────────────────────────────────────────────────────────────────┘
                                          [Chat with Contract] ← floating button
```

Desktop: 50/50 split (or 55/45 viewer/panel). Mobile: stacked — viewer first, panel below.

---

## PDF Viewer

**File:** `components/viewer/PDFViewer.tsx`

Props:
```typescript
interface PDFViewerProps {
  signedUrl: string
  targetPage: number       // 1-indexed; viewer scrolls to this page when prop changes
  onPageChange?: (page: number) => void
}
```

Implementation:
- Uses `react-pdf` (PDF.js wrapper) or direct PDF.js integration
- Lazy-loads pages (render visible pages only) to handle large files
- Zoom controls (in/out/reset) in viewer toolbar
- Page number indicator (current / total)
- When `targetPage` prop changes: scroll smoothly to that page; apply brief yellow highlight on the page
- Shows "Download PDF" fallback link if a page fails to render (rare font/layout issues)

Dependencies: `pdfjs-dist`, configure `workerSrc` to CDN or local worker file in `next.config.ts`.

---

## TextViewer (Fallback)

**File:** `components/viewer/TextViewer.tsx`

Rendered when `pdfAvailable = false` (signed URL unavailable because `file_path = null` in DB).

Props:
```typescript
interface TextViewerProps {
  contractText: string    // full [PAGE N]-marked text from DB
  targetPage: number
}
```

Implementation:
- Parse `contractText` by splitting on `/\[PAGE (\d+)\]/` regex
- Render each page as a labelled section:
  ```
  ─── Page 1 ─────────────────────
  [page text content]
  ```
- When `targetPage` changes: `scrollIntoView({ behavior: 'smooth' })` on the matching section's DOM ref
- Applies yellow background highlight to the target section for 2 seconds
- Functionally equivalent to PDFViewer for page navigation — TermCard page clicks work identically

---

## Key Terms Panel

**File:** `components/contract/KeyTermsPanel.tsx`

Props:
```typescript
interface KeyTermsPanelProps {
  keyTerms: KeyTerm[]
  onPageNavigate: (page: number) => void
  onTermEdit: (id: string, newValue: string) => void
}
```

Renders a scrollable list of `TermCard` components. Grouped into two sections:
1. Standard terms (sorted by `sort_order`)
2. Custom terms (those with `is_manual = true`), rendered at the bottom with a "Custom Terms" section divider

---

## TermCard Component

**File:** `components/contract/TermCard.tsx`

Props:
```typescript
interface TermCardProps {
  term: KeyTerm
  onPageNavigate: (page: number) => void
  onEdit: (id: string, newValue: string) => void
}
```

Layout per card:
```
┌─────────────────────────────────────────────────┐
│ Term Name            [Edited badge if is_edited] │
│ Extracted Value                                  │
│ Page 8 (clickable link) | [Confidence badge]     │
│ [▼ Why? — expandable source sentence]            │
│ [⚠️ Non-dismissible warning if confidence < 0.5] │
│ [Edit button — pencil icon]                      │
└─────────────────────────────────────────────────┘
```

Behaviour:
- **Page number click** → calls `onPageNavigate(term.page_number)` → viewer scrolls
- **"Why?" expand** → reveals `term.source_sentence` in a monospace callout block
- **Edit button click** → opens `TermEditModal` with current `term.value` pre-filled
- **"Edited" badge** → shown when `term.is_edited = true`; replaces confidence badge position
- **Low-confidence warning** → shown when `confidence_score < 0.5`; cannot be dismissed; sits below value

---

## Confidence Indicator

**File:** `components/contract/ConfidenceIndicator.tsx`

Props:
```typescript
interface ConfidenceIndicatorProps {
  score: number   // 0.0 – 1.0
}
```

Renders a small pill badge:
- `score >= 0.8`: `bg-green-100 text-green-800` — "94%"
- `0.5 <= score < 0.8`: `bg-yellow-100 text-yellow-800` — "67%"
- `score < 0.5`: `bg-red-100 text-red-800` — "⚠️ 31%"

When `score < 0.5`, also renders the non-dismissible warning below the TermCard value:
```
⚠️ Low confidence — we recommend verifying this in the document directly.
```
This warning is a `<p>` tag, not a dismissible tooltip. It is always visible when applicable.

---

## Source Sentence Tooltip

**File:** `components/contract/SourceSentenceTooltip.tsx`

An accordion-style expandable section within each TermCard. Shows/hides on click.

When expanded:
- Renders `term.source_sentence` inside a grey monospace block with a left border
- Label above: "Source text from document:"

If `source_sentence` is empty string (term value is "Not found"): the "Why?" section is hidden.

---

## Inline Term Editing

**File:** `components/contract/TermEditModal.tsx`

A modal dialog (not inline — opens over the results page).

Props:
```typescript
interface TermEditModalProps {
  term: KeyTerm
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, newValue: string) => void
}
```

Fields:
- Term name (read-only, greyed out)
- AI extracted value (read-only, greyed out, labelled "Original AI value")
- Editable text area for the corrected value (pre-filled with current `term.value`)
- "Save" button + "Cancel" button

On Save:
1. Optimistic update: update TermCard value locally + show "Edited" badge immediately
2. PATCH `/api/key-terms/:id` `{ value: newValue }`
3. On API error: revert optimistic update; show error toast

**API Route: PATCH `/api/key-terms/:id`**

**File:** `app/api/key-terms/[id]/route.ts`

1. Auth check + ownership check (join to contracts table)
2. `UPDATE key_terms SET value = :value, is_edited = true WHERE id = :id`
3. `ai_value` column is never touched
4. Response: `{ id, value, is_edited: true, ai_value }`

Performance target: ≤ 2 seconds round-trip.

---

## Signed URL API

**File:** `app/api/storage/signed-url/[contractId]/route.ts`

1. Auth check + ownership check
2. `SELECT file_path FROM contracts WHERE id = :contractId`
3. If `file_path = null` → 404 `{ error: "PDF file not available", code: "NO_FILE_PATH" }`
4. `supabase.storage.from('contracts').createSignedUrl(file_path, 3600)`
5. Response: `{ signed_url: "https://..." }`

Client behaviour on 404: `pdfAvailable = false` → render TextViewer.

---

## Legal Disclaimer

**File:** `components/layout/LegalDisclaimer.tsx`

Always rendered at the bottom of `/contracts/[id]`. Not dismissible.

Text:
> "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer."

Additional footer:
> "Powered by OpenAI GPT-4o"

---

## UX States

| State | What renders |
|---|---|
| Loading (initial page load) | Skeleton cards in key terms panel; grey placeholder in viewer area |
| PDF available | PDF.js viewer renders with signed URL |
| PDF unavailable (no file_path) | TextViewer renders from `contract_text`; no error shown to user |
| Term with `is_edited = true` | "Edited" badge shown; original AI value visible in TermEditModal |
| Term with `confidence_score < 0.5` | ⚠️ badge + non-dismissible warning paragraph |
| Term value = "Not found" | Value cell shows "Not found" in grey italic; "Why?" section hidden |
| Edit modal open | Modal overlays results; background dimmed |

---

## Acceptance Criteria

- [ ] All key terms render in panel with name, value, page number, confidence badge
- [ ] Terms with `confidence_score < 0.5` show ⚠️ badge and non-dismissible warning paragraph
- [ ] Clicking page number in any TermCard scrolls the viewer to the correct page
- [ ] "Why?" expand shows `source_sentence` verbatim
- [ ] TextViewer renders and page-navigates correctly when `file_path = null`
- [ ] Inline edit: new value saved to DB within 2 seconds; "Edited" badge appears; `ai_value` unchanged
- [ ] Legal disclaimer visible on every load of `/contracts/[id]`
- [ ] Mobile: panels stack vertically (viewer first, terms panel below)
- [ ] WCAG 2.1 AA: all interactive elements reachable by keyboard; ⚠️ warnings have sufficient contrast
