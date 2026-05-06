import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.ts'
import type { ReactNode } from 'react'
import type { AuthUser } from '../lib/api.ts'

interface Props {
  children: ReactNode
  allowedRoles?: AuthUser['role'][]
  redirectTo?: string
}

export function ProtectedRoute({ children, allowedRoles, redirectTo = '/login' }: Props) {
  const user = useAuthStore((s) => s.user)

  if (!user) return <Navigate to={redirectTo} replace />

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
