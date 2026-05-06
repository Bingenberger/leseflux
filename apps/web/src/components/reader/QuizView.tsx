import { useState } from 'react'
import type { SessionQuestion } from '../../lib/api.ts'

interface Answer {
  questionId: string
  selectedIndex: number
  responseTimeMs: number
}

interface Props {
  questions: SessionQuestion[]
  onComplete: (answers: Answer[]) => void
}

export function QuizView({ questions, onComplete }: Props) {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [questionStartTime, setQuestionStartTime] = useState(() => Date.now())

  const currentQ = questions[questionIndex]!

  const handleSelect = (index: number) => {
    if (showFeedback) return
    setSelected(index)
    setShowFeedback(true)

    const newAnswer: Answer = {
      questionId: currentQ.id,
      selectedIndex: index,
      responseTimeMs: Date.now() - questionStartTime,
    }
    const updated = [...answers, newAnswer]
    setAnswers(updated)

    setTimeout(() => {
      if (questionIndex + 1 < questions.length) {
        setQuestionIndex((q) => q + 1)
        setSelected(null)
        setShowFeedback(false)
        setQuestionStartTime(Date.now())
      } else {
        onComplete(updated)
      }
    }, 1400)
  }

  const isCorrectChoice = selected === currentQ.correctIndex

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Frage {questionIndex + 1} von {questions.length}
        </p>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={[
                'h-2 w-6 rounded-full',
                i < questionIndex
                  ? 'bg-success'
                  : i === questionIndex
                  ? 'bg-primary'
                  : 'bg-gray-200',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      <p className="text-xl font-semibold text-gray-900 leading-snug">{currentQ.question}</p>

      <div className="flex flex-col gap-3">
        {currentQ.options.map((option, i) => {
          let extra = 'border-gray-200 bg-white hover:border-primary hover:bg-blue-50'
          if (showFeedback) {
            if (i === currentQ.correctIndex) {
              extra = 'border-success bg-green-50'
            } else if (i === selected) {
              extra = 'border-warning bg-orange-50'
            } else {
              extra = 'border-gray-200 bg-white opacity-50'
            }
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={showFeedback}
              className={[
                'text-left w-full rounded-xl border-2 px-5 py-4 text-lg font-medium transition-all min-h-[56px]',
                'active:bg-blue-100 disabled:cursor-not-allowed',
                extra,
              ].join(' ')}
            >
              <span className="mr-3 text-gray-400 font-bold">{String.fromCharCode(65 + i)}.</span>
              {option}
            </button>
          )
        })}
      </div>

      {showFeedback && (
        <p
          className={[
            'text-center text-lg font-semibold',
            isCorrectChoice ? 'text-success' : 'text-primary',
          ].join(' ')}
        >
          {isCorrectChoice ? 'Richtig! ✓' : 'Schau noch mal genau hin! ✓'}
        </p>
      )}
    </div>
  )
}
