import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { QrScanner } from '../../components/shared/QrScanner.tsx'
import { loginChild } from '../../lib/api.ts'
import { useAuthStore } from '../../store/authStore.ts'

type ScanState = 'idle' | 'scanning' | 'loading' | 'error'

export default function ChildLoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [state, setState] = useState<ScanState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleScan = useCallback(
    async (token: string) => {
      if (state === 'loading') return
      setState('loading')
      try {
        const { data } = await loginChild(token)
        setAuth(data.user, data.token)
        navigate('/child/home', { replace: true })
      } catch {
        setErrorMsg('QR-Code nicht erkannt. Bitte versuche es noch einmal.')
        setState('error')
        setTimeout(() => setState('scanning'), 3000)
      }
    },
    [state, navigate, setAuth],
  )

  return (
    <ChildLayout>
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-8">
        <h1 className="text-3xl font-bold text-primary">Leseflux</h1>
        <p className="text-xl text-gray-700 text-center">
          Halte deinen Lese-Ausweis vor die Kamera!
        </p>

        {state === 'idle' && (
          <button
            onClick={() => setState('scanning')}
            className="w-48 h-48 rounded-full bg-primary text-white text-2xl font-bold flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95 transition-transform"
          >
            Anmelden
          </button>
        )}

        {(state === 'scanning' || state === 'loading') && (
          <QrScanner onScan={handleScan} />
        )}

        {state === 'loading' && (
          <p className="text-primary font-medium">Einen Moment...</p>
        )}

        {state === 'error' && (
          <p className="text-warning font-medium text-center">{errorMsg}</p>
        )}

        <button
          className="text-sm text-gray-400 underline"
          onClick={() => navigate('/login')}
        >
          Lehrer-Anmeldung
        </button>
      </div>
    </ChildLayout>
  )
}
