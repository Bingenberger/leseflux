import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import {
  createDiagnosticItem,
  deleteDiagnosticItem,
  getDiagnosticItems,
  getDiagnostics,
  importDiagnosticItems,
  updateDiagnostic,
  updateDiagnosticItem,
} from '../../lib/api.ts'
import type {
  DiagnosticConfig,
  DiagnosticItemDetail,
  SaveDiagnosticItemInput,
} from '../../lib/api.ts'

const TYPE_LABEL: Record<DiagnosticConfig['type'], string> = {
  ENTRY: 'Eingangsdiagnostik',
  INTERMEDIATE: 'Zwischendiagnostik',
}

const EXAMPLE_JSON = JSON.stringify(
  [
    { sentence: 'Die Sonne scheint am Tag.', isNonsense: false, difficulty: 1 },
    { sentence: 'Fische wohnen auf Bäumen.', isNonsense: true, difficulty: 1 },
  ],
  null,
  2,
)

const EMPTY_ITEM: SaveDiagnosticItemInput = {
  sentence: '',
  isNonsense: false,
  difficulty: 1,
}

function itemInput(item?: DiagnosticItemDetail): SaveDiagnosticItemInput {
  return item
    ? { sentence: item.sentence, isNonsense: item.isNonsense, difficulty: item.difficulty }
    : EMPTY_ITEM
}

