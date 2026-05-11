import { useState, useEffect, useRef, useCallback } from 'react'
import type { DiagnosticItem } from '../../lib/api.ts'

interface DiagnosticAnswer {
  itemId: string
  answer: 'TRUE' | 'FALSE' | 'SKIP'
  responseTimeMs: number
}

interface Props {
  items: DiagnosticItem[]
  durationSec: number
  onComplete: (answers: DiagnosticAnswer[], durationMs: number) => void
}

export function DiagnosticView({ items, durationSec, onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timeLeft, setTimeLeft] = useState(durationSec)
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([])
  const [finished, setFinished] = useState(false)

  const startMs = useRef(Date.now())
  const itemStartMs = useRef(Date.now())
  const answersRef = useRef<DiagnosticAnswer[]>([])
  const finishedRef = useRef(false)

  const complete = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setFinished(true)
    onComplete(answersRef.current, Date.now() - startMs.current)
  }, [onComplete])

  // Countdown timer
  useEffect(() => {
    if (finished) return
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          complete()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [finished, complete])

  const handleAnswer = (answer: 'TRUE' | 'FALSE') => {
    if (finished || currentIndex >= items.length) return

    const item = items[currentIndex]!
    const newAnswer: DiagnosticAnswer = {
      itemId: item.id,
      answer,
      responseTimeMs: Date.now() - itemStartMs.current,
    }

    const updated = [...answersRef.current, newAnswer]
    answersRef.current = updated
    setAnswers(updated)

    if (currentIndex + 1 >= items.length) {
      complete()
    } else {
      itemStartMs.current = Date.now()
      setCurrentIndex((i) => i + 1)
    }
  }

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const progress = (durationSec - timeLeft) / durationSec
  const currentItem = items[currentIndex]

  if (finished || !currentItem) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xl text-primary animate-pulse">Auswertung läuft...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-lg mx-auto p-6">
      {/* Timer + Fortschritt */}
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-primary tabular-nums">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
        <span className="text-sm text-gray-500">
          {currentIndex + 1} / {items.length}
        </span>
      </div>

      {/* Zeitbalken */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-linear"
          style={{ width: `${(1 - progress) * 100}%` }}
        />
      </div>

      {/* Satz */}
      <div className="flex-1 flex items-center justify-center min-h-[160px] bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-10">
        <p className="text-2xl font-semibold text-gray-900 text-center leading-relaxed">
          {currentItem.sentence}
        </p>
      </div>

      {/* Antwort-Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => handleAnswer('FALSE')}
          className="flex-1 rounded-2xl border-2 border-warning bg-orange-50 text-warning text-xl font-bold py-6 min-h-[80px] active:scale-95 transition-transform hover:bg-orange-100"
        >
          Stimmt nicht!
        </button>
        <button
          onClick={() => handleAnswer('TRUE')}
          className="flex-1 rounded-2xl border-2 border-success bg-green-50 text-success text-xl font-bold py-6 min-h-[80px] active:scale-95 transition-transform hover:bg-green-100"
        >
          Stimmt!
        </button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Macht der Satz Sinn? Tippe schnell!
      </p>
    </div>
  )
}
