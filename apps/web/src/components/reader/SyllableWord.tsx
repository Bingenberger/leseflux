import { SYLLABLE_COLOR_VALUES, useSettingsStore } from '../../store/settingsStore.ts'
import { syllabify } from '../../lib/syllables.ts'

/** Ein Wort, bei eingeschalteter Silbenfärbung in abwechselnd gefärbten Sprechsilben. */
export function SyllableWord({ word }: { word: string }) {
  const syllableColors = useSettingsStore((s) => s.syllableColors)
  if (syllableColors === 'off') return <>{word}</>
  const [colorA, colorB] = SYLLABLE_COLOR_VALUES[syllableColors]
  return (
    <>
      {syllabify(word).map((part, i) => (
        <span key={i} style={{ color: i % 2 === 0 ? colorA : colorB }}>
          {part}
        </span>
      ))}
    </>
  )
}
