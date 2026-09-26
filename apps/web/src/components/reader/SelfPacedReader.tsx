import { useRef } from 'react'
import { splitIntoWords } from '@leseflux/shared'
import { Button } from '../shared/Button.tsx'
import { fontSizeClass, useSettingsStore } from '../../store/settingsStore.ts'
import { SyllableWord } from './SyllableWord.tsx'

interface Props {
  text: string
  onComplete: (durationMs: number) => void
}

export function SelfPacedReader({ text, onComplete }: Props) {
  const startMsRef = useRef(Date.now())
  const fontSize = useSettingsStore((s) => s.fontSize)
  const words = splitIntoWords(text)

  return (
    <div className="flex flex-col gap-6">
      <div
        className={['leading-loose text-gray-900', fontSizeClass[fontSize]].join(' ')}
        aria-label="Lesetext im eigenen Tempo"
      >
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="inline-block mr-[0.3em]">
            <SyllableWord word={word} />
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
