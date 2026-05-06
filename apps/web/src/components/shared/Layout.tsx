import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.ts'
import { logout } from '../../lib/api.ts'

interface TeacherLayoutProps {
  children: ReactNode
  title?: string
}

export function TeacherLayout({ children, title }: TeacherLayoutProps) {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span
            className="text-xl font-bold text-primary cursor-pointer"
            onClick={() => navigate('/teacher/dashboard')}
          >
            Leseflux
          </span>
          {title && <span className="text-gray-500 text-sm">/ {title}</span>}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{user?.displayName}</span>
          <button onClick={handleLogout} className="text-red-600 hover:underline">
            Abmelden
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

interface ChildLayoutProps {
  children: ReactNode
  showBack?: boolean
}

export function ChildLayout({ children, showBack }: ChildLayoutProps) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showBack && (
        <div className="p-4">
          <button
            onClick={() => navigate(-1)}
            className="text-primary text-2xl p-2"
            aria-label="Zurück"
          >
            ←
          </button>
        </div>
      )}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
