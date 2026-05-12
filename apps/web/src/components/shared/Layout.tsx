import { type ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.ts'
import { logout } from '../../lib/api.ts'
import { PhosphorIcon } from './PhosphorIcons.tsx'
import type { PhosphorIconName } from './PhosphorIcons.tsx'

interface TeacherLayoutProps {
  children: ReactNode
  title?: string
}

const NAV_LINKS: { label: string; href: string; roles: string[]; icon: PhosphorIconName }[] = [
  { label: 'Klassen', href: '/teacher/dashboard', roles: ['TEACHER', 'ADMIN'], icon: 'users' },
  { label: 'Texte', href: '/teacher/texts', roles: ['TEACHER', 'ADMIN'], icon: 'pencilSimple' },
  { label: 'Wortblitz', href: '/teacher/flash-words', roles: ['TEACHER', 'ADMIN'], icon: 'listChecks' },
  { label: 'Diagnostik', href: '/teacher/diagnostics', roles: ['TEACHER', 'ADMIN'], icon: 'gear' },
  { label: 'Vorlagen', href: '/teacher/templates', roles: ['TEACHER', 'ADMIN'], icon: 'listChecks' },
  { label: 'Lehrerkonten', href: '/admin/teachers', roles: ['ADMIN'], icon: 'userPlus' },
  { label: 'Einstellungen', href: '/admin/settings', roles: ['ADMIN'], icon: 'gear' },
]

export function TeacherLayout({ children, title }: TeacherLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore()

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearAuth()
    navigate('/login')
  }

  const visibleLinks = NAV_LINKS.filter((l) => user?.role && l.roles.includes(user.role))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-0">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span
              className="text-xl font-bold text-primary cursor-pointer shrink-0"
              onClick={() => navigate('/teacher/dashboard')}
            >
              Leseflux
            </span>
            <nav className="flex gap-1">
              {visibleLinks.map((link) => {
                const active = location.pathname.startsWith(link.href)
                return (
                  <button
                    key={link.href}
                    onClick={() => navigate(link.href)}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-primary'
                        : 'text-gray-600 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    <PhosphorIcon name={link.icon} size={16} />
                    {link.label}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {title && (
              <span className="text-gray-400 hidden sm:inline">/ {title}</span>
            )}
            <span className="font-medium">{user?.displayName}</span>
            <button onClick={handleLogout} className="inline-flex items-center gap-1.5 text-red-500 hover:underline">
              <PhosphorIcon name="signOut" size={16} />
              Abmelden
            </button>
          </div>
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
  const { user, clearAuth } = useAuthStore()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearAuth()
    navigate('/child/login')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-background">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="text-primary text-2xl p-1 mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Zurück"
            >
              ←
            </button>
          )}
          <span className="text-lg font-bold text-primary">Leseflux</span>
        </div>
        {user && (
          <button
            onClick={() => setConfirmLogout(true)}
            className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 min-h-[44px] min-w-[44px] flex items-center"
          >
            Abmelden
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      {/* Logout-Bestätigung */}
      {confirmLogout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-xl flex flex-col items-center gap-6">
            <p className="text-xl font-bold text-gray-800 text-center">
              Wirklich abmelden?
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleLogout}
                className="w-full rounded-2xl bg-primary text-white text-lg font-bold py-4 min-h-[56px] active:scale-95 transition-transform"
              >
                Ja, abmelden
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="w-full rounded-2xl border-2 border-gray-200 text-gray-600 text-lg font-bold py-4 min-h-[56px] active:scale-95 transition-transform"
              >
                Nein, weiterlesen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
