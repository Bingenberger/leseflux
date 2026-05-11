import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateFadingTiming, splitIntoWords } from '@leseflux/shared'
import { useSettingsStore, fontSizeClass } from '../../store/settingsStore.ts'
import { syllabify } from '../../lib/syllables.ts'

interface Props {
  text: string
  targetWpm: number
  isPaused: boolean
  onComplete: () => void
}

function SyllableWord({ word, lrsMode }: { word: string; lrsMode: boolean }) {
  if (!lrsMode) return <>{word}</>
  const parts = syllabify(word)
  return (
    <>
      {parts.map((syl, i) => (
        <span key={i} className={i % 2 === 0 ? 'text-primary' : 'text-success'}>
          {syl}
        </span>
      ))}
    </>
  )
}

export function FadingReader({ text, targetWpm, isPaused, onComplete }: Props) {
  const words = useMemo(() => splitIntoWords(text), [text])
  const { fontSize, lrsMode } = useSettingsStore()

  // Zeitpunkt (ms ab Start), ab dem jedes Wort zu verblassen beginnt
  const schedule = useMemo(() => {
    let t = 0
    const startAt: number[] = []
    const fadeMs: number[] = []
    for (const word of words) {
      startAt.push(t)
      const { displayMs, fadeOutMs } = calculateFadingTiming(targetWpm, word)
      fadeMs.push(fadeOutMs)
      t += displayMs
    }
    const lastFadeMs = fadeMs[fadeMs.length - 1] ?? 300
    return { startAt, fadeMs, totalMs: t + lastFadeMs + 200 }
  }, [words, targetWpm])

  // Wie viele Wörter haben bereits begonnen zu verblassen
  const [fadedCount, setFadedCount] = useState(0)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    setFadedCount(0)
    let elapsed = 0

    const id = setInterval(() => {
      if (isPausedRef.current) return
      elapsed += 50

      // Wörter, deren Startzeit erreicht ist
      let count = 0
      for (const t of schedule.startAt) {
        if (elapsed >= t) count++
        else break
      }
      setFadedCount(count)

      if (!doneRef.current && elapsed >= schedule.totalMs) {
        doneRef.current = true
        onComplete()
        clearInterval(id)
      }
    }, 50)

    return () => clearInterval(id)
  }, [schedule, onComplete])

  return (
    <div
      className={['leading-loose text-gray-900 select-none', fontSizeClass[fontSize]].join(' ')}
      aria-label="Lesetext"
    >
      {words.map((word, i) => {
        const fading = i < fadedCount
        return (
          <span
            key={i}
            className="inline-block mr-[0.3em]"
            style={{
              opacity: fading ? 0 : 1,
              transition: fading ? `opacity ${schedule.fadeMs[i]}ms linear` : 'none',
            }}
          >
            <SyllableWord word={word} lrsMode={lrsMode} />
          </span>
        )
      })}
    </div>
  )
}
