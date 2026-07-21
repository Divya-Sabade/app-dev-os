import { Suspense } from 'react'
import AuthForm from '@/components/auth/AuthForm'

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen hero-gradient" />}>
      <AuthForm mode="signup" />
    </Suspense>
  )
}
