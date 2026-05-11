import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { DiagnosticView } from '../../components/diagnostic/DiagnosticView.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { startDiagnostic, finishDiagnostic } from '../../lib/api.ts'
import type { DiagnosticItem, FinishDiagnosticPayload } from '../../lib/api.ts'

type Phase = 'loading' | 'intro' | 'test' | 'result' | 'error'

export default function DiagnosticPage() {
  const { type } = useParams<{ type: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [phase, setPhase] = useState<Phase>('loading')
  const [resultId, setResultId] = useState('')
  const [items, setItems] = useState<DiagnosticItem[]>([])
  const [durationSec, setDurationSec] = useState(90)
  const [estimatedWpm, setEstimatedWpm] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const diagnosticType = type === 'intermediate' ? 'INTERMEDIATE' : 'ENTRY'
  const isEntry = diagnosticType === 'ENTRY'
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startDiagnostic(diagnosticType)
      .then(({ data }) => {
        setResultId(data.resultId)
        setItems(data.items)
        setDurationSec(data.durationSec)
        setPhase('intro')
      })
      .catch(() => {
        setErrorMsg('Lesetest konnte nicht gestartet werden.')
        setPhase('error')
      })
  }, [diagnosticType])

  const handleComplete = async (
    answers: FinishDiagnosticPayload['answers'],
    durationMs: number,
  ) => {
    try {
      const { data } = await finishDiagnostic(resultId, { answers, durationMs })
      setEstimatedWpm(data.estimatedWpm)
    } catch {
      setEstimatedWpm(null)
    }
    // Cache invalidieren, damit HomePage sofort den neuen Status kennt
    await queryClient.invalidateQueries({ queryKey: ['diagnostic-check'] })
    await queryClient.invalidateQueries({ queryKey: ['my-progress'] })
    setPhase('result')
  }

  if (phase === 'loading') {
    return (
      <ChildLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xl text-primary animate-pulse">Lesetest wird vorbereitet...</p>
        </div>
      </ChildLayout>
    )
  }

  if (phase === 'error') {
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <p className="text-warning text-xl text-center">{errorMsg}</p>
          <Button onClick={() => navigate('/child/home')}>Zurück</Button>
        </div>
      </ChildLayout>
    )
  }

  if (phase === 'intro') {
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 max-w-lg mx-auto w-full">
          <div className="text-center flex flex-col gap-3">
            <h2 className="text-3xl font-bold text-primary">
              {isEntry ? 'Willkommen!' : 'Kurzer Lesetest'}
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              {isEntry
                ? 'Bevor du anfängst, machen wir einen kurzen Lesetest – das dauert nur etwa eine Minute!'
                : 'Mach einen kurzen Lesetest, damit wir dein Lesetempo anpassen können.'}
            </p>
          </div>

          <div className="bg-blue-50 border border-primary/20 rounded-2xl p-6 w-full flex flex-col gap-3">
            <p className="font-semibold text-gray-800">So geht es:</p>
            <ul className="text-gray-700 flex flex-col gap-2">
              <li>📖 Lies jeden Satz durch.</li>
              <li>✅ Macht er Sinn? → Tippe <strong>„Stimmt!"</strong></li>
              <li>❌ Macht er keinen Sinn? → Tippe <strong>„Stimmt nicht!"</strong></li>
              <li>⏱ Du hast <strong>{durationSec} Sekunden</strong> Zeit.</li>
            </ul>
          </div>

          <Button size="lg" onClick={() => setPhase('test')} className="w-full">
            Los geht's!
          </Button>
        </div>
      </ChildLayout>
    )
  }

  if (phase === 'test') {
    return (
      <ChildLayout>
        <div className="flex-1 flex flex-col">
          <DiagnosticView
            items={items}
            durationSec={durationSec}
            onComplete={handleComplete}
          />
        </div>
      </ChildLayout>
    )
  }

  // result
  return (
    <ChildLayout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-bold text-primary text-center">Super gemacht!</h2>
        {estimatedWpm && (
          <p className="text-xl text-gray-700 text-center">
            Dein Lesetempo: ca. <strong className="text-primary">{estimatedWpm} Wörter/Minute</strong>
          </p>
        )}
        <p className="text-gray-500 text-center">
          {isEntry
            ? 'Jetzt kann es losgehen – viel Spaß beim Lesen!'
            : 'Dein Lesetraining wurde angepasst.'}
        </p>
        <Button size="lg" onClick={() => navigate('/child/home')}>
          Weiter
        </Button>
      </div>
    </ChildLayout>
  )
}
