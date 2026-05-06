import { useCallback, useEffect, useRef, useState } from 'react'
import { calculateFadingTiming, splitIntoWords } from '@leseflux/shared'
import { useSettingsStore, fontSizeClass } from '../../store/settingsStore.ts'

interface Props {
  text: string
  targetWpm: number
  isPaused: boolean
  onComplete: () => void
}

type WordState = 'hidden' | 'visible' | 'fading'

export function FadingReader({ text, targetWpm, isPaused, onComplete }: Props) {
  const words = splitIntoWords(text)
  const { fontSize } = useSettingsStore()

  const [states, setStates] = useState<WordState[]>(() =>
    words.map((_, i) => (i === 0 ? 'visible' : 'hidden')),
  )
  const [currentIndex, setCurrentIndex] = useState(0)

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const startTimeRef = useRef<number>(Date.now())
  const remainingMsRef = useRef<number | null>(null)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  const scheduleAdvance = useCallback(
    (index: number, delayMs: number) => {
      clearTimeout(timeoutRef.current)
      startTimeRef.current = Date.now()
      remainingMsRef.current = null

      timeoutRef.current = setTimeout(() => {
        if (isPausedRef.current) return

        setStates((prev) => {
          const next = [...prev] as WordState[]
          next[index] = 'fading'
          if (index + 1 < words.length) next[index + 1] = 'visible'
          return next
        })
        setCurrentIndex(index + 1)
      }, delayMs)
    },
    [words.length],
  )

  // Pause: aktiven Timeout einfrieren
  useEffect(() => {
    if (isPaused) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        const elapsed = Date.now() - startTimeRef.current
        const word = words[currentIndex] ?? ''
        const { displayMs } = calculateFadingTiming(targetWpm, word)
        remainingMsRef.current = Math.max(0, displayMs - elapsed)
      }
    } else if (remainingMsRef.current !== null) {
      // Fortsetzen mit verbleibender Zeit
      scheduleAdvance(currentIndex, remainingMsRef.current)
    }
  }, [isPaused, currentIndex, targetWpm, words, scheduleAdvance])

  // Nächstes Wort planen
  useEffect(() => {
    if (isPaused) return
    if (currentIndex >= words.length) {
      // Letztes Wort ausgeblendet – dann fertig
      const lastWord = words[words.length - 1] ?? ''
      const { fadeOutMs } = calculateFadingTiming(targetWpm, lastWord)
      timeoutRef.current = setTimeout(onComplete, fadeOutMs + 100)
      return
    }

    const word = words[currentIndex] ?? ''
    const { displayMs } = calculateFadingTiming(targetWpm, word)
    scheduleAdvance(currentIndex, displayMs)

    return () => clearTimeout(timeoutRef.current)
  }, [currentIndex, isPaused, words, targetWpm, scheduleAdvance, onComplete])

  return (
    <div
      className={[
        'leading-loose text-gray-900 select-none',
        fontSizeClass[fontSize],
      ].join(' ')}
      aria-live="polite"
      aria-label="Lesetext"
    >
      {words.map((word, i) => {
        const state = states[i]!
        const { fadeOutMs } = calculateFadingTiming(targetWpm, word)

        return (
          <span
            key={i}
            className="inline-block mr-[0.3em]"
            style={{
              opacity: state === 'hidden' ? 0 : 1,
              transition: state === 'fading' ? `opacity ${fadeOutMs}ms linear` : 'none',
              // Bereits vollständig ausgeblendet: kein Platz wegnehmen durch Farbwechsel
            }}
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}
