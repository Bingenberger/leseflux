import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChildLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { useAuthStore } from '../../store/authStore.ts'
import { useSettingsStore } from '../../store/settingsStore.ts'
import { checkDiagnostic, getMyProgress, getTodayProgram } from '../../lib/api.ts'
import type { ExerciseType } from '../../lib/api.ts'

const FONT_SIZES = [
  { value: 'normal' as const, label: 'A', className: 'text-base' },
  { value: 'large' as const, label: 'A', className: 'text-lg' },
  { value: 'xlarge' as const, label: 'A', className: 'text-xl' },
]

const EXERCISE_LABEL: Record<ExerciseType, string> = {
  FLASH_WORD: 'Wortblitz',
  FADING: 'Lesen mit Fading',
  CLOZE: 'Lückentext',
  SELF_PACED: 'Lesen im eigenen Tempo',
}

const EXERCISE_ICON: Record<ExerciseType, string> = {
  FLASH_WORD: '⚡',
  FADING: '📖',
  CLOZE: '🧩',
  SELF_PACED: '⏱',
}

function minutesLabel(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return `${minutes} Min.`
}

export default function ChildHomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lrsMode, toggleLrsMode, fontSize, setFontSize, highContrast, toggleHighContrast } =
    useSettingsStore()

  const { data: diagCheck } = useQuery({
    queryKey: ['diagnostic-check'],
    queryFn: () => checkDiagnostic().then((r) => r.data),
    staleTime: Infinity,
  })

  const { data: progress } = useQuery({
    queryKey: ['my-progress'],
    queryFn: () => getMyProgress().then((r) => r.data),
  })

  const needsEntry = diagCheck?.needsEntry ?? false
  const needsIntermediate = diagCheck?.needsIntermediate ?? false
  const todayDone = progress?.todayDone ?? false

  const { data: todayProgram } = useQuery({
    queryKey: ['today-program'],
    queryFn: () => getTodayProgram().then((r) => r.data),
    enabled: !needsEntry && !needsIntermediate && !todayDone,
  })

  const handleStart = () => {
    navigate('/child/session')
  }

  return (
    <ChildLayout>
      <div className="flex flex-col items-center justify-center flex-1 gap-8 p-8 max-w-lg mx-auto w-full">
        {/* Begrüßung */}
        <div className="text-center">
          <p className="text-lg text-gray-500">Hallo,</p>
          <h1 className="text-4xl font-bold text-primary">{user?.displayName}!</h1>
        </div>

        {/* Fortschritts-Info (nach Eingangstest) */}
        {progress && progress.currentTargetWpm !== null && (
          <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Mein Lesetempo</span>
              <span className="text-lg font-bold text-primary">
                {progress.currentTargetWpm} <span className="text-sm font-normal text-gray-500">Wörter/Min</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Nächstes Ziel</span>
              <span className="text-lg font-bold text-success">
                {progress.nextTargetWpm} <span className="text-sm font-normal text-gray-500">Wörter/Min</span>
              </span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Übungen bis zum nächsten Test</span>
              <span className="text-lg font-bold text-gray-700">{progress.sessionsUntilNextCheck}</span>
            </div>
          </div>
        )}

        {/* Gamification-Badges */}
        {progress && (progress.starCount > 0 || progress.totalSessions > 0) && (
          <div className="flex gap-3 w-full justify-center flex-wrap">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
              <span className="text-xl">⭐</span>
              <span className="font-bold text-amber-700">{progress.starCount}</span>
              <span className="text-sm text-amber-600">Sterne</span>
            </div>
            {progress.streakDays > 1 && (
              <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2">
                <span className="text-xl">🔥</span>
                <span className="font-bold text-orange-700">{progress.streakDays}</span>
                <span className="text-sm text-orange-600">Tage</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
              <span className="text-xl">📖</span>
              <span className="font-bold text-blue-700">{progress.totalSessions}</span>
              <span className="text-sm text-blue-600">Sitzungen</span>
            </div>
          </div>
        )}

        {/* Eingangstest / Zwischendiagnostik / Heute schon geübt / Trainings-Start */}
        {needsEntry ? (
          <div className="w-full bg-blue-50 border-2 border-primary rounded-2xl p-6 flex flex-col items-center gap-4">
            <span className="text-5xl">📋</span>
            <p className="text-xl font-bold text-primary text-center">Kurzer Lesetest</p>
            <p className="text-gray-600 text-center leading-relaxed">
              Bevor du lesen kannst, machen wir einen kurzen Test – das dauert nur etwa eine Minute!
            </p>
            <Button size="lg" onClick={() => navigate('/child/diagnostic/entry')} className="w-full">
              Jetzt Lesetest starten
            </Button>
          </div>
        ) : needsIntermediate ? (
          <div className="w-full bg-blue-50 border-2 border-primary rounded-2xl p-6 flex flex-col items-center gap-4">
            <span className="text-5xl">📋</span>
            <p className="text-xl font-bold text-primary text-center">Kurzer Lesetest</p>
            <p className="text-gray-600 text-center leading-relaxed">
              Heute machen wir zuerst einen kurzen Test – das dauert nur etwa eine Minute!
            </p>
            <Button size="lg" onClick={() => navigate('/child/diagnostic/intermediate')} className="w-full">
              Jetzt Lesetest starten
            </Button>
          </div>
        ) : todayDone ? (
          <div className="w-full bg-green-50 border-2 border-success rounded-2xl p-6 flex flex-col items-center gap-3">
            <span className="text-5xl">🎉</span>
            <p className="text-xl font-bold text-success text-center">Super! Für heute geschafft!</p>
            <p className="text-gray-600 text-center leading-relaxed">
              Du hast heute schon geübt. Komm morgen wieder – dein Lesetraining wartet auf dich!
            </p>
          </div>
        ) : (
          <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col gap-4">
            <div className="text-center">
              <p className="font-semibold text-gray-800">Dein Training heute</p>
              <p className="text-sm text-gray-500 mt-1">
                {todayProgram?.templateName ?? 'Tagesprogramm wird geladen…'}
                {todayProgram?.isMeasurementDay ? ' · Messtag' : ''}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {todayProgram?.blocks.map((block, index) => (
                <div key={`${block.type}-${index}`} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{EXERCISE_ICON[block.type]}</span>
                    <span className="font-semibold text-gray-800">{EXERCISE_LABEL[block.type]}</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{minutesLabel(block.targetDurationSec)}</span>
                </div>
              ))}
              {todayProgram && (
                <p className="text-xs text-gray-400 text-center mt-1">
                  Insgesamt ca. {minutesLabel(todayProgram.totalDurationSec)}
                </p>
              )}
            </div>
            <Button size="lg" onClick={handleStart} className="w-full">
              Training starten
            </Button>
          </div>
        )}

        {/* Leseeinstellungen */}
        <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-gray-600 text-center">Einstellungen</p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">LRS-Schrift</span>
            <button
              onClick={toggleLrsMode}
              className={[
                'px-4 py-1.5 rounded-full border text-sm font-medium transition-colors',
                lrsMode
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-gray-300',
              ].join(' ')}
            >
              {lrsMode ? 'OpenDyslexic ✓' : 'Normal'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Schriftgröße</span>
            <div className="flex gap-1">
              {FONT_SIZES.map((fs) => (
                <button
                  key={fs.value}
                  onClick={() => setFontSize(fs.value)}
                  className={[
                    'w-10 h-10 rounded-lg border font-bold transition-colors flex items-center justify-center',
                    fs.className,
                    fontSize === fs.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-primary',
                  ].join(' ')}
                >
                  {fs.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Hoher Kontrast</span>
            <button
              onClick={toggleHighContrast}
              className={[
                'px-4 py-1.5 rounded-full border text-sm font-medium transition-colors',
                highContrast
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300',
              ].join(' ')}
            >
              {highContrast ? 'An ✓' : 'Aus'}
            </button>
          </div>
        </div>
      </div>
    </ChildLayout>
  )
}
