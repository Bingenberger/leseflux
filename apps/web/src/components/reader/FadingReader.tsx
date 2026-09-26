import { useEffect, useMemo, useRef, useState } from 'react'
import { buildFadingSchedule, splitIntoWords } from '@leseflux/shared'
import { useSettingsStore, fontSizeClass } from '../../store/settingsStore.ts'
import { SyllableWord } from './SyllableWord.tsx'

interface Props {
  text: string
  targetWpm: number
  isPaused: boolean
  onComplete: () => void
}

export function FadingReader({ text, targetWpm, isPaused, onComplete }: Props) {
  const words = useMemo(() => splitIntoWords(text), [text])
  const fontSize = useSettingsStore((s) => s.fontSize)

  // Zeitpunkt (ms ab Start), ab dem jedes Wort zu verblassen beginnt – Gesamtdauer entspricht dem Zieltempo
  const schedule = useMemo(() => {
    const { fadeStartMs, fadeMs, totalMs } = buildFadingSchedule(targetWpm, words)
    return { startAt: fadeStartMs, fadeMs, totalMs: totalMs + 200 }
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
            <SyllableWord word={word} />
          </span>
        )
      })}
    </div>
  )
}
