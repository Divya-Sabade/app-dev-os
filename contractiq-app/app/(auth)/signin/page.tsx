import { Suspense } from 'react'
import AuthForm from '@/components/auth/AuthForm'

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen hero-gradient" />}>
      <AuthForm mode="signin" />
    </Suspense>
  )
}
