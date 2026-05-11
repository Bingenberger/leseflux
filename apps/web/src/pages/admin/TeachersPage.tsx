import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { getTeachers, createTeacher, updateTeacher, deleteTeacher, importTeachers } from '../../lib/api.ts'
import type { TeacherSummary } from '../../lib/api.ts'
import { parseCsv, normalizeTeacherRow } from '../../lib/csvParser.ts'

function TeacherModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: TeacherSummary
  onSave: (data: { displayName: string; email: string; password: string }) => void
  onClose: () => void
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Name fehlt.'); return }
    if (!initial && !email.trim()) { setError('E-Mail fehlt.'); return }
    if (!initial && password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return }
    onSave({ displayName, email, password })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {initial ? 'Lehrer bearbeiten' : 'Neuer Lehrer'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Frau Mustermann"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="lehrer@schule.de"
              disabled={!!initial}
            />
            {initial && (
              <p className="text-xs text-gray-400 mt-1">E-Mail kann nicht geändert werden.</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Passwort {initial && <span className="text-gray-400">(leer lassen = kein Wechsel)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder={initial ? 'Neues Passwort (optional)' : 'Min. 8 Zeichen'}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end mt-2">
            <Button icon="x" type="button" variant="ghost" size="sm" onClick={onClose}>Abbrechen</Button>
            <Button icon="floppyDisk" type="submit" size="sm">Speichern</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TeacherImportModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: importTeachers,
    onSuccess: (res) => {
      setResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['admin-teachers'] })
    },
    onError: () => setError('Import fehlgeschlagen.'),
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
    let rows: ReturnType<typeof normalizeTeacherRow>[] = []
    if (text.trim().startsWith('[')) {
      try { rows = (JSON.parse(text) as Record<string, string>[]).map(normalizeTeacherRow) }
      catch { setError('Ungültiges JSON.'); return }
    } else {
      rows = parseCsv(text).map(normalizeTeacherRow)
    }
    const valid = rows.filter((r) => r.displayName && r.email && r.password)
    if (valid.length === 0) { setError('Pflichtfelder: Name, Email, Passwort.'); return }
    mutation.mutate(valid)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Lehrer importieren</h3>
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
            <PhosphorIcon name="x" size={16} />
            Schließen
          </button>
        </div>
        <p className="text-xs font-mono bg-gray-50 rounded p-2 whitespace-pre">
{`CSV: Name;Email;Passwort
JSON: [{"displayName":"…","email":"…","password":"…"}]`}
        </p>
        <input ref={fileRef} type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
        <Button icon="uploadSimple" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} className="w-fit">
          Datei laden
        </Button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6}
          className="w-full border border-gray-300 rounded-xl p-3 text-sm font-mono focus:outline-none focus:border-primary resize-none"
          placeholder="CSV oder JSON hier einfügen..." />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
            <p className="text-green-800 font-semibold">{result.imported} Lehrer importiert.</p>
            {result.skipped.length > 0 && <p className="text-gray-600 mt-1">{result.skipped.join(', ')}</p>}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button icon="x" variant="ghost" size="sm" onClick={onClose}>
            {result ? 'Schließen' : 'Abbrechen'}
          </Button>
          {!result && (
            <Button icon="uploadSimple" onClick={handleImport} disabled={mutation.isPending || !text.trim()}>
              {mutation.isPending ? '…' : 'Importieren'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TeachersPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTarget, setEditTarget] = useState<TeacherSummary | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: () => getTeachers().then((r) => r.data),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-teachers'] })

  const createMut = useMutation({
    mutationFn: createTeacher,
    onSuccess: () => { invalidate(); setShowModal(false) },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTeacher>[1] }) =>
      updateTeacher(id, data),
    onSuccess: () => { invalidate(); setEditTarget(undefined) },
  })

  const deleteMut = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => { invalidate(); setDeleteConfirm(null) },
  })

  const handleSave = (data: { displayName: string; email: string; password: string }) => {
    if (editTarget) {
      const payload: Parameters<typeof updateTeacher>[1] = { displayName: data.displayName }
      if (data.password) payload.password = data.password
      updateMut.mutate({ id: editTarget.id, data: payload })
    } else {
      createMut.mutate(data)
    }
  }

  return (
    <TeacherLayout title="Lehrerverwaltung">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Lehrerkonten</h2>
        <div className="flex gap-2">
          <Button icon="uploadSimple" variant="ghost" size="sm" onClick={() => setShowImport(true)}>
            Importieren
          </Button>
          <Button icon="userPlus" onClick={() => { setEditTarget(undefined); setShowModal(true) }}>
            Neuer Lehrer
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Lade Konten...</p>}

      {teachers && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">E-Mail</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Rolle</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Klassen</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-5 py-3 font-medium text-gray-900">{t.displayName}</td>
                  <td className="px-5 py-3 text-gray-600">{t.email ?? '–'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={[
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        t.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700',
                      ].join(' ')}
                    >
                      {t.role === 'ADMIN' ? 'Admin' : 'Lehrer'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">{t.classCount}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setEditTarget(t); setShowModal(true) }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <PhosphorIcon name="pencilSimple" size={13} />
                        Bearbeiten
                      </button>
                      {deleteConfirm === t.id ? (
                        <span className="flex gap-1">
                          <button
                            onClick={() => deleteMut.mutate(t.id)}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                          >
                            <PhosphorIcon name="check" size={13} />
                            Ja
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:underline"
                          >
                            <PhosphorIcon name="x" size={13} />
                            Nein
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(t.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
                        >
                          <PhosphorIcon name="trash" size={13} />
                          Löschen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(showModal || editTarget) && (
        <TeacherModal
          {...(editTarget ? { initial: editTarget } : {})}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(undefined) }}
        />
      )}

      {showImport && <TeacherImportModal onClose={() => setShowImport(false)} />}
    </TeacherLayout>
  )
}
