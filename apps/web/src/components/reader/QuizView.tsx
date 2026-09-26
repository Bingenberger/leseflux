import { useState } from 'react'
import { findAnswerSentence } from '@leseflux/shared'
import { Button } from '../shared/Button.tsx'
import type { SessionQuestion } from '../../lib/api.ts'

interface Answer {
  questionId: string
  selectedIndex: number
  responseTimeMs: number
}

interface Props {
  questions: SessionQuestion[]
  /** Lesetext – bei einer falschen Antwort wird die passende Textstelle eingeblendet */
  text?: string
  onComplete: (answers: Answer[]) => void
}

/** Wartezeit nach einer richtigen Antwort, bevor die nächste Frage kommt */
const CORRECT_ADVANCE_MS = 1400

export function QuizView({ questions, text, onComplete }: Props) {
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

    // Richtig: automatisch weiter. Falsch: das Kind liest die Textstelle und tippt selbst auf „Weiter“.
    if (index === currentQ.correctIndex) {
      setTimeout(() => advance(updated), CORRECT_ADVANCE_MS)
    }
  }

  const advance = (updated: Answer[]) => {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex((q) => q + 1)
      setSelected(null)
      setShowFeedback(false)
      setQuestionStartTime(Date.now())
    } else {
      onComplete(updated)
    }
  }

  const isCorrectChoice = selected === currentQ.correctIndex
  const answerSentence = showFeedback && !isCorrectChoice && text
    ? findAnswerSentence(text, currentQ.question, currentQ.options[currentQ.correctIndex] ?? '')
    : null

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

      {showFeedback && isCorrectChoice && (
        <p className="text-center text-lg font-semibold text-success">Richtig! ✓</p>
      )}

      {showFeedback && !isCorrectChoice && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-lg font-semibold text-primary">Schau noch mal genau hin!</p>
          {answerSentence && (
            <div className="rounded-xl border-2 border-primary/30 bg-blue-50 px-5 py-4">
              <p className="text-sm font-semibold text-primary mb-1">Im Text steht:</p>
              <p className="text-lg text-gray-900 leading-relaxed">{answerSentence}</p>
            </div>
          )}
          <Button size="lg" className="w-full" onClick={() => advance(answers)}>
            Weiter
          </Button>
        </div>
      )}
    </div>
  )
}
