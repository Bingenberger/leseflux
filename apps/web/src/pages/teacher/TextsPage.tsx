import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { getTextDetail, getTexts, importTexts, saveClozeTemplate, deleteText, updateText } from '../../lib/api.ts'
import type { TextSummary, ImportTextInput, TextDetail, SaveTextInput } from '../../lib/api.ts'

const LEVEL_LABEL: Record<number, string> = {
  2: 'Klasse 2',
  3: 'Klasse 3',
  4: 'Klasse 4',
}

const EXAMPLE_JSON = JSON.stringify(
  [
    {
      title: 'Der Drache im Garten',
      content: 'Mia lief durch den Garten. Plötzlich sah sie etwas Rotes hinter dem Busch. Es war ein kleiner Drache!',
      targetLevel: 2,
      questions: [
        {
          question: 'Was findet Mia im Garten?',
          options: ['Einen Drachen', 'Eine Katze', 'Einen Vogel'],
          correctIndex: 0,
        },
      ],
    },
  ],
  null,
  2,
)

function cleanWord(word: string) {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function ClozeEditorModal({ textId, onClose }: { textId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [gapState, setGapState] = useState<Record<number, { correctWord: string; distractors: string }>>({})
  const [initializedTextId, setInitializedTextId] = useState<string | null>(null)

  const { data: detail, isLoading } = useQuery({
    queryKey: ['text-detail', textId],
    queryFn: () => getTextDetail(textId).then((r) => r.data),
  })

  if (detail && initializedTextId !== detail.id) {
    const next: Record<number, { correctWord: string; distractors: string }> = {}
    detail.clozeTemplate?.gaps.forEach((gap) => {
      next[gap.wordIndex] = {
        correctWord: gap.correctWord,
        distractors: gap.distractors.join(', '),
      }
    })
    setGapState(next)
    setInitializedTextId(detail.id)
  }

  const saveMutation = useMutation({
    mutationFn: (payload: { mode: 'AUTO' | 'MANUAL'; detail: TextDetail }) => {
      if (payload.mode === 'AUTO') {
        return saveClozeTemplate(payload.detail.id, { strategy: 'AUTO_EVERY_N', gapInterval: 7 })
      }
      return saveClozeTemplate(payload.detail.id, {
        strategy: 'MANUAL',
        gaps: Object.entries(gapState)
          .map(([wordIndex, gap]) => ({
            wordIndex: Number(wordIndex),
            correctWord: gap.correctWord,
            distractors: gap.distractors.split(',').map((v) => v.trim()).filter(Boolean),
          }))
          .filter((gap) => gap.correctWord && gap.distractors.length > 0),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['text-detail', textId] })
      qc.invalidateQueries({ queryKey: ['texts'] })
      onClose()
    },
  })

  const words = detail?.content.split(/\s+/).filter(Boolean) ?? []

  const toggleGap = (wordIndex: number) => {
    const word = cleanWord(words[wordIndex] ?? '')
    if (!word) return
    setGapState((prev) => {
      const next = { ...prev }
      if (next[wordIndex]) {
        delete next[wordIndex]
      } else {
        const candidates = words.map(cleanWord).filter((w) => w && w.toLowerCase() !== word.toLowerCase())
        next[wordIndex] = {
          correctWord: word,
          distractors: candidates.slice(0, 2).join(', '),
        }
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Cloze-Editor</h3>
            <p className="text-sm text-gray-500">{detail?.title ?? 'Lade Text…'}</p>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
            <PhosphorIcon name="x" size={16} />
            Schließen
          </button>
        </div>

        {isLoading && <p className="text-gray-500">Lade Text…</p>}
        {detail && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
              Wörter anklicken, um sie als Lücke zu markieren. Für jede Lücke müssen mindestens ein Distraktor,
              besser zwei Distraktoren kommagetrennt gepflegt sein.
            </div>

            <div className="leading-loose text-lg bg-gray-50 rounded-xl p-4">
              {words.map((word, index) => {
                const isGap = gapState[index] !== undefined
                return (
                  <button
                    key={`${word}-${index}`}
                    onClick={() => toggleGap(index)}
                    className={[
                      'inline-block mr-[0.3em] mb-1 px-1.5 rounded transition-colors',
                      isGap ? 'bg-primary text-white font-bold' : 'hover:bg-blue-100 text-gray-900',
                    ].join(' ')}
                  >
                    {word}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-2">
              {Object.entries(gapState).length === 0 ? (
                <p className="text-sm text-gray-400">Noch keine manuellen Lücken ausgewählt.</p>
              ) : Object.entries(gapState)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([wordIndex, gap]) => (
                  <div key={wordIndex} className="grid md:grid-cols-[80px_1fr_2fr_auto] gap-2 items-center">
                    <span className="text-xs text-gray-400">#{Number(wordIndex) + 1}</span>
                    <input
                      value={gap.correctWord}
                      onChange={(e) => setGapState((prev) => ({
                        ...prev,
                        [Number(wordIndex)]: { ...prev[Number(wordIndex)]!, correctWord: e.target.value },
                      }))}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={gap.distractors}
                      onChange={(e) => setGapState((prev) => ({
                        ...prev,
                        [Number(wordIndex)]: { ...prev[Number(wordIndex)]!, distractors: e.target.value },
                      }))}
                      placeholder="Distraktoren, kommagetrennt"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button onClick={() => toggleGap(Number(wordIndex))} className="inline-flex items-center gap-1 text-xs text-red-500">
                      <PhosphorIcon name="trash" size={13} />
                      Entfernen
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex gap-3">
              <Button
                icon="floppyDisk"
                onClick={() => saveMutation.mutate({ mode: 'MANUAL', detail })}
                disabled={saveMutation.isPending || Object.keys(gapState).length === 0}
              >
                MANUAL speichern
              </Button>
              <Button
                icon="arrowClockwise"
                variant="ghost"
                onClick={() => saveMutation.mutate({ mode: 'AUTO', detail })}
                disabled={saveMutation.isPending}
              >
                Auf AUTO zurücksetzen
              </Button>
              <Button icon="x" variant="ghost" onClick={onClose}>Abbrechen</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function emptyQuestion() {
  return { question: '', options: ['', '', ''], correctIndex: 0 }
}

function TextEditorModal({ textId, onClose }: { textId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SaveTextInput | null>(null)
  const [initializedTextId, setInitializedTextId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: detail, isLoading } = useQuery({
    queryKey: ['text-detail', textId],
    queryFn: () => getTextDetail(textId).then((r) => r.data),
  })

  if (detail && initializedTextId !== detail.id) {
    setForm({
      title: detail.title,
      content: detail.content,
      targetLevel: detail.targetLevel as 2 | 3 | 4,
      questions: detail.questions.map((q) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
      })),
    })
    setInitializedTextId(detail.id)
  }

  const saveMutation = useMutation({
    mutationFn: (payload: SaveTextInput) => updateText(textId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['texts'] })
      qc.invalidateQueries({ queryKey: ['text-detail', textId] })
      onClose()
    },
    onError: () => setError('Speichern fehlgeschlagen. Bitte Eingaben prüfen.'),
  })

  const updateQuestion = (
    index: number,
    patch: Partial<{ question: string; options: string[]; correctIndex: number }>,
  ) => {
    setForm((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        questions: prev.questions.map((question, i) => i === index ? { ...question, ...patch } : question),
      }
    })
  }

  const save = () => {
    if (!form) return
    const questions = form.questions
      .map((q) => ({
        question: q.question.trim(),
        options: q.options.map((option) => option.trim()).filter(Boolean),
        correctIndex: q.correctIndex,
      }))
      .filter((q) => q.question && q.options.length >= 2)

    if (!form.title.trim() || form.content.trim().length < 10 || questions.length === 0) {
      setError('Titel, Text und mindestens eine vollständige Frage sind erforderlich.')
      return
    }
    if (questions.some((q) => q.correctIndex >= q.options.length)) {
      setError('Bei jeder Frage muss die richtige Antwort auf eine vorhandene Option zeigen.')
      return
    }

    setError('')
    saveMutation.mutate({
      title: form.title.trim(),
      content: form.content.trim(),
      targetLevel: form.targetLevel,
      questions,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Lesetext bearbeiten</h3>
            <p className="text-sm text-gray-500">{detail?.title ?? 'Lade Text…'}</p>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
            <PhosphorIcon name="x" size={16} />
            Schließen
          </button>
        </div>

        {isLoading && <p className="text-gray-500">Lade Text…</p>}
        {form && (
          <>
            <div className="grid md:grid-cols-[1fr_180px] gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Titel
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Klassenstufe
                <select
                  value={form.targetLevel}
                  onChange={(e) => setForm({ ...form, targetLevel: Number(e.target.value) as 2 | 3 | 4 })}
                  className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                >
                  <option value={2}>Klasse 2</option>
                  <option value={3}>Klasse 3</option>
                  <option value={4}>Klasse 4</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Textinhalt
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
                className="rounded-lg border border-gray-300 px-3 py-2 font-normal leading-relaxed"
              />
            </label>

            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Fragenset</h4>
              <Button
                icon="plus"
                variant="ghost"
                onClick={() => setForm({ ...form, questions: [...form.questions, emptyQuestion()] })}
                disabled={form.questions.length >= 8}
              >
                Frage hinzufügen
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {form.questions.map((question, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex-1 flex flex-col gap-1 text-sm font-medium text-gray-700">
                      Frage {index + 1}
                      <input
                        value={question.question}
                        onChange={(e) => updateQuestion(index, { question: e.target.value })}
                        className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                      />
                    </label>
                    <button
                      onClick={() => setForm({
                        ...form,
                        questions: form.questions.filter((_, i) => i !== index),
                      })}
                      disabled={form.questions.length <= 1}
                      className="inline-flex items-center gap-1 text-xs text-red-500 disabled:text-gray-300"
                    >
                      <PhosphorIcon name="trash" size={13} />
                      Entfernen
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-2">
                    {question.options.map((option, optionIndex) => (
                      <label key={optionIndex} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name={`correct-${index}`}
                          checked={question.correctIndex === optionIndex}
                          onChange={() => updateQuestion(index, { correctIndex: optionIndex })}
                        />
                        <input
                          value={option}
                          onChange={(e) => {
                            const options = [...question.options]
                            options[optionIndex] = e.target.value
                            updateQuestion(index, { options })
                          }}
                          placeholder={`Antwort ${optionIndex + 1}`}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button icon="floppyDisk" onClick={save} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Speichere…' : 'Speichern'}
              </Button>
              <Button icon="x" variant="ghost" onClick={onClose}>Abbrechen</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TextsPage() {
  const qc = useQueryClient()
  const [showImport, setShowImport] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [parseError, setParseError] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clozeTextId, setClozeTextId] = useState<string | null>(null)
  const [editTextId, setEditTextId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: grouped, isLoading } = useQuery({
    queryKey: ['texts'],
    queryFn: () => getTexts().then((r) => r.data),
  })

  const importMutation = useMutation({
    mutationFn: (data: ImportTextInput[]) => importTexts(data),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['texts'] })
      setImportResult(`${data.imported} Text${data.imported !== 1 ? 'e' : ''} importiert.`)
      setJsonInput('')
      setTimeout(() => {
        setShowImport(false)
        setImportResult(null)
      }, 2000)
    },
    onError: () => setParseError('Import fehlgeschlagen. Bitte Serverlog prüfen.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteText(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['texts'] })
      setDeletingId(null)
    },
  })

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
    importMutation.mutate(parsed as ImportTextInput[])
  }

  const totalTexts = grouped?.reduce((s, g) => s + g.texts.length, 0) ?? 0

  return (
    <TeacherLayout title="Texte">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lesetexte</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? '…' : `${totalTexts} Texte insgesamt`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon="uploadSimple" onClick={() => { setShowImport(true); setParseError(''); setImportResult(null) }}>
            Texte importieren
          </Button>
        </div>
      </div>

      {/* Import-Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Texte importieren (JSON)</h3>
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
              <pre className="whitespace-pre-wrap break-all">{EXAMPLE_JSON}</pre>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Oder JSON direkt einfügen:
              </label>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="[ { &quot;title&quot;: &quot;...&quot;, ... } ]"
              />
            </div>

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

      {/* Textlisten nach Klasse */}
      {isLoading && <p className="text-gray-500">Lade Texte…</p>}

      {grouped && (
        <div className="flex flex-col gap-6">
          {grouped.map(({ level, texts }) => (
            <div key={level} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="font-semibold text-gray-800">{LEVEL_LABEL[level]}</h3>
                <span className="text-sm text-gray-500">{texts.length} Texte</span>
              </div>

              {texts.length === 0 ? (
                <p className="text-gray-400 text-sm px-5 py-4">
                  Noch keine Texte für diese Klasse.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 uppercase tracking-wide">
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-5 py-2 font-medium">Titel</th>
                      <th className="text-right px-4 py-2 font-medium">Wörter</th>
                      <th className="text-right px-4 py-2 font-medium">LIX</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {texts.map((t: TextSummary) => (
                      <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-gray-900 font-medium">{t.title}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{t.wordCount}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">
                          {t.lixScore.toFixed(0)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {deletingId === t.id ? (
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-xs text-gray-500">Löschen?</span>
                              <button
                                onClick={() => deleteMutation.mutate(t.id)}
                                disabled={deleteMutation.isPending}
                                className="inline-flex items-center gap-1 text-xs text-red-600 font-medium hover:underline"
                              >
                                <PhosphorIcon name="check" size={13} />
                                Ja
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:underline"
                              >
                                <PhosphorIcon name="x" size={13} />
                                Nein
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-3 justify-end">
                              <button
                                onClick={() => setEditTextId(t.id)}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <PhosphorIcon name="pencilSimple" size={13} />
                                Bearbeiten
                              </button>
                              <button
                                onClick={() => setClozeTextId(t.id)}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <PhosphorIcon name="listChecks" size={13} />
                                Cloze
                              </button>
                              <button
                                onClick={() => setDeletingId(t.id)}
                                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <PhosphorIcon name="trash" size={13} />
                                Löschen
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {clozeTextId && (
        <ClozeEditorModal textId={clozeTextId} onClose={() => setClozeTextId(null)} />
      )}
      {editTextId && (
        <TextEditorModal textId={editTextId} onClose={() => setEditTextId(null)} />
      )}
    </TeacherLayout>
  )
}
