import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import {
  createFlashWord,
  deleteFlashWord,
  getFlashWords,
  importFlashWords,
  updateFlashWord,
} from '../../lib/api.ts'
import type { FlashWordDetail, ImportFlashWordInput, SaveFlashWordInput } from '../../lib/api.ts'

const EMPTY_FORM: SaveFlashWordInput = {
  word: '',
  syllables: 1,
  difficultyLevel: 1,
  distractors: ['', ''],
}

const FLASH_EXAMPLE_JSON = JSON.stringify(
  [
    { word: 'Haus', syllables: 1, difficultyLevel: 1, distractors: ['Hans', 'Hase'] },
    { word: 'Schule', syllables: 2, difficultyLevel: 1, distractors: ['Schale', 'Spule'] },
  ],
  null,
  2,
)

function normalizeForm(form: SaveFlashWordInput): SaveFlashWordInput {
  return {
    word: form.word.trim(),
    syllables: Number(form.syllables),
    difficultyLevel: Number(form.difficultyLevel),
    distractors: form.distractors.map((value) => value.trim()).filter(Boolean),
  }
}

export default function FlashWordsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<number | null>(null)
  const [editing, setEditing] = useState<FlashWordDetail | null>(null)
  const [form, setForm] = useState<SaveFlashWordInput>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [parseError, setParseError] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)

  const { data: words, isError, error: queryError, refetch, isLoading } = useQuery({
    queryKey: ['flash-words', query, level],
    queryFn: () => getFlashWords({
      ...(query.trim() ? { q: query.trim() } : {}),
      level,
    }).then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: SaveFlashWordInput) =>
      editing ? updateFlashWord(editing.id, payload) : createFlashWord(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flash-words'] })
      setEditing(null)
      setForm(EMPTY_FORM)
      setError('')
    },
    onError: () => setError('Speichern fehlgeschlagen. Wort eventuell schon vorhanden.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFlashWord(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['flash-words'] })
      setDeletingId(null)
    },
  })

  const importMutation = useMutation({
    mutationFn: (data: ImportFlashWordInput[]) => importFlashWords(data),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['flash-words'] })
      setImportResult(`${data.imported} Wortblitz-Wörter importiert.`)
      setJsonInput('')
      setTimeout(() => {
        setShowImport(false)
        setImportResult(null)
      }, 2000)
    },
    onError: () => setParseError('Import fehlgeschlagen. Bitte Format und Serverlog prüfen.'),
  })

  const startEdit = (word: FlashWordDetail) => {
    setEditing(word)
    setForm({
      word: word.word,
      syllables: word.syllables,
      difficultyLevel: word.difficultyLevel,
      distractors: word.distractors,
    })
    setError('')
  }

  const save = () => {
    const payload = normalizeForm(form)
    if (!payload.word || payload.distractors.length === 0) {
      setError('Wort und mindestens ein Distraktor sind erforderlich.')
      return
    }
    saveMutation.mutate(payload)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setJsonInput((ev.target?.result as string) ?? '')
    reader.readAsText(file)
  }

  const handleImport = () => {
    setParseError('')
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonInput)
    } catch {
      setParseError('Ungültiges JSON — bitte Syntax prüfen.')
      return
    }
    if (!Array.isArray(parsed)) {
      setParseError('JSON muss ein Array sein: [ { ... }, ... ]')
      return
    }
    importMutation.mutate(parsed as ImportFlashWordInput[])
  }

  return (
    <TeacherLayout title="Wortblitz">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wortblitz-Wörter</h2>
          <p className="text-sm text-gray-500 mt-1">
            Wörter bearbeiten, Schwierigkeitsstufe setzen und Distraktoren pflegen.
          </p>
        </div>
        <Button icon="uploadSimple" variant="ghost" onClick={() => { setShowImport(true); setParseError(''); setImportResult(null) }}>
          Wörter importieren
        </Button>
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Wortblitz-Wörter importieren (JSON)</h3>
              <button
                onClick={() => setShowImport(false)}
                className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
              >
                <PhosphorIcon name="x" size={16} />
                Schließen
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono leading-relaxed">
              <p className="font-semibold text-gray-700 mb-1 font-sans text-sm">Format:</p>
              <pre className="whitespace-pre-wrap break-all">{FLASH_EXAMPLE_JSON}</pre>
            </div>

            <div className="flex gap-3 items-center">
              <Button icon="uploadSimple" variant="ghost" onClick={() => fileRef.current?.click()}>
                JSON-Datei wählen
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
              {jsonInput && (
                <span className="text-sm text-success">
                  ✓ {jsonInput.length} Zeichen geladen
                </span>
              )}
            </div>

            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="[ { &quot;word&quot;: &quot;Haus&quot;, ... } ]"
            />

            {parseError && <p className="text-red-600 text-sm">{parseError}</p>}
            {importResult && <p className="text-success font-medium">{importResult}</p>}

            <div className="flex gap-3">
              <Button
                icon="uploadSimple"
                onClick={handleImport}
                disabled={!jsonInput.trim() || importMutation.isPending}
              >
                {importMutation.isPending ? 'Importiere…' : 'Importieren'}
              </Button>
              <Button icon="x" variant="ghost" onClick={() => setShowImport(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 h-fit">
          <h3 className="font-semibold text-gray-900">
            {editing ? 'Wort bearbeiten' : 'Neues Wort'}
          </h3>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Wort
            <input
              value={form.word}
              onChange={(e) => setForm({ ...form, word: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Silben
              <input
                type="number"
                min={1}
                max={12}
                value={form.syllables}
                onChange={(e) => setForm({ ...form, syllables: Number(e.target.value) })}
                className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Level
              <input
                type="number"
                min={1}
                max={10}
                value={form.difficultyLevel}
                onChange={(e) => setForm({ ...form, difficultyLevel: Number(e.target.value) })}
                className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Distraktoren
            <textarea
              value={form.distractors.join(', ')}
              onChange={(e) => setForm({
                ...form,
                distractors: e.target.value.split(',').map((value) => value.trim()),
              })}
              rows={3}
              placeholder="Hans, Hase"
              className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
            />
            <span className="text-xs text-gray-400">Kommagetrennt, mindestens einer.</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <Button icon="floppyDisk" onClick={save} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Speichere…' : 'Speichern'}
            </Button>
            {editing && (
              <Button
                icon="x"
                variant="ghost"
                onClick={() => {
                  setEditing(null)
                  setForm(EMPTY_FORM)
                  setError('')
                }}
              >
                Abbrechen
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Wort suchen…"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={level ?? ''}
                onChange={(e) => setLevel(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Alle Level</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>Level {value}</option>
                ))}
              </select>
            </div>
            <span className="text-sm text-gray-500">
              {isLoading ? 'Lade…' : `${words?.length ?? 0} Wörter`}
            </span>
          </div>

          {isError && (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">Wortblitz-Wörter konnten nicht geladen werden.</p>
              <p className="mt-1">
                Bitte Anmeldung und API prüfen. Antwort: {
                  (queryError as { response?: { status?: number; data?: { error?: string } } })?.response?.status ?? 'unbekannt'
                } {
                  (queryError as { response?: { data?: { error?: string } } })?.response?.data?.error ?? ''
                }
              </p>
              <button onClick={() => refetch()} className="mt-2 inline-flex items-center gap-1 text-red-700 underline">
                <PhosphorIcon name="arrowClockwise" size={14} />
                Erneut laden
              </button>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2 font-medium">Wort</th>
                <th className="text-right px-4 py-2 font-medium">Silben</th>
                <th className="text-right px-4 py-2 font-medium">Level</th>
                <th className="text-left px-4 py-2 font-medium">Distraktoren</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!isError && words?.map((word) => (
                <tr key={word.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{word.word}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{word.syllables}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{word.difficultyLevel}</td>
                  <td className="px-4 py-2.5 text-gray-600">{word.distractors.join(', ')}</td>
                  <td className="px-4 py-2.5 text-right">
                    {deletingId === word.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-gray-500">Löschen?</span>
                        <button
                          onClick={() => deleteMutation.mutate(word.id)}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1 text-xs text-red-600 font-medium hover:underline"
                        >
                          <PhosphorIcon name="check" size={13} />
                          Ja
                        </button>
                        <button onClick={() => setDeletingId(null)} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:underline">
                          <PhosphorIcon name="x" size={13} />
                          Nein
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end">
                        <button onClick={() => startEdit(word)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <PhosphorIcon name="pencilSimple" size={13} />
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => setDeletingId(word.id)}
                          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                        >
                          <PhosphorIcon name="trash" size={13} />
                          Löschen
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!isError && !isLoading && words?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                    Keine Wortblitz-Wörter gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </TeacherLayout>
  )
}
