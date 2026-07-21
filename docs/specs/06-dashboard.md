# Spec 06 — Dashboard & Contract History

## Overview

The dashboard is the home screen for authenticated users. It shows high-level stats (total contracts, NDA/MSA breakdown) and a sortable list of all contracts the user has reviewed. Each row links to the results page for that contract. An empty state is shown on first login.

---

## Route

`/dashboard` — protected route, requires authenticated session.

**File:** `app/(protected)/dashboard/page.tsx`

On load:
1. GET `/api/contracts` (with default sort: `date desc`)
2. Render `<StatsRow>` + `<ContractList>`

---

## API Route: GET `/api/contracts`

**File:** `app/api/contracts/route.ts`

### Query Parameters

| Param | Type | Default | Values |
|---|---|---|---|
| `sort` | string | `date` | `date`, `name`, `type` |
| `order` | string | `desc` | `asc`, `desc` |
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `20` | 1–50 |

### Processing

1. Auth check → 401
2. Build query:
   ```sql
   SELECT id, contract_name, contract_type, status, page_count, created_at
   FROM contracts
   WHERE user_id = auth.uid()
   ORDER BY <sort_column> <order>
   LIMIT :limit OFFSET (:page - 1) * :limit
   ```
   Sort column map: `date → created_at`, `name → contract_name`, `type → contract_type`
3. Count total for pagination: `SELECT COUNT(*) FROM contracts WHERE user_id = auth.uid()`

### Response 200
```json
{
  "contracts": [
    {
      "id": "uuid",
      "contract_name": "Acme Corp NDA 2026.pdf",
      "contract_type": "nda",
      "status": "complete",
      "page_count": 12,
      "created_at": "2026-07-10T14:23:00Z"
    }
  ],
  "total": 14,
  "page": 1,
  "limit": 20
}
```

---

## Stats Row Component

**File:** `components/dashboard/StatsRow.tsx`

Props:
```typescript
interface StatsRowProps {
  contracts: Contract[]
}
```

Renders 3 stat cards side by side:

| Card | Value | Label |
|---|---|---|
| Total | `contracts.length` (from total count) | "Contracts Reviewed" |
| NDAs | count of `contract_type === 'nda'` in current page | "NDAs" |
| MSAs | count of `contract_type === 'msa'` in current page | "MSAs" |

For the NDA/MSA breakdown: compute from the fetched `contracts` array (not a separate query). Display as count only (no chart at MVP).

On empty state (0 contracts): all stat cards show "0".

---

## Contract List Component

**File:** `components/dashboard/ContractList.tsx`

Props:
```typescript
interface ContractListProps {
  contracts: Contract[]
  total: number
  sort: 'date' | 'name' | 'type'
  order: 'asc' | 'desc'
  onSortChange: (sort: 'date' | 'name' | 'type', order: 'asc' | 'desc') => void
  onPageChange: (page: number) => void
  currentPage: number
}
```

Renders a table with columns:

| Column | Sortable | Content |
|---|---|---|
| Contract Name | Yes (`name`) | `contract_name`; truncate at 60 chars with ellipsis |
| Type | Yes (`type`) | Badge: "NDA" (blue) or "MSA" (purple) |
| Pages | No | `page_count` |
| Status | No | Badge: "Complete" (green), "Processing" (yellow), "Error" (red) |
| Date | Yes (`date`) | Formatted: "Jul 10, 2026" |

Sorting:
- Clicking a sortable column header toggles `order` (asc ↔ desc) or sets new sort column
- Active sort column shows ↑ or ↓ arrow icon
- Sort state passed via URL query params (`?sort=date&order=desc`) to survive page refresh

Pagination:
- Simple prev/next navigation below table
- Shows "Showing 1–20 of 14 contracts"

Each row is fully clickable → `router.push('/contracts/${contract.id}')`.

---

## Contract Row Component

**File:** `components/dashboard/ContractRow.tsx`

Props: single `contract: Contract`

Renders one `<tr>` with the columns above. The entire row has `cursor-pointer` and click handler.

Error status row: shows a "Retry" link in the Status column → navigates to `/upload` (user re-uploads; cannot retry in-place at MVP).

---

## Empty State

Shown when `contracts.length === 0`.

**File:** `components/dashboard/ContractList.tsx` (conditional render)

```
┌────────────────────────────────────────────┐
│                                            │
│   📄  No contracts reviewed yet            │
│                                            │
│   Upload your first contract to begin.     │
│                                            │
│   [Review a Contract]  ← primary CTA       │
│                                            │
└────────────────────────────────────────────┘
```

"Review a Contract" CTA → `router.push('/upload')`.

---

## Quick-Action Button

A "Review a Contract" button is rendered prominently in the Navbar on the dashboard page (in addition to the empty state CTA when no contracts exist).

---

## UX States

| State | Behaviour |
|---|---|
| Loading | Skeleton rows (4 placeholder rows) while GET `/api/contracts` is in-flight |
| Empty (0 contracts) | Empty state component with CTA |
| Populated | Stats row + sortable contract table |
| Sort change | URL updated; new GET request fires; table re-renders |
| Contract with `status = 'error'` | Red "Error" badge in status column; "Retry" link |
| Contract with `status = 'processing'` | Yellow "Processing" badge; clicking row opens results page with partial state |

---

## Acceptance Criteria

- [ ] Dashboard renders stats (total, NDA count, MSA count) correctly
- [ ] Contract list shows all contracts for the authenticated user only (RLS enforced)
- [ ] Sorting by date (default), name, and type works correctly; sort state survives page refresh via URL params
- [ ] Pagination works: next/previous navigation loads correct page
- [ ] Clicking any contract row navigates to `/contracts/[id]`
- [ ] Empty state renders with CTA when no contracts exist
- [ ] "Review a Contract" quick-action button visible in Navbar on dashboard
- [ ] Contracts with `status = 'error'` show red badge + Retry link
