import { useRef } from 'react'
import { splitIntoWords } from '@leseflux/shared'
import { Button } from '../shared/Button.tsx'
import { fontSizeClass, useSettingsStore } from '../../store/settingsStore.ts'
import { syllabify } from '../../lib/syllables.ts'

interface Props {
  text: string
  onComplete: (durationMs: number) => void
}

function SyllableWord({ word, lrsMode }: { word: string; lrsMode: boolean }) {
  if (!lrsMode) return <>{word}</>
  return (
    <>
      {syllabify(word).map((part, index) => (
        <span key={index} className={index % 2 === 0 ? 'text-primary' : 'text-success'}>
          {part}
        </span>
      ))}
    </>
  )
}

export function SelfPacedReader({ text, onComplete }: Props) {
  const startMsRef = useRef(Date.now())
  const { fontSize, lrsMode } = useSettingsStore()
  const words = splitIntoWords(text)

  return (
    <div className="flex flex-col gap-6">
      <div
        className={['leading-loose text-gray-900', fontSizeClass[fontSize]].join(' ')}
        aria-label="Lesetext im eigenen Tempo"
      >
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="inline-block mr-[0.3em]">
            <SyllableWord word={word} lrsMode={lrsMode} />
          </span>
        ))}
      </div>

      <div className="sticky bottom-0 bg-white/95 border border-gray-100 rounded-2xl p-4 shadow-sm">
        <Button
          size="lg"
          className="w-full"
          onClick={() => onComplete(Date.now() - startMsRef.current)}
        >
          Fertig gelesen
        </Button>
      </div>
    </div>
  )
}
