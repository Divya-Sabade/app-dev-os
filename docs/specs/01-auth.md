# Spec 01 — Authentication & Session Management

## Overview

Email/password authentication via Supabase Auth. All user data is scoped by `auth.uid()` via RLS. Protected routes are enforced by Next.js middleware. No OAuth or SSO in MVP.

---

## User Flow

### Sign Up
1. User visits `/auth/signup`
2. Fills in email + password (password ≥ 8 characters)
3. Submits → `supabase.auth.signUp({ email, password })`
4. Supabase sends verification email
5. On email confirmation, Supabase creates session → cookie set → redirect to `/dashboard`

### Sign In
1. User visits `/auth/signin`
2. Fills in email + password
3. Submits → `supabase.auth.signInWithPassword({ email, password })`
4. On success → session cookie set → redirect to `/dashboard`
5. On error → display "Invalid email or password" (no enumeration)

### Sign Out
1. User clicks "Sign Out" in Navbar
2. `supabase.auth.signOut()` → session cookie cleared
3. Redirect to `/`

### Session Persistence
- Supabase stores session in browser cookies via `@supabase/ssr`
- Session auto-refreshes before expiry
- On browser refresh: middleware reads cookie → session valid → user stays logged in

---

## Route Protection

**File:** `middleware.ts` (project root)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Creates a Supabase client scoped to the request
  // Refreshes session cookie if expired
  // If no valid session and route is protected → redirect to /auth/signin?redirect=<current-path>
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/upload/:path*',
    '/contracts/:path*',
    '/api/upload',
    '/api/process',
    '/api/contracts/:path*',
    '/api/key-terms/:path*',
    '/api/chat/:path*',
    '/api/feedback',
    '/api/storage/:path*',
  ],
}
```

All API routes additionally validate the session via `createServerClient` at the top of each handler before processing any request body.

---

## Component Spec

**File:** `components/auth/AuthForm.tsx`

Props:
```typescript
interface AuthFormProps {
  mode: 'signin' | 'signup'
}
```

State:
- `email: string`
- `password: string`
- `loading: boolean`
- `error: string | null`

Behaviour:
- Validates email format and password length (≥ 8 chars) client-side before submit
- Shows inline error below the form on Supabase errors
- Disables submit button while `loading = true`
- On success: calls `router.push('/dashboard')` or `router.push(searchParams.get('redirect') ?? '/dashboard')`

**File:** `app/(auth)/signin/page.tsx` — renders `<AuthForm mode="signin" />`  
**File:** `app/(auth)/signup/page.tsx` — renders `<AuthForm mode="signup" />`

---

## Supabase Client Setup

**File:** `lib/supabase-browser.ts` — used in client components

```typescript
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**File:** `lib/supabase.ts` — used in API routes (server-side)

```typescript
import { createServerClient } from '@supabase/ssr'
// Takes cookies from the request; uses service role key for elevated operations
// Helper: getUser(request) → returns auth.users row or throws 401
```

---

## Error States

| Scenario | User-Facing Message |
|---|---|
| Invalid email format | "Please enter a valid email address" (client-side, before submit) |
| Password too short | "Password must be at least 8 characters" (client-side) |
| Wrong password | "Invalid email or password" |
| Email already registered | "An account with this email already exists" |
| Email not confirmed | "Please verify your email before signing in" |
| Network error | "Something went wrong. Please try again." |
| Unauthenticated API request | 401 `{ error: "Unauthorized", code: "UNAUTHORIZED" }` |

---

## Acceptance Criteria

- [ ] Sign-up flow completes within 10 seconds (Supabase target)
- [ ] User is redirected to `/dashboard` on successful sign-in
- [ ] Invalid credentials return a clear error; no account enumeration
- [ ] Unauthenticated access to any protected route redirects to `/auth/signin`
- [ ] Session persists across browser refresh
- [ ] Sign-out clears session and redirects to `/`
- [ ] Auth state available in all client components via Supabase browser client
