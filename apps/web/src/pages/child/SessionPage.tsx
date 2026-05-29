import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { FadingReader } from '../../components/reader/FadingReader.tsx'
import { QuizView } from '../../components/reader/QuizView.tsx'
import { FlashWordExercise } from '../../components/reader/FlashWordExercise.tsx'
import { ClozeExercise } from '../../components/reader/ClozeExercise.tsx'
import { SelfPacedReader } from '../../components/reader/SelfPacedReader.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { startSession, finishExercise, finishSession, startNextReadingExercise } from '../../lib/api.ts'
import type { ExerciseResponse, StartSessionResponse, TrainingExercise } from '../../lib/api.ts'

type Phase = 'loading' | 'intro' | 'countdown' | 'reading' | 'quiz' | 'between' | 'result' | 'error'

const MIN_READING_BLOCK_REMAINING_MS = 90_000
const COUNTDOWN_START = 3

const EXERCISE_LABEL: Record<TrainingExercise['type'], string> = {
  FLASH_WORD: 'Wortblitz',
  FADING: 'Lesen mit Fading',
  CLOZE: 'Lückentext',
  SELF_PACED: 'Lesen im eigenen Tempo',
}

const EXERCISE_ICON: Record<TrainingExercise['type'], string> = {
  FLASH_WORD: '⚡',
  FADING: '📖',
  CLOZE: '🧩',
  SELF_PACED: '⏱',
}

const EXERCISE_DESCRIPTION: Record<TrainingExercise['type'], string> = {
  FLASH_WORD: 'Gleich siehst du Wörter ganz kurz. Wähle danach das richtige Wort aus.',
  FADING: 'Gleich liest du einen Text, der nach und nach ausgeblendet wird. Bleib ruhig im Tempo.',
  CLOZE: 'Gleich ergänzt du fehlende Wörter im Text. Nutze den Zusammenhang im Satz.',
  SELF_PACED: 'Gleich liest du in deinem eigenen Tempo. Lies genau und drücke danach weiter.',
}

function minutesLabel(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return `${minutes} Min.`
}

interface QuizAnswer {
  questionId: string
  selectedIndex: number
  responseTimeMs: number
}

interface Round {
  textTitle: string
  accuracy: number
  starsEarned: number
  offerIntermediateDiagnostic?: boolean | undefined
  newTargetWpm?: number | undefined
  streakDays?: number | undefined
}

