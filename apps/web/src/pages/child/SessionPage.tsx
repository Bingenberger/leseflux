import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { FadingReader } from '../../components/reader/FadingReader.tsx'
import { QuizView } from '../../components/reader/QuizView.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { startSession, finishSession } from '../../lib/api.ts'
import type { StartSessionResponse } from '../../lib/api.ts'

type Phase = 'loading' | 'reading' | 'quiz' | 'result' | 'error'

interface QuizAnswer {
  questionId: string
  selectedIndex: number
  responseTimeMs: number
}

export default function SessionPage() {
  const navigate = useNavigate()
  const durationMinutes = (Number(sessionStorage.getItem('sessionDuration') ?? 10) as 10 | 15)

  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionData, setSessionData] = useState<StartSessionResponse | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [sessionStartTime] = useState(Date.now())
  const [result, setResult] = useState<{ accuracy: number; newTargetWpm: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    startSession(durationMinutes)
      .then(({ data }) => {
        setSessionData(data)
        setPhase('reading')
      })
      .catch(() => {
        setErrorMsg('Es konnte keine Sitzung gestartet werden. Bitte versuche es erneut.')
        setPhase('error')
      })
  }, [durationMinutes])

  const handleReadingComplete = useCallback(() => {
    setPhase('quiz')
  }, [])

  const handleQuizComplete = useCallback(
    async (answers: QuizAnswer[]) => {
      if (!sessionData) return
      try {
        const { data } = await finishSession({
          sessionId: sessionData.session.id,
          answers,
          durationMs: Date.now() - sessionStartTime,
        })
        setResult({ accuracy: data.accuracy, newTargetWpm: data.newTargetWpm })
        setPhase('result')
      } catch {
        setPhase('result')
        setResult({ accuracy: 0, newTargetWpm: sessionData.session.targetWpm })
      }
    },
    [sessionData, sessionStartTime],
  )

  if (phase === 'loading') {
    return (
      <ChildLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xl text-primary animate-pulse">Lesetext wird geladen...</p>
        </div>
      </ChildLayout>
    )
  }

  if (phase === 'error') {
    return (
      <ChildLayout showBack>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <p className="text-warning text-xl text-center">{errorMsg}</p>
          <Button onClick={() => navigate('/child/home')}>Zurück</Button>
        </div>
      </ChildLayout>
    )
  }

  if (phase === 'result') {
    const pct = Math.round((result?.accuracy ?? 0) * 100)
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-6xl">⭐</div>
          <h2 className="text-3xl font-bold text-primary text-center">Super gemacht!</h2>
          <p className="text-xl text-gray-700 text-center">
            Du hast {pct} % der Fragen richtig beantwortet.
          </p>
          <Button size="lg" onClick={() => navigate('/child/home')}>
            Fertig
          </Button>
        </div>
      </ChildLayout>
    )
  }

  if (!sessionData) return null

  return (
    <ChildLayout>
      {/* Pause-Button */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <span className="text-sm text-gray-500 font-medium">{sessionData.text.title}</span>
        <button
          onClick={() => setIsPaused((p) => !p)}
          className="text-primary font-bold text-lg px-4 py-2 min-h-[44px] min-w-[44px]"
          aria-label={isPaused ? 'Weiterlesen' : 'Pause'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto w-full">
        {phase === 'reading' && (
          <FadingReader
            text={sessionData.text.content}
            targetWpm={sessionData.session.targetWpm}
            isPaused={isPaused}
            onComplete={handleReadingComplete}
          />
        )}

        {phase === 'quiz' && (
          <QuizView
            questions={sessionData.text.questions}
            onComplete={handleQuizComplete}
          />
        )}
      </div>

      {isPaused && phase === 'reading' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6 shadow-xl">
            <p className="text-2xl font-bold text-gray-900">Pause</p>
            <Button size="lg" onClick={() => setIsPaused(false)}>
              Weiterlesen
            </Button>
          </div>
        </div>
      )}
    </ChildLayout>
  )
}
