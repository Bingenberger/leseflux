import { useCallback, useMemo, useRef, useState } from 'react'
import { repeatedReadingPassWpm } from '@leseflux/shared'
import { Button } from '../shared/Button.tsx'
import { FadingReader } from './FadingReader.tsx'
import { QuizView } from './QuizView.tsx'
import { SelfPacedReader } from './SelfPacedReader.tsx'
import type { ExerciseResponse, RepeatedReadingExercise as RepeatedReadingData } from '../../lib/api.ts'

interface Props {
  exercise: RepeatedReadingData
  isPaused: boolean
  onComplete: (responses: ExerciseResponse[], durationMs: number) => void
}

type Step =
  | { kind: 'cold' }
  | { kind: 'quiz' }
  | { kind: 'pass-intro'; pass: number }
  | { kind: 'pass'; pass: number }

const PASS_INTRO: Record<number, { title: string; text: string }> = {
  2: {
    title: 'Noch einmal lesen',
    text: 'Jetzt kennst du den Text schon. Lies ihn noch einmal – die Wörter verschwinden dabei nach und nach.',
  },
  3: {
    title: 'Ein letztes Mal',
    text: 'Du wirst immer flüssiger! Lies den Text ein drittes Mal, ein kleines bisschen schneller.',
  },
}

/** Wiederholtes Lesen im Dreischritt am selben Text:
 *  1. kalt im eigenen Tempo (liefert Messwert) → Verständnisfragen →
 *  2./3. Fading-Durchgänge mit leicht steigendem Tempo. Erfolgserlebnis durch Vertrautheit. */
export function RepeatedReadingExercise({ exercise, isPaused, onComplete }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'cold' })
  const [coldReadMs, setColdReadMs] = useState<number | null>(null)
  const startMsRef = useRef(Date.now())
  const passStartMsRef = useRef(Date.now())
  // Ergebnisse in Refs, damit die (stabilen) Callbacks nie veraltete Werte sehen
  const coldReadMsRef = useRef(0)
  const answersRef = useRef<ExerciseResponse[]>([])
  const passesRef = useRef<ExerciseResponse[]>([])
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const coldReadWpm = coldReadMs && coldReadMs > 0
    ? exercise.text.wordCount / (coldReadMs / 60_000)
    : null
  const passWpms = useMemo(
    () => repeatedReadingPassWpm(exercise.fadingTargetWpm, coldReadWpm, exercise.passConfig),
    [exercise.fadingTargetWpm, exercise.passConfig, coldReadWpm],
  )
  const lastPass = passWpms.length + 1

  const finish = useCallback(() => {
    onCompleteRef.current(
      [
        { event: 'READING_DONE', wordCount: exercise.text.wordCount, durationMs: coldReadMsRef.current },
        ...answersRef.current,
        ...passesRef.current,
      ],
      Date.now() - startMsRef.current,
    )
  }, [exercise.text.wordCount])

  const handleColdDone = useCallback((durationMs: number) => {
    coldReadMsRef.current = durationMs
    setColdReadMs(durationMs)
    setStep({ kind: 'quiz' })
  }, [])

  const handleQuizDone = useCallback((answers: ExerciseResponse[]) => {
    answersRef.current = answers
    if (lastPass < 2) finish()
    else setStep({ kind: 'pass-intro', pass: 2 })
  }, [finish, lastPass])

  // Muss während eines Durchgangs stabil bleiben – FadingReader startet sonst neu
  const currentPass = step.kind === 'pass' ? step.pass : null
  const handlePassDone = useCallback(() => {
    if (currentPass === null) return
    passesRef.current = [
      ...passesRef.current,
      {
        event: 'READING_PASS',
        pass: currentPass,
        wpm: passWpms[currentPass - 2]!,
        durationMs: Date.now() - passStartMsRef.current,
      },
    ]
    if (currentPass >= lastPass) finish()
    else setStep({ kind: 'pass-intro', pass: currentPass + 1 })
  }, [currentPass, passWpms, lastPass, finish])

  const passLabel = (pass: number) => (
    <p className="text-sm font-semibold text-primary text-center mb-4">
      {pass}. Lesen von {lastPass}
    </p>
  )

  if (step.kind === 'cold') {
    return (
      <div>
        {passLabel(1)}
        <SelfPacedReader text={exercise.text.content} onComplete={handleColdDone} />
      </div>
    )
  }

  if (step.kind === 'quiz') {
    return <QuizView questions={exercise.questions} text={exercise.text.content} onComplete={handleQuizDone} />
  }

  if (step.kind === 'pass-intro') {
    const intro = PASS_INTRO[step.pass] ?? PASS_INTRO[3]!
    return (
      <div className="flex flex-col items-center justify-center gap-6 min-h-[50vh] text-center max-w-sm mx-auto">
        {passLabel(step.pass)}
        <h2 className="text-2xl font-bold text-primary">{intro.title}</h2>
        <p className="text-gray-700 leading-relaxed">{intro.text}</p>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            passStartMsRef.current = Date.now()
            setStep({ kind: 'pass', pass: step.pass })
          }}
        >
          Los geht&apos;s
        </Button>
      </div>
    )
  }

  const wpm = passWpms[step.pass - 2]
  if (wpm === undefined) return null
  return (
    <div>
      {passLabel(step.pass)}
      <FadingReader
        key={step.pass}
        text={exercise.text.content}
        targetWpm={wpm}
        isPaused={isPaused}
        onComplete={handlePassDone}
      />
    </div>
  )
}