export default function DiagnosticsPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<DiagnosticItemDetail | null>(null)
  const [itemForm, setItemForm] = useState<SaveDiagnosticItemInput>(EMPTY_ITEM)
  const [jsonInput, setJsonInput] = useState('')
  const [message, setMessage] = useState('')

  const { data: diagnostics, isLoading } = useQuery({
    queryKey: ['diagnostics'],
    queryFn: () => getDiagnostics().then((r) => r.data),
  })

  const selected = diagnostics?.find((d) => d.id === (selectedId ?? diagnostics[0]?.id))
  const activeId = selected?.id

  const { data: items } = useQuery({
    queryKey: ['diagnostic-items', activeId],
    queryFn: () => getDiagnosticItems(activeId!).then((r) => r.data),
    enabled: !!activeId,
  })

  const configMutation = useMutation({
    mutationFn: (diagnostic: DiagnosticConfig) => updateDiagnostic(diagnostic.id, {
      name: diagnostic.name,
      durationSec: diagnostic.durationSec,
      itemCount: diagnostic.itemCount,
      intervalSessions: diagnostic.type === 'INTERMEDIATE' ? diagnostic.intervalSessions : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagnostics'] })
      setMessage('Konfiguration gespeichert.')
    },
  })

  const itemMutation = useMutation({
    mutationFn: (payload: SaveDiagnosticItemInput) =>
      editingItem
        ? updateDiagnosticItem(editingItem.id, payload)
        : createDiagnosticItem(activeId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagnostic-items', activeId] })
      qc.invalidateQueries({ queryKey: ['diagnostics'] })
      setEditingItem(null)
      setItemForm(EMPTY_ITEM)
      setMessage('Satz gespeichert.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDiagnosticItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diagnostic-items', activeId] })
      qc.invalidateQueries({ queryKey: ['diagnostics'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: (payload: SaveDiagnosticItemInput[]) => importDiagnosticItems(activeId!, payload),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['diagnostic-items', activeId] })
      qc.invalidateQueries({ queryKey: ['diagnostics'] })
      setJsonInput('')
      setMessage(`${data.imported} Sätze importiert.`)
    },
    onError: () => setMessage('Import fehlgeschlagen. Bitte JSON prüfen.'),
  })

  const updateSelected = (patch: Partial<DiagnosticConfig>) => {
    if (!selected) return
    qc.setQueryData<DiagnosticConfig[]>(['diagnostics'], (prev) =>
      prev?.map((diagnostic) => diagnostic.id === selected.id ? { ...diagnostic, ...patch } : diagnostic),
    )
  }

  const saveItem = () => {
    const payload = { ...itemForm, sentence: itemForm.sentence.trim() }
    if (!payload.sentence) {
      setMessage('Satz fehlt.')
      return
    }
    itemMutation.mutate(payload)
  }

  const importJson = () => {
    try {
      const parsed = JSON.parse(jsonInput) as SaveDiagnosticItemInput[]
      if (!Array.isArray(parsed)) throw new Error('not-array')
      importMutation.mutate(parsed)
    } catch {
      setMessage('Ungültiges JSON.')
    }
  }

  return (
    <TeacherLayout title="Diagnostik">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diagnostik</h2>
          <p className="text-sm text-gray-500 mt-1">
            Sätze, Dauer, Satzanzahl und Zeitpunkt der Zwischendiagnostik konfigurieren.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Lade Diagnostik…</p>}
      {message && <p className="mb-4 text-sm text-primary">{message}</p>}

      {diagnostics && selected && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <div className="flex flex-col gap-3">
            {diagnostics.map((diagnostic) => (
              <button
                key={diagnostic.id}
                onClick={() => {
                  setSelectedId(diagnostic.id)
                  setEditingItem(null)
                  setItemForm(EMPTY_ITEM)
                }}
                className={[
                  'text-left bg-white rounded-xl border p-4 hover:border-primary',
                  selected.id === diagnostic.id ? 'border-primary' : 'border-gray-200',
                ].join(' ')}
              >
                <p className="font-bold text-gray-900 inline-flex items-center gap-2">
                  <PhosphorIcon name="listChecks" size={18} />
                  {TYPE_LABEL[diagnostic.type]}
                </p>
                <p className="text-sm text-gray-500">{diagnostic.itemTotal} Sätze · {diagnostic.durationSec} s</p>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Konfiguration</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 md:col-span-2">
                  Name
                  <input
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Dauer (Sek.)
                  <input
                    type="number"
                    min={30}
                    max={600}
                    value={selected.durationSec}
                    onChange={(e) => updateSelected({ durationSec: Number(e.target.value) })}
                    className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Satzanzahl
                  <input
                    type="number"
                    min={3}
                    max={120}
                    value={selected.itemCount}
                    onChange={(e) => updateSelected({ itemCount: Number(e.target.value) })}
                    className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                  />
                </label>
                {selected.type === 'INTERMEDIATE' && (
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Alle n Sitzungen
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={selected.intervalSessions ?? 10}
                      onChange={(e) => updateSelected({ intervalSessions: Number(e.target.value) })}
                      className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                    />
                  </label>
                )}
              </div>
              <Button
                icon="floppyDisk"
                onClick={() => configMutation.mutate(selected)}
                disabled={configMutation.isPending}
                className="mt-4"
              >
                Konfiguration speichern
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">
                {editingItem ? 'Satz bearbeiten' : 'Neuer Satz'}
              </h3>
              <div className="flex flex-col gap-3">
                <textarea
                  value={itemForm.sentence}
                  onChange={(e) => setItemForm({ ...itemForm, sentence: e.target.value })}
                  rows={2}
                  placeholder="Diagnostik-Satz"
                  className="rounded-lg border border-gray-300 px-3 py-2"
                />
                <div className="flex flex-wrap gap-3 items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={itemForm.isNonsense}
                      onChange={(e) => setItemForm({ ...itemForm, isNonsense: e.target.checked })}
                    />
                    Unsinn-Satz
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    Schwierigkeit
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={itemForm.difficulty}
                      onChange={(e) => setItemForm({ ...itemForm, difficulty: Number(e.target.value) })}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <Button icon="floppyDisk" onClick={saveItem} disabled={itemMutation.isPending}>
                    {editingItem ? 'Speichern' : 'Anlegen'}
                  </Button>
                  {editingItem && (
                    <Button icon="x" variant="ghost" onClick={() => { setEditingItem(null); setItemForm(EMPTY_ITEM) }}>
                      Abbrechen
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Sätze importieren</h3>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 overflow-auto">{EXAMPLE_JSON}</pre>
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder="JSON-Array einfügen"
              />
              <Button
                icon="uploadSimple"
                onClick={importJson}
                disabled={!jsonInput.trim() || importMutation.isPending}
                className="mt-3"
              >
                Importieren
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Satzpool</h3>
                <span className="text-sm text-gray-500">{items?.length ?? 0} Sätze</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Satz</th>
                    <th className="text-center px-3 py-2">Typ</th>
                    <th className="text-center px-3 py-2">Stufe</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items?.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-800">{item.sentence}</td>
                      <td className="px-3 py-2 text-center">{item.isNonsense ? 'Unsinn' : 'Sinn'}</td>
                      <td className="px-3 py-2 text-center">{item.difficulty}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(item)
                            setItemForm(itemInput(item))
                          }}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mr-3"
                        >
                          <PhosphorIcon name="pencilSimple" size={13} />
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(item.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
                        >
                          <PhosphorIcon name="trash" size={13} />
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  )
}
