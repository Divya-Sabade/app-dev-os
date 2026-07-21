import { createSupabaseServerClient } from '@/lib/supabase'
import Navbar from '@/components/layout/Navbar'
import LegalDisclaimer from '@/components/layout/LegalDisclaimer'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex flex-col bg-grey-25">
      <Navbar userEmail={user?.email} />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
      <LegalDisclaimer />
    </div>
  )
}
