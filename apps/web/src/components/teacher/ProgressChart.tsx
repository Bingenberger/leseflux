import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { SessionOverview } from '../../lib/api.ts'
import type { ExerciseRunOverview, ExerciseType } from '../../lib/api.ts'

interface Props {
  sessions: SessionOverview[]
}

const EXERCISE_LABEL: Record<ExerciseType, string> = {
  FADING: 'Fading',
  FLASH_WORD: 'Wortblitz',
  CLOZE: 'Lückentext',
  SELF_PACED: 'Eigentempo',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

export function ExerciseAccuracyChart({ runs, type }: { runs: ExerciseRunOverview[]; type: ExerciseType }) {
  const data = runs
    .filter((r) => r.exerciseType === type && r.accuracy !== null)
    .slice()
    .reverse()
    .map((r) => ({
      date: formatDate(r.startedAt),
      accuracy: Math.round((r.accuracy ?? 0) * 100),
    }))

  if (data.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Noch keine Daten für {EXERCISE_LABEL[type]}.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} unit="%" domain={[0, 100]} />
        <Tooltip formatter={(v: number) => [`${v} %`, EXERCISE_LABEL[type]]} />
        <Bar dataKey="accuracy" fill={type === 'FLASH_WORD' ? '#f59e0b' : type === 'CLOZE' ? '#578E7E' : '#3674B5'} radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function WpmChart({ sessions }: Props) {
  const data = sessions
    .filter((s) => s.completed)
    .slice()
    .reverse()
    .map((s) => ({
      date: formatDate(s.startedAt),
      wpm: s.measuredWpm ?? s.targetWpm,
    }))

  if (data.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Noch keine Sitzungen.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={36}
          unit=" WPM"
        />
        <Tooltip
          formatter={(v: number) => [`${v} WPM`, 'Tempo']}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="wpm"
          stroke="#3674B5"
          strokeWidth={2}
          dot={{ r: 3, fill: '#3674B5' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function AccuracyChart({ sessions }: Props) {
  const data = sessions
    .filter((s) => s.completed && s.quizAccuracy !== null)
    .slice()
    .reverse()
    .map((s) => ({
      date: formatDate(s.startedAt),
      accuracy: Math.round((s.quizAccuracy ?? 0) * 100),
    }))

  if (data.length === 0) {
    return <p className="text-gray-400 text-sm text-center py-8">Noch keine Quiz-Daten.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          width={32}
          unit="%"
          domain={[0, 100]}
        />
        <Tooltip
          formatter={(v: number) => [`${v} %`, 'Genauigkeit']}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <ReferenceLine y={70} stroke="#578E7E" strokeDasharray="4 4" />
        <ReferenceLine y={40} stroke="#E97A0C" strokeDasharray="4 4" />
        <Bar dataKey="accuracy" fill="#3674B5" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
