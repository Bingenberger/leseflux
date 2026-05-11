import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { WpmChart, AccuracyChart, ExerciseAccuracyChart } from '../../components/teacher/ProgressChart.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import {
  exportStudentCsv,
  exportStudentJson,
  getSessionTemplates,
  getStudentDetail,
  getStudentDiagnostics,
  getStudentExercises,
  getStudentSessions,
  regenerateStudentCode,
  updateStudentTemplate,
} from '../../lib/api.ts'
import type { DiagnosticResultDetail, ExerciseType } from '../../lib/api.ts'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

const DIFFICULTY_LABEL: Record<number, string> = { 1: 'leicht', 2: 'mittel', 3: 'schwer' }
const TABS = ['overview', 'exercises', 'sessions', 'diagnostics', 'flags'] as const
type Tab = typeof TABS[number]

const TAB_LABEL: Record<Tab, string> = {
  overview: 'Übersicht',
  exercises: 'Übungstypen',
  sessions: 'Sitzungen',
  diagnostics: 'Diagnostik',
  flags: 'Auffälligkeiten',
}

const EXERCISE_TYPES: ExerciseType[] = ['FLASH_WORD', 'FADING', 'CLOZE', 'SELF_PACED']
const EXERCISE_LABEL: Record<ExerciseType, string> = {
  FLASH_WORD: 'Wortblitz',
  FADING: 'Fading',
  CLOZE: 'Lückentext',
  SELF_PACED: 'Eigentempo',
}