export default function SessionPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionData, setSessionData] = useState<StartSessionResponse | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [completedRounds, setCompletedRounds] = useState<Round[]>([])
  const [lastRound, setLastRound] = useState<Round | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [selfPacedDurationMs, setSelfPacedDurationMs] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_START)
  const [, setTick] = useState(0)
  const durationMs = sessionData?.exercises.reduce(
    (sum, exercise) => sum + exercise.targetDurationSec * 1000,
    0,
  ) ?? 10 * 60 * 1000

  // Refs für stabile Werte in Callbacks
  const unitIdRef = useRef<string | undefined>(undefined)
  const unitStartMsRef = useRef(Date.now())
  const blockStartMsRef = useRef(Date.now())
  const runStartMsRef = useRef(Date.now())
  const countdownStartMsRef = useRef(Date.now())
  const resetBlockOnContinueRef = useRef(false)

  const loadNextText = useCallback(async (unitId?: string) => {
    setPhase('loading')
    setIsPaused(false)
    try {
      const { data } = await startSession(undefined, unitId)
      const now = Date.now()
      unitIdRef.current = data.trainingUnitId
      unitStartMsRef.current = now
      blockStartMsRef.current = now
      runStartMsRef.current = now
      resetBlockOnContinueRef.current = true
      setSessionData(data)
      setCurrentIndex(0)
      setPhase('intro')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 429) {
        setErrorMsg('Du hast heute schon geübt. Komm morgen wieder!')
      } else if (status === 404) {
        setErrorMsg('Keine passenden Lesetexte gefunden. Bitte frag deine Lehrerin.')
      } else {
        setErrorMsg('Es konnte keine Sitzung gestartet werden. Bitte versuche es erneut.')
      }
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    unitStartMsRef.current = Date.now()
    loadNextText(undefined)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== 'countdown') return undefined
    if (countdown <= 0) {
      const now = Date.now()
      const countdownDurationMs = now - countdownStartMsRef.current
      runStartMsRef.current = now
      if (resetBlockOnContinueRef.current) {
        blockStartMsRef.current = now
        resetBlockOnContinueRef.current = false
      } else {
        blockStartMsRef.current += countdownDurationMs
      }
      setIsPaused(false)
      setPhase('reading')
      return undefined
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phase, countdown])

  useEffect(() => {
    if (phase !== 'reading' && phase !== 'quiz') return undefined
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [phase])

  const handleReadingComplete = useCallback(() => {
    setPhase('quiz')
  }, [])

  const handleSelfPacedComplete = useCallback((readingDurationMs: number) => {
    setSelfPacedDurationMs(readingDurationMs)
    setPhase('quiz')
  }, [])

  const handleQuizComplete = useCallback(
    async (answers: QuizAnswer[]) => {
      if (!sessionData) return
      const current = sessionData.exercises[currentIndex]
      if (!current || (current.type !== 'FADING' && current.type !== 'SELF_PACED')) return
      let round: Round = {
        textTitle: current.text.title,
        accuracy: 0,
        starsEarned: 1,
      }
      try {
        const runDurationMs = Date.now() - runStartMsRef.current
        const { data: exerciseResult } = await finishExercise(current.runId, {
          responses: current.type === 'SELF_PACED' && selfPacedDurationMs !== null
            ? [
                {
                  event: 'READING_DONE',
                  wordCount: current.text.wordCount,
                  durationMs: selfPacedDurationMs,
                },
                ...answers,
              ]
            : answers,
          durationMs: runDurationMs,
        })

        const remainingBlockMs = Math.max(
          0,
          current.targetDurationSec * 1000 - (Date.now() - blockStartMsRef.current),
        )
        if (remainingBlockMs >= MIN_READING_BLOCK_REMAINING_MS) {
          try {
            const { data: nextExercise } = await startNextReadingExercise(current.runId)
            setSessionData((prev) => prev
              ? {
                  ...prev,
                  exercises: prev.exercises.map((exercise, index) =>
                    index === currentIndex ? nextExercise : exercise,
                  ),
                }
              : prev)
            round = {
              textTitle: current.text.title,
              accuracy: exerciseResult.accuracy,
              starsEarned: exerciseResult.accuracy >= 0.7 ? 3 : exerciseResult.accuracy >= 0.4 ? 2 : 1,
            }
            setLastRound(round)
            setCompletedRounds((prev) => [...prev, round])
            setSelfPacedDurationMs(null)
            resetBlockOnContinueRef.current = false
            setPhase('between')
            return
          } catch {
            // Kein weiterer Text: normal zum nächsten Block bzw. Abschluss wechseln.
          }
        }

        const isLastExercise = currentIndex >= sessionData.exercises.length - 1
        const data = isLastExercise
          ? (await finishSession({
              sessionId: sessionData.sessionId,
              totalDurationMs: Date.now() - unitStartMsRef.current,
            })).data
          : null
        round = {
          textTitle: current.text.title,
          accuracy: data?.accuracy ?? exerciseResult.accuracy,
          starsEarned: data?.starsEarned ?? 1,
          offerIntermediateDiagnostic: data?.offerIntermediateDiagnostic,
          newTargetWpm: data?.newTargetWpm,
          streakDays: data?.streakDays,
        }
      } catch {
        // Ergebnis mit Defaults verwenden
      }

      setLastRound(round)
      setCompletedRounds((prev) => [...prev, round])

      if (currentIndex < sessionData.exercises.length - 1) {
        setSelfPacedDurationMs(null)
        resetBlockOnContinueRef.current = true
        setCurrentIndex((i) => i + 1)
        setPhase('between')
      } else {
        await queryClient.invalidateQueries({ queryKey: ['my-progress'] })
        setPhase('result')
      }
    },
    [sessionData, currentIndex, queryClient, selfPacedDurationMs],
  )

  const handleFlashComplete = useCallback(
    async (responses: ExerciseResponse[], durationMs: number) => {
      if (!sessionData) return
      const current = sessionData.exercises[currentIndex]
      if (!current || current.type !== 'FLASH_WORD') return

      let round: Round = { textTitle: 'Wortblitz', accuracy: 0, starsEarned: 1 }
      try {
        const { data } = await finishExercise(current.runId, { responses, durationMs })
        round = {
          textTitle: 'Wortblitz',
          accuracy: data.accuracy,
          starsEarned: data.accuracy >= 0.85 ? 3 : data.accuracy >= 0.5 ? 2 : 1,
        }
      } catch {
        // Ergebnis mit Defaults verwenden
      }

      setLastRound(round)
      setCompletedRounds((prev) => [...prev, round])

      if (currentIndex < sessionData.exercises.length - 1) {
        setSelfPacedDurationMs(null)
        resetBlockOnContinueRef.current = true
        setCurrentIndex((i) => i + 1)
        setPhase('between')
      } else {
        await finishSession({
          sessionId: sessionData.sessionId,
          totalDurationMs: Date.now() - unitStartMsRef.current,
        })
        await queryClient.invalidateQueries({ queryKey: ['my-progress'] })
        setPhase('result')
      }
    },
    [sessionData, currentIndex, queryClient],
  )

  const handleClozeComplete = useCallback(
    async (responses: ExerciseResponse[], durationMs: number) => {
      if (!sessionData) return
      const current = sessionData.exercises[currentIndex]
      if (!current || current.type !== 'CLOZE') return

      let round: Round = { textTitle: 'Lückentext', accuracy: 0, starsEarned: 1 }
      try {
        const { data } = await finishExercise(current.runId, { responses, durationMs })
        round = {
          textTitle: 'Lückentext',
          accuracy: data.accuracy,
          starsEarned: data.accuracy >= 0.7 ? 3 : data.accuracy >= 0.4 ? 2 : 1,
        }
      } catch {
        // Ergebnis mit Defaults verwenden
      }

      setLastRound(round)
      setCompletedRounds((prev) => [...prev, round])

      if (currentIndex < sessionData.exercises.length - 1) {
        setSelfPacedDurationMs(null)
        resetBlockOnContinueRef.current = true
        setCurrentIndex((i) => i + 1)
        setPhase('between')
      } else {
        await finishSession({
          sessionId: sessionData.sessionId,
          totalDurationMs: Date.now() - unitStartMsRef.current,
        })
        await queryClient.invalidateQueries({ queryKey: ['my-progress'] })
        setPhase('result')
      }
    },
    [sessionData, currentIndex, queryClient],
  )

  const handleContinue = useCallback(async () => {
    setPhase('intro')
  }, [])

  const handleStartSegment = useCallback(() => {
    countdownStartMsRef.current = Date.now()
    setCountdown(COUNTDOWN_START)
    setIsPaused(false)
    setPhase('countdown')
  }, [])

  const handleFinish = useCallback(async () => {
    if (sessionData) {
      try {
        const { data } = await finishSession({
          sessionId: sessionData.sessionId,
          totalDurationMs: Date.now() - unitStartMsRef.current,
        })
        setCompletedRounds((prev) => {
          if (prev.length === 0) return prev
          const next = [...prev]
          const last = next[next.length - 1]!
          next[next.length - 1] = {
            ...last,
            accuracy: data.accuracy,
            starsEarned: data.starsEarned ?? last.starsEarned,
            offerIntermediateDiagnostic: data.offerIntermediateDiagnostic,
            newTargetWpm: data.newTargetWpm,
            streakDays: data.streakDays,
          }
          return next
        })
      } catch {
        // UI-Abschluss nicht blockieren, wenn die Session serverseitig schon beendet ist.
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['my-progress'] })
    setPhase('result')
  }, [queryClient, sessionData])

  // ── Ladeanzeige ──────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <ChildLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xl text-primary animate-pulse">
            {completedRounds.length === 0 ? 'Lesetext wird geladen…' : 'Nächster Text wird geladen…'}
          </p>
        </div>
      </ChildLayout>
    )
  }

  // ── Fehler ───────────────────────────────────────────────────────────────
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

  // ── Zwischen-Text-Ergebnis ────────────────────────────────────────────────
  if (phase === 'between' && lastRound) {
    const stars = lastRound.starsEarned
    const pct = Math.round(lastRound.accuracy * 100)
    const remaining = Math.max(0, durationMs - (Date.now() - unitStartMsRef.current))
    const remainingMin = Math.ceil(remaining / 60_000)
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 max-w-sm mx-auto w-full">
          <div className="flex gap-2 text-5xl">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={s <= stars ? 'opacity-100' : 'opacity-20'}
                style={{ filter: s <= stars ? 'drop-shadow(0 0 6px #f59e0b)' : 'none' }}
              >
                ⭐
              </span>
            ))}
          </div>
          <h2 className="text-2xl font-bold text-primary text-center">Toll gemacht!</h2>
          <p className="text-gray-600 text-center">
            {pct} % richtig — noch ca. {remainingMin} {remainingMin === 1 ? 'Minute' : 'Minuten'} übrig
          </p>
          <Button size="lg" onClick={handleContinue} className="w-full">
            Weiter zum nächsten Abschnitt →
          </Button>
          <button
            onClick={handleFinish}
            className="text-sm text-gray-400 underline"
          >
            Für heute aufhören
          </button>
        </div>
      </ChildLayout>
    )
  }

  // ── Abschluss-Ergebnis ───────────────────────────────────────────────────
  if (phase === 'result') {
    const totalStars = completedRounds.reduce((s, r) => s + r.starsEarned, 0)
    const avgAccuracy = completedRounds.length > 0
      ? Math.round(completedRounds.reduce((s, r) => s + r.accuracy, 0) / completedRounds.length * 100)
      : 0
    const last = completedRounds[completedRounds.length - 1]
    const streakDays = last?.streakDays ?? 1
    const offerDiagnostic = last?.offerIntermediateDiagnostic ?? false

    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 max-w-sm mx-auto w-full">
          <div className="text-6xl">🎉</div>
          <h2 className="text-3xl font-bold text-primary text-center">Super gemacht!</h2>

          <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Gelesene Texte</span>
              <span className="font-bold text-gray-900">{completedRounds.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Verdiente Sterne</span>
              <span className="font-bold text-amber-500">{'⭐'.repeat(Math.min(totalStars, 9))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Ø Genauigkeit</span>
              <span className={[
                'font-bold',
                avgAccuracy >= 70 ? 'text-success' : avgAccuracy < 40 ? 'text-warning' : 'text-gray-700',
              ].join(' ')}>{avgAccuracy} %</span>
            </div>
          </div>

          {streakDays > 1 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3">
              <span className="text-2xl">🔥</span>
              <span className="font-semibold text-orange-700">{streakDays} Tage in Folge!</span>
            </div>
          )}

          {offerDiagnostic ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-sm text-gray-500 text-center">Zeit für einen kurzen Lesetest!</p>
              <Button size="lg" onClick={() => navigate('/child/diagnostic/intermediate')} className="w-full">
                Lesetest machen
              </Button>
              <button onClick={() => navigate('/child/home')} className="text-sm text-gray-400 underline">
                Jetzt nicht
              </button>
            </div>
          ) : (
            <Button size="lg" onClick={() => navigate('/child/home')} className="w-full">
              Fertig
            </Button>
          )}
        </div>
      </ChildLayout>
    )
  }

  if (!sessionData) return null
  const current = sessionData.exercises[currentIndex] as TrainingExercise | undefined
  if (!current) return null

  if (phase === 'intro') {
    const title = EXERCISE_LABEL[current.type]
    const detail = current.type === 'FADING' || current.type === 'CLOZE' || current.type === 'SELF_PACED'
      ? current.text.title
      : `${current.words.length} Wörter`
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 max-w-sm mx-auto w-full text-center">
          <div className="text-sm font-semibold text-gray-400">
            Abschnitt {currentIndex + 1} von {sessionData.exercises.length}
          </div>
          <div className="text-7xl">{EXERCISE_ICON[current.type]}</div>
          <div>
            <h2 className="text-3xl font-bold text-primary">{title}</h2>
            <p className="text-sm text-gray-500 mt-2">{detail} · ca. {minutesLabel(current.targetDurationSec)}</p>
          </div>
          <p className="text-gray-700 leading-relaxed">{EXERCISE_DESCRIPTION[current.type]}</p>
          <Button size="lg" onClick={handleStartSegment} className="w-full">
            Abschnitt starten
          </Button>
        </div>
      </ChildLayout>
    )
  }

  if (phase === 'countdown') {
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <p className="text-xl font-bold text-primary">{EXERCISE_LABEL[current.type]} startet gleich</p>
          <div className="w-36 h-36 rounded-full bg-primary text-white flex items-center justify-center text-7xl font-black shadow-lg">
            {countdown}
          </div>
          <p className="text-gray-500">Mach dich bereit.</p>
        </div>
      </ChildLayout>
    )
  }

  // ── Lesen / Quiz ──────────────────────────────────────────────────────────
  const elapsed = Date.now() - unitStartMsRef.current
  const totalProgramMs = Math.max(
    sessionData.exercises.reduce((sum, exercise) => sum + exercise.targetDurationSec * 1000, 0),
    1,
  )
  const progressPct = Math.min(100, (elapsed / totalProgramMs) * 100)
  const remainingMin = Math.ceil(Math.max(0, totalProgramMs - elapsed) / 60_000)

  return (
    <ChildLayout>
      {/* Header: Titel + Fortschrittsbalken + Restzeit + Pause */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <div className="flex-1 mr-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 truncate max-w-[60%]">
              {current.type === 'FADING' || current.type === 'CLOZE' || current.type === 'SELF_PACED'
                ? current.text.title
                : 'Wortblitz'}
            </p>
            <p className="text-xs font-semibold text-primary shrink-0 ml-2">
              {remainingMin <= 1 ? 'Fast fertig!' : `Noch ca. ${remainingMin} Min.`}
            </p>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => setIsPaused((p) => !p)}
          className="text-primary font-bold text-lg px-4 py-2 min-h-[44px] min-w-[44px] ml-4"
          aria-label={isPaused ? 'Weiterlesen' : 'Pause'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto w-full">
        {phase === 'reading' && (current.type === 'FLASH_WORD' ? (
            <FlashWordExercise exercise={current} onComplete={handleFlashComplete} />
          ) : current.type === 'CLOZE' ? (
            <ClozeExercise exercise={current} onComplete={handleClozeComplete} />
          ) : current.type === 'SELF_PACED' ? (
            <SelfPacedReader text={current.text.content} onComplete={handleSelfPacedComplete} />
          ) : (
          <FadingReader
            text={current.text.content}
            targetWpm={current.fadingTargetWpm}
            isPaused={isPaused}
            onComplete={handleReadingComplete}
          />
        ))}
        {phase === 'quiz' && (current.type === 'FADING' || current.type === 'SELF_PACED') && (
          <QuizView
            questions={current.questions}
            onComplete={handleQuizComplete}
          />
        )}
      </div>

      {isPaused && phase === 'reading' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6 shadow-xl">
            <p className="text-2xl font-bold text-gray-900">Pause</p>
            <Button size="lg" onClick={() => setIsPaused(false)}>Weiterlesen</Button>
          </div>
        </div>
      )}
    </ChildLayout>
  )
}
