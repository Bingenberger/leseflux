import { type ReactNode, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore.ts'
import { logout, changePassword } from '../../lib/api.ts'
import { PhosphorIcon } from './PhosphorIcons.tsx'
import type { PhosphorIconName } from './PhosphorIcons.tsx'

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) { setError('Neues Passwort muss mindestens 8 Zeichen haben.'); return }
    if (next !== confirm) { setError('Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    try {
      await changePassword(current, next)
      setSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Fehler beim Ändern des Passworts.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Passwort ändern</h2>
        {success ? (
          <div className="flex flex-col gap-4">
            <p className="text-success font-medium">Passwort erfolgreich geändert.</p>
            <button onClick={onClose} className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium">
              Schließen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Aktuelles Passwort
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password"
                className="rounded-lg border border-gray-300 px-3 py-2 font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Neues Passwort
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password"
                className="rounded-lg border border-gray-300 px-3 py-2 font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Neues Passwort bestätigen
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
                className="rounded-lg border border-gray-300 px-3 py-2 font-normal" />
            </label>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-2 mt-1">
              <button type="submit" disabled={loading}
                className="flex-1 rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium disabled:opacity-60">
                {loading ? 'Speichern…' : 'Speichern'}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 text-gray-600 px-4 py-2 text-sm font-medium">
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

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
  const [showPasswordModal, setShowPasswordModal] = useState(false)

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
            <button
              onClick={() => setShowPasswordModal(true)}
              className="font-medium text-gray-700 hover:text-primary underline-offset-2 hover:underline"
              title="Passwort ändern"
            >
              {user?.displayName}
            </button>
            <button onClick={handleLogout} className="inline-flex items-center gap-1.5 text-red-500 hover:underline">
              <PhosphorIcon name="signOut" size={16} />
              Abmelden
            </button>
            {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
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
