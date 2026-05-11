import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { StudentTable } from '../../components/teacher/StudentTable.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { getClassDetail, getSessionTemplates, getStudentsOverview, importAntonStudents, deleteStudent, updateClassTemplate } from '../../lib/api.ts'
import { parseCsv, normalizeAntonRow } from '../../lib/csvParser.ts'

function AntonImportModal({
  classId,
  onClose,
}: {
  classId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: importAntonStudents,
    onSuccess: (res) => {
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['students-overview', classId] })
    },
    onError: () => setError('Import fehlgeschlagen. Bitte Format prüfen.'),
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setText((ev.target?.result as string) ?? '')
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = () => {
    setError('')
    let rows: ReturnType<typeof normalizeAntonRow>[] = []

    // JSON-Array
    if (text.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(text)
        rows = (parsed as Record<string, string>[]).map(normalizeAntonRow)
      } catch {
        setError('Ungültiges JSON.')
        return
      }
    } else {
      // CSV
      rows = parseCsv(text).map(normalizeAntonRow)
    }

    // Klasse aus classId ableiten – leer lassen, damit der Server die bestehende Klasse nutzt
    // Wir überschreiben den klasse-Wert wenn nötig nach dem Import
    const valid = rows.filter((r) => r.vorname && r.antonCode)
    if (valid.length === 0) {
      setError('Keine gültigen Zeilen gefunden. Pflichtfelder: Vorname, AntonCode.')
      return
    }

    mutation.mutate({ defaultClassId: classId, rows: valid })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Anton-Schüler importieren</h3>
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
            <PhosphorIcon name="x" size={16} />
            Schließen
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Unterstützte Formate:</p>
          <p className="font-mono text-xs bg-white rounded p-2 mt-1 whitespace-pre">
{`CSV (Semikolon oder Komma):
Vorname;Nachname;Klasse;AntonCode;Schuljahr
Mia;Müller;3a;72zk-azys;2025/26

JSON:
[{"vorname":"Mia","nachname":"Müller","klasse":"3a","antonCode":"72zk-azys"}]`}
          </p>
          <p className="mt-2 text-xs">
            Der QR-Code der Anton-App (<code>anton://login/72zk-azys</code>) wird automatisch
            erkannt. Kinder können sich danach direkt mit ihrem Anton-QR anmelden.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            <PhosphorIcon name="uploadSimple" size={16} />
            Datei laden
          </button>
          <span className="text-xs text-gray-400 self-center">oder direkt einfügen:</span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:outline-none focus:border-primary resize-none"
          placeholder="CSV oder JSON hier einfügen..."
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
            <p className="text-green-800 font-semibold">{result.imported} Schüler importiert.</p>
            {result.skipped.length > 0 && (
              <div className="mt-2">
                <p className="text-gray-600 font-medium">{result.skipped.length} übersprungen:</p>
                <ul className="mt-1 text-xs text-gray-500 list-disc pl-4">
                  {result.skipped.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="inline-flex items-center gap-2 text-sm text-gray-500 px-4 py-2 hover:text-gray-700">
            <PhosphorIcon name="x" size={16} />
            {result ? 'Schließen' : 'Abbrechen'}
          </button>
          {!result && (
            <Button icon="uploadSimple" onClick={handleImport} disabled={mutation.isPending || !text.trim()}>
              {mutation.isPending ? 'Importiere...' : 'Importieren'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ClassPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showImport, setShowImport] = useState(false)

  const { data: classDetail } = useQuery({
    queryKey: ['class-detail', id],
    queryFn: () => getClassDetail(id!).then((r) => r.data),
    enabled: !!id,
  })

  const { data: templates } = useQuery({
    queryKey: ['session-templates'],
    queryFn: () => getSessionTemplates().then((r) => r.data),
  })

  const { data: students, isLoading } = useQuery({
    queryKey: ['students-overview', id],
    queryFn: () => getStudentsOverview(id!).then((r) => r.data),
    enabled: !!id,
  })

  const deleteMut = useMutation({
    mutationFn: (studentId: string) => deleteStudent(studentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students-overview', id] }),
  })

  const templateMut = useMutation({
    mutationFn: (sessionTemplateId: string | null) => updateClassTemplate(id!, sessionTemplateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class-detail', id] }),
  })

  return (
    <TeacherLayout title="Klasse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Schülerübersicht</h2>
          {classDetail && (
            <p className="text-sm text-gray-500 mt-1">
              {classDetail.name} · {classDetail.schoolYear}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/teacher/classes/${id}/qr-print`)}
            className="inline-flex items-center gap-2 text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            <PhosphorIcon name="printer" size={16} />
            QR-Codes drucken
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 text-sm border border-primary text-primary rounded-lg px-4 py-2 hover:bg-blue-50"
          >
            <PhosphorIcon name="uploadSimple" size={16} />
            Anton-Import
          </button>
          <Button icon="userPlus" onClick={() => navigate(`/teacher/classes/${id}/students/new`)}>
            Schüler hinzufügen
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">Sitzungs-Vorlage</p>
          <p className="text-xs text-gray-400">
            Gilt für normale Trainingstage dieser Klasse. Messtage bleiben automatisch aktiv.
          </p>
        </div>
        <select
          value={classDetail?.sessionTemplateId ?? ''}
          onChange={(e) => templateMut.mutate(e.target.value || null)}
          disabled={!classDetail || !templates || templateMut.isPending}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-56 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">System-Standard</option>
          {templates?.filter((t) => t.id !== 'measurement-day').map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}{template.teacherId ? ' (privat)' : ' (schulweit)'}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-gray-500">Lade Übersicht...</p>}
      {students && (
        <StudentTable
          students={students}
          classId={id!}
          onDelete={(studentId) => deleteMut.mutate(studentId)}
        />
      )}

      {showImport && (
        <AntonImportModal classId={id!} onClose={() => setShowImport(false)} />
      )}
    </TeacherLayout>
  )
}