function DiagnosticCard({ result }: { result: DiagnosticResultDetail }) {
  const [open, setOpen] = useState(false)
  const total = result.correctCount + result.wrongCount + result.skippedCount
  const accuracy = total > 0 ? Math.round((result.correctCount / total) * 100) : 0

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-3">
          <span className={[
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            result.type === 'ENTRY' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700',
          ].join(' ')}>
            {result.type === 'ENTRY' ? 'Eingang' : 'Zwischen'}
          </span>
          <span className="text-sm text-gray-700 font-medium">
            {new Date(result.startedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-600">
          {result.estimatedWpm !== null && (
            <span className="font-bold text-primary">{Math.round(result.estimatedWpm)} WPM</span>
          )}
          <span className="text-gray-500">
            {result.correctCount}✓ {result.wrongCount}✗ {result.skippedCount}–
          </span>
          <span className={[
            'font-semibold',
            accuracy >= 70 ? 'text-success' : accuracy < 40 ? 'text-warning' : 'text-gray-700',
          ].join(' ')}>
            {accuracy} %
          </span>
          <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
            <PhosphorIcon name={open ? 'x' : 'listChecks'} size={13} />
            {open ? 'Schließen' : 'Details'}
          </span>
        </div>
      </button>

      {/* Detail */}
      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Satz</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600">Typ</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600">Stufe</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600">Antwort</th>
                <th className="text-center px-3 py-2 font-medium text-gray-600">Ergebnis</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Zeit</th>
              </tr>
            </thead>
            <tbody>
              {result.answers.map((a, i) => (
                <tr key={i} className={['border-t border-gray-100', a.isCorrect ? '' : 'bg-red-50'].join(' ')}>
                  <td className="px-4 py-2 text-gray-800">{a.sentence}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={[
                      'text-xs px-1.5 py-0.5 rounded',
                      a.isNonsense ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700',
                    ].join(' ')}>
                      {a.isNonsense ? 'Unsinn' : 'Sinn'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">
                    {DIFFICULTY_LABEL[a.difficulty] ?? a.difficulty}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-600">
                    {a.answer === 'TRUE' ? 'Stimmt' : a.answer === 'FALSE' ? 'Stimmt nicht' : 'Übersprungen'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {a.answer === 'SKIP'
                      ? <span className="text-gray-400">–</span>
                      : a.isCorrect
                        ? <span className="text-success font-bold">✓</span>
                        : <span className="text-warning font-bold">✗</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-500 tabular-nums">
                    {(a.responseTimeMs / 1000).toFixed(1)} s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['student-detail', id],
    queryFn: () => getStudentDetail(id!).then((r) => r.data),
    enabled: !!id,
  })

  const { data: sessions, isLoading: loadingSessions } = useQuery({
    queryKey: ['student-sessions', id],
    queryFn: () => getStudentSessions(id!).then((r) => r.data),
    enabled: !!id,
  })

  const { data: diagnostics } = useQuery({
    queryKey: ['student-diagnostics', id],
    queryFn: () => getStudentDiagnostics(id!).then((r) => r.data),
    enabled: !!id,
  })

  const { data: exercises } = useQuery({
    queryKey: ['student-exercises', id],
    queryFn: () => getStudentExercises(id!, 'ALL').then((r) => r.data),
    enabled: !!id,
  })

  const { data: templates } = useQuery({
    queryKey: ['session-templates'],
    queryFn: () => getSessionTemplates().then((r) => r.data),
    enabled: !!id,
  })

  const isLoading = loadingStudent || loadingSessions

  const regenCode = useMutation({
    mutationFn: () => regenerateStudentCode(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-detail', id] }),
  })

  const templateMutation = useMutation({
    mutationFn: (sessionTemplateId: string | null) => updateStudentTemplate(id!, sessionTemplateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['student-sessions', id] })
    },
  })

  const handleExport = async (format: 'json' | 'csv') => {
    const fn = format === 'json' ? exportStudentJson : exportStudentCsv
    const res = await fn(id!)
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leseflux-export-${student?.displayName ?? id}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <TeacherLayout title="Schüler">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <PhosphorIcon name="arrowLeft" size={16} />
          Zurück
        </button>
        <h2 className="text-2xl font-bold text-gray-900">
          {student?.displayName ?? '…'}
        </h2>
      </div>

      {isLoading && <p className="text-gray-500">Lade Daten...</p>}

      {student && (
        <div className="flex flex-col gap-6">
          {/* Kennzahlen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Zieltempo"
              value={student.currentTargetWpm ? `${student.currentTargetWpm} WPM` : '–'}
            />
            <StatCard label="Sitzungen" value={String(student.totalSessions)} />
            <StatCard
              label="Ø Genauigkeit"
              value={
                student.averageQuizAccuracy !== null
                  ? `${Math.round(student.averageQuizAccuracy * 100)} %`
                  : '–'
              }
            />
            <StatCard
              label="Letzte Sitzung"
              value={
                student.lastSessionAt
                  ? new Date(student.lastSessionAt).toLocaleDateString('de-DE')
                  : '–'
              }
            />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px',
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800',
                ].join(' ')}
              >
                <PhosphorIcon name="listChecks" size={15} />
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>

          {/* Login-Code */}
          {activeTab === 'overview' && <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                Login-Code (Testphase)
              </p>
              <p className="text-3xl font-bold tracking-[0.25em] text-primary">
                {student.loginCode ?? '–'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Kinder können sich damit ohne QR-Code anmelden.
              </p>
            </div>
            <button
              onClick={() => regenCode.mutate()}
              disabled={regenCode.isPending}
              className="inline-flex shrink-0 items-center gap-2 text-sm text-primary border border-primary rounded-lg px-4 py-2 hover:bg-blue-50 disabled:opacity-50"
            >
              <PhosphorIcon name="arrowClockwise" size={16} />
              {regenCode.isPending ? '…' : 'Neu generieren'}
            </button>
          </div>}

          {activeTab === 'overview' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Individuelle Trainingsvorlage
                </p>
                <p className="text-sm text-gray-500">
                  Überschreibt die Klassenvorlage für normale Trainingstage. Messtage bleiben automatisch aktiv.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Klasse: {student.className ?? '–'} · Klassenvorlage: {
                    student.classSessionTemplateId ? 'gesetzt' : 'System-Standard'
                  }
                </p>
              </div>
              <select
                value={student.sessionTemplateId ?? ''}
                onChange={(e) => templateMutation.mutate(e.target.value || null)}
                disabled={!templates || templateMutation.isPending}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-64 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Klassenvorlage verwenden</option>
                {templates?.filter((template) => template.id !== 'measurement-day').map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}{template.teacherId ? ' (privat)' : ' (schulweit)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Charts */}
          {activeTab === 'overview' && sessions && sessions.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">WPM-Verlauf</h3>
                <WpmChart sessions={sessions} />
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Quiz-Genauigkeit
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Grüne Linie = 70 % (gut), orange Linie = 40 % (Anpassung nötig)
                </p>
                <AccuracyChart sessions={sessions} />
              </div>
            </>
          )}

          {activeTab === 'exercises' && exercises && (
            <div className="grid md:grid-cols-2 gap-4">
              {EXERCISE_TYPES.map((type) => {
                const runs = exercises.filter((r) => r.exerciseType === type)
                const latest = runs[0]
                return (
                  <div key={type} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">{EXERCISE_LABEL[type]}</h3>
                        <p className="text-xs text-gray-400">{runs.length} Durchläufe</p>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {latest?.accuracy !== null && latest?.accuracy !== undefined
                          ? `${Math.round(latest.accuracy * 100)} %`
                          : latest?.measuredWpm
                            ? `${Math.round(latest.measuredWpm)} WPM`
                            : '–'}
                      </span>
                    </div>
                    <ExerciseAccuracyChart runs={exercises} type={type} />
                  </div>
                )
              })}
            </div>
          )}

          {/* Diagnostikergebnisse */}
          {activeTab === 'diagnostics' && diagnostics && diagnostics.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Diagnostikergebnisse</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Auf eine Zeile klicken, um alle Einzelantworten zu sehen.
                </p>
              </div>
              <div className="flex flex-col divide-y divide-gray-100">
                {diagnostics.map((d) => (
                  <DiagnosticCard key={d.id} result={d} />
                ))}
              </div>
            </div>
          )}

          {/* Sitzungstabelle */}
          {activeTab === 'sessions' && sessions && sessions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Sitzungsverlauf</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Datum</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Text</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">WPM</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Genauigkeit</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-600">Dauer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-t border-gray-100">
                        <td className="px-4 py-2 text-gray-700">
                          {new Date(s.startedAt).toLocaleDateString('de-DE')}
                        </td>
                        <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate">
                          {s.textTitle}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {s.measuredWpm !== null ? `${Math.round(s.measuredWpm)} gemessen` : s.targetWpm}
                          {s.wpmFlag === 'UNREALISTIC' && (
                            <span className="ml-2 text-warning font-semibold">!</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {s.quizAccuracy !== null
                            ? `${Math.round(s.quizAccuracy * 100)} %`
                            : '–'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {s.durationMs
                            ? `${Math.round(s.durationMs / 60000)} Min`
                            : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'flags' && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Auffälligkeiten</h3>
              {exercises?.some((r) => r.wpmFlag === 'UNREALISTIC') ? (
                <div className="flex flex-col divide-y divide-gray-100">
                  {exercises.filter((r) => r.wpmFlag === 'UNREALISTIC').map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">{EXERCISE_LABEL[r.exerciseType]}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(r.startedAt).toLocaleDateString('de-DE')} · {r.textTitle ?? 'ohne Text'}
                        </p>
                      </div>
                      <span className="text-warning font-bold">{Math.round(r.measuredWpm ?? 0)} WPM</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Keine auffälligen Messwerte.</p>
              )}
            </div>
          )}

          {activeTab === 'sessions' && sessions && sessions.length === 0 && (
            <p className="text-gray-400 text-center py-12">
              Dieser Schüler hat noch keine Sitzungen absolviert.
            </p>
          )}

          {/* DSGVO-Export */}
          {activeTab === 'overview' && <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Datenschutz-Export (DSGVO)</h3>
            <p className="text-xs text-gray-400 mb-4">
              Art. 15 / Art. 20 – alle gespeicherten Daten dieses Schülers herunterladen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('json')}
                className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
              >
                <PhosphorIcon name="download" size={16} />
                JSON herunterladen
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
              >
                <PhosphorIcon name="download" size={16} />
                CSV herunterladen
              </button>
            </div>
          </div>}
        </div>
      )}
    </TeacherLayout>
  )
}
