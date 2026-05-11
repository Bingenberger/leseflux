import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { QrScanner } from '../../components/shared/QrScanner.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { loginChild, loginChildCode } from '../../lib/api.ts'
import { useAuthStore } from '../../store/authStore.ts'

type Mode = 'choose' | 'scanning' | 'code'
type ScanState = 'idle' | 'loading' | 'error'

export default function ChildLoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [mode, setMode] = useState<Mode>('choose')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const handleScan = useCallback(
    async (scanned: string) => {
      if (scanState === 'loading') return
      setScanState('loading')
      try {
        const s = scanned.trim()
        // Kurze alphanumerische Strings ohne Sonderzeichen → gedruckte Login-Codes
        const isLoginCode = /^[A-Z0-9]{4,8}$/i.test(s) && !s.includes('/')
        const loginFn = isLoginCode ? () => loginChildCode(s.toUpperCase()) : () => loginChild(s)
        const { data } = await loginFn()
        setAuth(data.user, data.token)
        navigate('/child/home', { replace: true })
      } catch {
        setScanState('error')
        setTimeout(() => setScanState('idle'), 3000)
      }
    },
    [scanState, navigate, setAuth],
  )

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError('')
    const trimmed = codeInput.trim().toUpperCase()
    if (trimmed.length < 4) {
      setCodeError('Bitte gib deinen Code ein.')
      return
    }
    setCodeLoading(true)
    try {
      const { data } = await loginChildCode(trimmed)
      setAuth(data.user, data.token)
      navigate('/child/home', { replace: true })
    } catch {
      setCodeError('Code nicht gefunden. Bitte frag deine Lehrerin / deinen Lehrer.')
    } finally {
      setCodeLoading(false)
    }
  }

  return (
    <ChildLayout>
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-8">
        <h1 className="text-3xl font-bold text-primary">Leseflux</h1>

        {mode === 'choose' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-xs">
            <button
              onClick={() => setMode('scanning')}
              className="w-full rounded-2xl bg-primary text-white text-xl font-bold py-6 min-h-[80px] shadow-md active:scale-95 transition-transform hover:bg-blue-700"
            >
              📷 QR-Code scannen
            </button>
            <button
              onClick={() => setMode('code')}
              className="w-full rounded-2xl border-2 border-primary text-primary text-xl font-bold py-6 min-h-[80px] active:scale-95 transition-transform hover:bg-blue-50"
            >
              🔑 Code eingeben
            </button>
          </div>
        )}

        {mode === 'scanning' && (
          <div className="flex flex-col items-center gap-4 w-full">
            <p className="text-xl text-gray-700 text-center">
              Halte deinen Lese-Ausweis vor die Kamera!
            </p>
            <QrScanner onScan={handleScan} />
            {scanState === 'error' && (
              <p className="text-warning font-medium text-center">
                QR-Code nicht erkannt. Bitte versuche es noch einmal.
              </p>
            )}
            {scanState === 'loading' && (
              <p className="text-primary font-medium">Einen Moment...</p>
            )}
            <button
              onClick={() => setMode('choose')}
              className="text-sm text-gray-400 underline mt-2"
            >
              Zurück
            </button>
          </div>
        )}

        {mode === 'code' && (
          <form
            onSubmit={handleCodeSubmit}
            className="flex flex-col items-center gap-5 w-full max-w-xs"
          >
            <p className="text-xl text-gray-700 text-center">
              Gib deinen Code ein:
            </p>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="z. B. AB3X7K"
              className="w-full text-center text-3xl font-bold tracking-[0.3em] uppercase rounded-xl border-2 border-gray-300 px-4 py-4 focus:outline-none focus:border-primary"
            />
            {codeError && (
              <p className="text-warning text-sm text-center">{codeError}</p>
            )}
            <Button type="submit" disabled={codeLoading} size="lg" className="w-full">
              {codeLoading ? 'Einen Moment...' : 'Anmelden'}
            </Button>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="text-sm text-gray-400 underline"
            >
              Zurück
            </button>
          </form>
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
