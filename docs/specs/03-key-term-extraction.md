# Spec 03 — Key Term Extraction (AI)

## Overview

After a PDF is uploaded and text is extracted, the user triggers GPT-4o to extract structured key terms from the contract. Terms are extracted via few-shot prompting with JSON mode, one inference call per contract. Custom terms are appended to the standard term list before the call. Results are stored in the `key_terms` table.

---

## Pre-Processing Preview Screen

**File:** `app/(protected)/upload/page.tsx` (step: `'preview'`)  
**File:** `components/contract/TermsPreviewCard.tsx`

Rendered after upload succeeds, before the user triggers processing.

Shows:
- Card titled "We will extract these key terms:" 
- List of standard terms for the selected contract type (from `standard_terms_preview` in upload response)
- Each custom term the user adds (with "Custom" badge)
- "+ Add Key Term" button (up to 5 custom terms total)

**File:** `components/contract/CustomTermInput.tsx`

Props:
```typescript
interface CustomTermInputProps {
  terms: string[]
  onAdd: (term: string) => void
  onRemove: (index: number) => void
  maxTerms: number  // 5
}
```

- Text input + "Add" button
- Validation: term name is non-empty, ≤ 60 characters, not a duplicate of existing standard or custom terms
- Added terms shown as pills with a remove (×) button
- "+ Add Key Term" button hidden once `terms.length >= 5`

---

## API Route: POST `/api/process`

**File:** `app/api/process/route.ts`

### Request
```json
{
  "contract_id": "uuid",
  "custom_terms": ["Non-compete radius", "Auto-renewal clause"]
}
```

`custom_terms` is optional; defaults to `[]`.

### Processing Steps

1. **Auth check** — `getUser(request)` → 401 if not authenticated
2. **Ownership check** — `SELECT user_id FROM contracts WHERE id = :contract_id` → 403 if `user_id ≠ auth.uid()`; 404 if not found
3. **Rate limit check** — 5 extractions per user per hour → 429 if exceeded
4. **Validate custom_terms** — length ≤ 5, each ≤ 60 chars → 422 on failure
5. **Read contract_text** — `SELECT contract_text, contract_type FROM contracts WHERE id = :contract_id`
6. **Update status** — `UPDATE contracts SET status = 'processing' WHERE id = :contract_id`
7. **Build prompt** — `buildExtractionPrompt(contract_type, contract_text, custom_terms)`
8. **Call GPT-4o** — with JSON mode, temperature 0.1, max_tokens 2000
9. **Parse response** — `JSON.parse(response.choices[0].message.content)`
   - On parse failure: send single retry prompt → attempt parse again
   - On second failure: `UPDATE contracts SET status = 'error'`; return 502
10. **Validate schema** — each term must have: `term_name`, `value`, `page_number` (int ≥ 1), `confidence_score` (float 0–1), `source_sentence`
11. **Insert key_terms** — batch insert; `is_manual = true` for custom terms; `ai_value = value` (immutable copy)
12. **Update status** — `UPDATE contracts SET status = 'complete'`
13. **Return** `{ key_terms[] }`

### Response 200
```json
{
  "key_terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "California, USA",
      "ai_value": "California, USA",
      "page_number": 8,
      "confidence_score": 0.94,
      "source_sentence": "This Agreement shall be governed by and construed in accordance with the laws of the State of California.",
      "is_manual": false,
      "is_edited": false,
      "sort_order": 6
    }
  ]
}
```

### Error Responses

| Code | HTTP | Notes |
|---|---|---|
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | contract_id belongs to another user |
| 404 | `NOT_FOUND` | contract_id does not exist |
| 422 | `INVALID_CUSTOM_TERMS` | > 5 terms or term > 60 chars |
| 429 | `RATE_LIMIT` | > 5 extractions/hr for this user |
| 502 | `AI_ERROR` | OpenAI failure after retries; includes `retry: true` |

---

## OpenAI Client

**File:** `lib/openai.ts`

```typescript
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function callExtractionModel(
  prompt: { system: string; user: string }
): Promise<string>
// Wraps openai.chat.completions.create with:
//   model: 'gpt-4o'
//   response_format: { type: 'json_object' }
//   temperature: 0.1
//   max_tokens: 2000
// Retries 3× with exponential backoff (1s, 2s, 4s) on 429 / 5xx
// Returns response.choices[0].message.content (string)
```

---

## Extraction Prompt

**File:** `prompts/extraction-nda.ts`  
**File:** `prompts/extraction-msa.ts`

Each file exports a `buildExtractionPrompt(contractText: string, customTerms: string[]): { system: string; user: string }` function.

### System Prompt Structure

```
You are a contract analysis assistant. Extract the following key terms from the contract text below.

For each term, return a JSON object with EXACTLY these fields:
  - "term_name": string — the exact term name as listed below
  - "value": string — the extracted value, or "Not found" if absent
  - "page_number": integer — the 1-indexed page number where the term appears (use [PAGE N] markers in the text)
  - "confidence_score": float between 0.0 and 1.0 — your confidence in this extraction
  - "source_sentence": string — the verbatim sentence from the contract that supports this extraction; empty string if "Not found"

Return a JSON object with a single key "terms" containing an array of these objects.

Standard terms to extract:
[LIST OF STANDARD TERMS FOR CONTRACT TYPE]

[IF custom_terms.length > 0:]
Additional custom terms to extract:
[LIST OF CUSTOM TERMS]

---

EXAMPLES:

[3 labelled few-shot examples for the contract type — see below]

---

CONTRACT TEXT:
{contractText}
```

