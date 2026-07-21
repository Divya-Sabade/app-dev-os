# Spec 07 — Feedback Submission

## Overview

After reviewing a contract's key terms, users can submit a thumbs-up or thumbs-down rating with an optional text comment. This data feeds the AI improvement loop — correction rates are monitored to trigger prompt reviews. Feedback is stored in `user_feedback` table.

---

## User Flow

1. User has completed reviewing key terms on `/contracts/[id]`
2. A "Rate this review" prompt is visible at the bottom of the Key Terms Panel (always, regardless of whether the user edited terms)
3. User clicks 👍 or 👎
4. `FeedbackModal` opens with:
   - Rating pre-selected (thumbs icon highlighted)
   - Optional text area: "Tell us more (optional)"
   - "Submit" button + "Skip" link
5. User clicks Submit → POST `/api/feedback`
6. Modal closes → success toast: "Thanks for your feedback!"
7. "Rate this review" prompt replaced with "Feedback submitted ✓"

If user clicks "Skip" → modal closes, no feedback stored.

---

## Component Spec

**File:** `components/feedback/FeedbackModal.tsx`

Props:
```typescript
interface FeedbackModalProps {
  contractId: string
  isOpen: boolean
  initialRating: 'up' | 'down' | null
  onClose: () => void
  onSubmit: (rating: 'up' | 'down', comment: string) => Promise<void>
}
```

State:
- `rating: 'up' | 'down' | null` — pre-set from `initialRating` when opened from thumbs click
- `comment: string`
- `loading: boolean`
- `error: string | null`

Layout:
```
┌────────────────────────────────────────┐
│  How accurate was the AI extraction?   │
│                                        │
│  👍  Accurate    👎  Needs improvement │
│                                        │
│  Tell us more (optional):              │
│  ┌──────────────────────────────────┐  │
│  │ [textarea, max 500 chars]        │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [Submit]              [Skip]          │
└────────────────────────────────────────┘
```

- Thumbs buttons toggle the `rating` state; selected thumb is highlighted
- Character count shown below textarea: "0/500"
- Submit disabled until `rating` is selected
- On Submit: call `onSubmit(rating, comment)` → handle loading + error states

**Trigger UI (in KeyTermsPanel footer):**

```typescript
// Below the key terms list in KeyTermsPanel.tsx
{!feedbackSubmitted ? (
  <div>
    <span>Rate this review:</span>
    <button onClick={() => openModal('up')}>👍</button>
    <button onClick={() => openModal('down')}>👎</button>
  </div>
) : (
  <span>Feedback submitted ✓</span>
)}
```

---

## API Route: POST `/api/feedback`

**File:** `app/api/feedback/route.ts`

### Request
```json
{
  "contract_id": "uuid",
  "rating": "up",
  "comment": "Very accurate extraction of the governing law clause"
}
```

### Validation
- `contract_id`: required, valid uuid, owned by authenticated user
- `rating`: required, must be `"up"` or `"down"`
- `comment`: optional, max 500 characters

### Processing Steps

1. Auth check → 401
2. Ownership check: `SELECT user_id FROM contracts WHERE id = :contract_id` → 403/404
3. Validate `rating` value → 422 on invalid
4. Validate `comment` length ≤ 500 chars → 422 on failure
5. `INSERT INTO user_feedback { contract_id, user_id, rating, comment, created_at }`
6. Response: `{ id: "uuid" }`

Multiple feedback submissions per contract are allowed (no unique constraint on `contract_id` + `user_id`). The most recent submission is used for analytics.

### Response 201
```json
{ "id": "uuid" }
```

### Error Responses

| Code | HTTP | Notes |
|---|---|---|
| 401 | `UNAUTHORIZED` | No session |
| 403 | `FORBIDDEN` | contract_id belongs to another user |
| 404 | `NOT_FOUND` | contract_id does not exist |
| 422 | `INVALID_RATING` | rating not 'up' or 'down' |
| 422 | `COMMENT_TOO_LONG` | comment > 500 chars |

---

## Data Usage

The `user_feedback` table is used for:
- Computing the **AI correction rate** metric (tracked alongside `key_terms.is_edited`)
- Weekly prompt improvement reviews (if correction rate > 12% in any 7-day window)
- Monthly legal SME quality audit (5 random contracts sampled from production)

---

## Acceptance Criteria

- [ ] Feedback prompt visible in Key Terms Panel on all contract results pages
- [ ] Clicking 👍 or 👎 opens FeedbackModal with rating pre-selected
- [ ] Submit requires a rating selected (text comment is optional)
- [ ] Feedback stored in `user_feedback` within 2 seconds of submit
- [ ] Success toast shown after submission; prompt replaced with "Feedback submitted ✓"
- [ ] Skip closes modal without storing any data
- [ ] Comment capped at 500 characters (enforced client-side and server-side)
- [ ] Multiple submissions for the same contract are accepted
