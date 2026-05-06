import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { useAuthStore } from '../../store/authStore.ts'
import { useSettingsStore } from '../../store/settingsStore.ts'
import { logout } from '../../lib/api.ts'

export default function ChildHomePage() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const { lrsMode, toggleLrsMode } = useSettingsStore()
  const [selectedMinutes, setSelectedMinutes] = useState<10 | 15>(10)

  const handleStart = () => {
    sessionStorage.setItem('sessionDuration', String(selectedMinutes))
    navigate('/child/session')
  }

  const handleLogout = async () => {
    await logout().catch(() => {})
    clearAuth()
    navigate('/child/login')
  }

  return (
    <ChildLayout>
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-8 max-w-lg mx-auto w-full">
        <div className="text-center">
          <p className="text-lg text-gray-500">Hallo,</p>
          <h1 className="text-4xl font-bold text-primary">{user?.displayName}!</h1>
        </div>

        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
          <p className="font-semibold text-gray-700 text-center">Wie lange möchtest du lesen?</p>
          <div className="flex gap-3">
            {([10, 15] as const).map((min) => (
              <button
                key={min}
                onClick={() => setSelectedMinutes(min)}
                className={[
                  'flex-1 rounded-xl py-4 text-xl font-bold border-2 transition-colors min-h-[64px]',
                  selectedMinutes === min
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-primary border-primary hover:bg-blue-50',
                ].join(' ')}
              >
                {min} Min
              </button>
            ))}
          </div>
          <Button size="lg" onClick={handleStart} className="w-full">
            Lesen starten
          </Button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Schrift:</span>
          <button
            onClick={toggleLrsMode}
            className={[
              'px-3 py-1 rounded-full border text-sm font-medium transition-colors',
              lrsMode
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-300',
            ].join(' ')}
          >
            {lrsMode ? 'OpenDyslexic' : 'Normal'}
          </button>
        </div>

        <button onClick={handleLogout} className="text-xs text-gray-300 hover:text-gray-400">
          Abmelden
        </button>
      </div>
    </ChildLayout>
  )
}