### Few-Shot Example Format (per example)

```
CONTRACT EXCERPT:
[PAGE 3]
This Agreement shall be governed by the laws of England and Wales.
Neither party shall solicit or hire the other party's employees for a period of 12 months following termination.

EXTRACTED TERMS:
{
  "terms": [
    {
      "term_name": "Governing Law",
      "value": "England and Wales",
      "page_number": 3,
      "confidence_score": 0.97,
      "source_sentence": "This Agreement shall be governed by the laws of England and Wales."
    },
    {
      "term_name": "Non-Solicitation",
      "value": "12 months post-termination",
      "page_number": 3,
      "confidence_score": 0.91,
      "source_sentence": "Neither party shall solicit or hire the other party's employees for a period of 12 months following termination."
    }
  ]
}
```

Three such examples are included per contract type (NDA: 3 NDA examples; MSA: 3 MSA examples).

### JSON Parse Retry Prompt

If `JSON.parse()` fails on the first response, send this as a new user message:

```
Your previous response was not valid JSON. Return only the JSON object with a "terms" array, no explanation, no markdown.
```

---

## Key Term Schema Validation

After JSON parse succeeds, validate each term object:

```typescript
function validateTermSchema(term: unknown): term is RawKeyTerm {
  return (
    typeof term === 'object' &&
    typeof (term as any).term_name === 'string' &&
    typeof (term as any).value === 'string' &&
    typeof (term as any).page_number === 'number' &&
    Number.isInteger((term as any).page_number) &&
    (term as any).page_number >= 1 &&
    typeof (term as any).confidence_score === 'number' &&
    (term as any).confidence_score >= 0 &&
    (term as any).confidence_score <= 1 &&
    typeof (term as any).source_sentence === 'string'
  )
}
```

Any term failing schema validation is dropped from the results (not inserted into DB). The remaining valid terms are still returned.

---

## DB Insert: `key_terms`

Batch insert (single query) after extraction succeeds:

```typescript
const rows = parsedTerms.map((term, index) => ({
  contract_id: contractId,
  user_id: userId,
  term_name: term.term_name,
  value: term.value,
  ai_value: term.value,          // immutable copy; never updated by user edits
  page_number: term.page_number,
  confidence_score: term.confidence_score,
  source_sentence: term.source_sentence,
  is_manual: customTermNames.includes(term.term_name),
  is_edited: false,
  sort_order: index,
}))

await supabase.from('key_terms').insert(rows)
```

---

## Confidence Score Handling

| Score | Label | Display colour (Tailwind) | Badge text |
|---|---|---|---|
| 0.8 – 1.0 | High | `bg-green-100 text-green-800` | "94%" |
| 0.5 – 0.79 | Medium | `bg-yellow-100 text-yellow-800` | "67%" |
| 0.0 – 0.49 | Low | `bg-red-100 text-red-800` | "⚠️ 31%" |

Low confidence (< 0.5):
- ⚠️ icon displayed before the percentage
- Non-dismissible tooltip rendered below the term value: *"Low confidence — we recommend verifying this in the document directly."*
- Term is never hidden

---

## NDA Standard Terms (10)

| Term Name | What to Extract |
|---|---|
| Parties | Full legal names of disclosing and receiving parties |
| Effective Date | Date the agreement takes effect |
| Confidentiality Obligations | Core obligations of the receiving party regarding confidential information |
| Permitted Disclosures | Exceptions — when confidential info may be shared |
| Term & Duration | How long the NDA remains in force |
| Governing Law | Jurisdiction whose law governs the agreement |
| Jurisdiction | Court or venue with exclusive jurisdiction |
| IP Ownership | Who owns any IP created during the engagement |
| Non-Solicitation | Restrictions on soliciting the other party's employees/clients |
| Breach & Remedy | Consequences and available remedies for breach |

## MSA Standard Terms (12)

| Term Name | What to Extract |
|---|---|
| Parties | Full legal names of service provider and client |
| Service Scope | Description of services to be provided |
| Payment Terms | Amount, currency, and payment conditions |
| Invoice Schedule | When invoices are issued (monthly, milestone, etc.) |
| Late Payment Penalty | Interest rate or fee for late payment |
| Liability Cap | Maximum liability of either party |
| Indemnification | Who indemnifies whom and under what conditions |
| IP Ownership | Who owns deliverables and IP created under the agreement |
| Termination Clause | Conditions under which either party can terminate |
| Governing Law | Jurisdiction whose law governs |
| Dispute Resolution | Process for resolving disputes (arbitration, mediation, court) |
| Notice Period | Required notice period for termination |

---

## Acceptance Criteria

- [ ] All standard NDA terms (10) extracted per contract
- [ ] All standard MSA terms (12) extracted per contract
- [ ] Custom terms (up to 5) extracted with same JSON schema as standard terms
- [ ] Every extracted term has `confidence_score`, `page_number`, `source_sentence`
- [ ] Terms with `confidence_score < 0.5` display ⚠️ warning; term value is still shown
- [ ] `ai_value` column is never updated after initial insert
- [ ] JSON parse failure triggers exactly one retry before returning error
- [ ] `contracts.status` transitions: `pending` → `processing` → `complete` (or `error`)
- [ ] API returns 403 if `contract_id` belongs to another user
- [ ] Rate limit: 5 extractions per user per hour; returns 429 if exceeded
- [ ] Extraction completes within 20 seconds P95 (OpenAI call only)
