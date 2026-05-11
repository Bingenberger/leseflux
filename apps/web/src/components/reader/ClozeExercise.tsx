import { useRef, useState } from 'react'
import { Button } from '../shared/Button.tsx'
import type { ClozeExercise as ClozeExerciseData, ExerciseResponse } from '../../lib/api.ts'
import { useSettingsStore } from '../../store/settingsStore.ts'
import { syllabify } from '../../lib/syllables.ts'

interface Props {
  exercise: ClozeExerciseData
  onComplete: (responses: ExerciseResponse[], durationMs: number) => void
}

function SyllableText({ word }: { word: string }) {
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

export function ClozeExercise({ exercise, onComplete }: Props) {
  const { lrsMode } = useSettingsStore()
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<ExerciseResponse[]>([])
  const startMsRef = useRef(Date.now())
  const itemStartMsRef = useRef(Date.now())

  const current = exercise.gaps[index]
  const gapByIndex = new Map(exercise.gaps.map((gap) => [gap.wordIndex, gap]))

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh] text-center">
        <p className="text-xl text-gray-600">Lückentext abgeschlossen.</p>
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
        gapId: current.id,
        wordIndex: current.wordIndex,
        correctWord: current.correctWord,
        selectedWord,
        isCorrect: selectedWord === current.correctWord,
        responseTimeMs: Date.now() - itemStartMsRef.current,
      },
    ]
    setResponses(next)

    if (index >= exercise.gaps.length - 1) {
      onComplete(next, Date.now() - startMsRef.current)
    } else {
      itemStartMsRef.current = Date.now()
      setIndex((i) => i + 1)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">Lückentext {index + 1} / {exercise.gaps.length}</p>
        <h2 className="text-xl font-bold text-gray-900">{exercise.text.title}</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 leading-loose text-xl shadow-sm">
        {exercise.words.map((word, wordIndex) => {
          const gap = gapByIndex.get(wordIndex)
          const answered = responses.find((r) => 'wordIndex' in r && r.wordIndex === wordIndex)
          const isCurrent = current.wordIndex === wordIndex
          if (gap) {
            return (
              <span
                key={`${word}-${wordIndex}`}
                className={[
                  'inline-flex min-w-20 justify-center mx-1 px-2 py-1 rounded-lg border font-bold',
                  isCurrent ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 bg-gray-50 text-gray-500',
                ].join(' ')}
              >
                {answered && 'selectedWord' in answered ? answered.selectedWord : '_____'}
              </span>
            )
          }
          return (
            <span key={`${word}-${wordIndex}`} className="mr-[0.3em]">
              {lrsMode ? <SyllableText word={word} /> : word}
            </span>
          )
        })}
      </div>

      <div className="grid gap-3">
        {current.options.map((option) => (
          <Button key={option} size="lg" onClick={() => choose(option)} className="w-full">
            {option}
          </Button>
        ))}
      </div>
    </div>
  )
}
