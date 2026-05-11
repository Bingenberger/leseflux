import { useEffect, useRef, useState } from 'react'
import { Button } from '../shared/Button.tsx'
import { useSettingsStore } from '../../store/settingsStore.ts'
import type { FlashWordExercise as FlashWordExerciseData } from '../../lib/api.ts'

interface FlashResponse {
  itemId: string
  word: string
  selectedWord: string
  isCorrect: boolean
  responseTimeMs: number
}

interface Props {
  exercise: FlashWordExerciseData
  onComplete: (responses: FlashResponse[], durationMs: number) => void
}

export function FlashWordExercise({ exercise, onComplete }: Props) {
  const { lrsMode } = useSettingsStore()
  const displayMs = Math.round(exercise.flashDurationMs * (lrsMode ? 1.5 : 1))
  const [index, setIndex] = useState(0)
  const [showWord, setShowWord] = useState(true)
  const [responses, setResponses] = useState<FlashResponse[]>([])
  const startMsRef = useRef(Date.now())
  const itemStartMsRef = useRef(Date.now())

  const current = exercise.words[index]

  useEffect(() => {
    setShowWord(true)
    itemStartMsRef.current = Date.now()
    const id = window.setTimeout(() => setShowWord(false), displayMs)
    return () => window.clearTimeout(id)
  }, [index, displayMs])

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh] text-center">
        <p className="text-xl text-gray-600">Keine Wortblitz-Wörter verfügbar.</p>
        <Button onClick={() => onComplete(responses, Date.now() - startMsRef.current)}>
          Weiter
        </Button>
      </div>
    )
  }

  const choose = (selectedWord: string) => {
    const next = [
      ...responses,
      {
        itemId: current.id,
        word: current.word,
        selectedWord,
        isCorrect: selectedWord === current.word,
        responseTimeMs: Date.now() - itemStartMsRef.current,
      },
    ]
    setResponses(next)

    if (index >= exercise.words.length - 1) {
      onComplete(next, Date.now() - startMsRef.current)
    } else {
      setIndex((i) => i + 1)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 min-h-[60vh] text-center">
      <div className="text-sm font-semibold text-primary">
        Wortblitz {index + 1} / {exercise.words.length}
      </div>

      <div className="h-28 flex items-center justify-center">
        {showWord ? (
          <div className="text-5xl font-black tracking-wide text-gray-950">{current.word}</div>
        ) : (
          <div className="text-2xl font-semibold text-gray-400">Welches Wort war es?</div>
        )}
      </div>

      {!showWord && (
        <div className="grid gap-3 w-full max-w-sm">
          {current.options.map((option) => (
            <Button key={option} size="lg" onClick={() => choose(option)} className="w-full">
              {option}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
