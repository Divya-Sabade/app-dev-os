'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

interface NavbarProps {
  userEmail?: string | null
}

export default function Navbar({ userEmail }: NavbarProps) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/signin')
    router.refresh()
  }

  return (
    <header className="h-16 bg-white border-b border-grey-100 flex items-center px-8 shrink-0">
      <div className="flex items-center justify-between w-full max-w-screen-xl mx-auto">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-grey-900 hover:text-brand-500 transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="8" height="10" rx="1" fill="#115ACB" />
            <rect x="13" y="3" width="8" height="6" rx="1" fill="#115ACB" opacity="0.5" />
            <rect x="3" y="15" width="8" height="6" rx="1" fill="#115ACB" opacity="0.5" />
            <rect x="13" y="11" width="8" height="10" rx="1" fill="#115ACB" opacity="0.7" />
          </svg>
          <span className="font-semibold text-base tracking-tight">ContractIQ</span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/upload"
            className="text-sm font-medium text-grey-500 hover:text-grey-900 transition-colors"
          >
            Upload
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-grey-500 hover:text-grey-900 transition-colors"
          >
            Dashboard
          </Link>

          <div className="flex items-center gap-3 pl-6 border-l border-grey-100">
            {userEmail && (
              <span className="text-xs text-grey-400 max-w-[180px] truncate">{userEmail}</span>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-grey-500 hover:text-error-500 transition-colors"
            >
              Sign out
            </button>
          </div>
        </nav>
      </div>
    </header>
  )
}
