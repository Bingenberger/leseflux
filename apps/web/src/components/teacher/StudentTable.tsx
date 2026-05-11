import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StudentOverview } from '../../lib/api.ts'
import { PhosphorIcon } from '../shared/PhosphorIcons.tsx'

interface Props {
  students: StudentOverview[]
  classId: string
  onDelete?: (studentId: string) => void
}

function TrendArrow({ accuracy }: { accuracy: number | null }) {
  if (accuracy === null) return <span className="text-gray-400">–</span>
  if (accuracy >= 0.7) return <span className="text-success text-lg">↑</span>
  if (accuracy < 0.4) return <span className="text-warning text-lg">↓</span>
  return <span className="text-gray-500 text-lg">→</span>
}

function AccuracyBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400 text-sm">–</span>
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'text-success' : pct < 40 ? 'text-warning' : 'text-gray-700'
  return <span className={`text-sm font-medium ${color}`}>{pct} %</span>
}

export function StudentTable({ students, classId: _classId, onDelete }: Props) {
  const navigate = useNavigate()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  if (students.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        Noch keine Schülerinnen und Schüler in dieser Klasse.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Ziel-WPM</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Sitzungen</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Ø Genauigkeit</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Trend</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Letzte Sitzung</th>
            {onDelete && (
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Aktionen</th>
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              <td
                className="px-4 py-3 font-medium text-gray-900 cursor-pointer hover:text-primary"
                onClick={() => navigate(`/teacher/students/${s.id}`)}
              >
                {s.displayName}
              </td>
              <td className="px-4 py-3 text-right text-gray-700">
                {s.currentTargetWpm ?? '–'} WPM
              </td>
              <td className="px-4 py-3 text-right text-gray-700">{s.totalSessions}</td>
              <td className="px-4 py-3 text-right">
                <AccuracyBadge value={s.averageQuizAccuracy} />
              </td>
              <td className="px-4 py-3 text-right">
                <TrendArrow accuracy={s.averageQuizAccuracy} />
              </td>
              <td className="px-4 py-3 text-right text-gray-500">
                {s.lastSessionAt
                  ? new Date(s.lastSessionAt).toLocaleDateString('de-DE')
                  : '–'}
              </td>
              {onDelete && (
                <td className="px-4 py-3 text-right">
                  {deleteConfirm === s.id ? (
                    <span className="flex gap-2 justify-end text-xs">
                      <button
                        onClick={() => { onDelete(s.id); setDeleteConfirm(null) }}
                        className="inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
                      >
                        <PhosphorIcon name="check" size={13} />
                        Ja
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="inline-flex items-center gap-1 text-gray-500 hover:underline"
                      >
                        <PhosphorIcon name="x" size={13} />
                        Nein
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(s.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:underline"
                    >
                      <PhosphorIcon name="trash" size={13} />
                      Löschen
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
