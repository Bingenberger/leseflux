import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { useAuthStore } from '../../store/authStore.ts'
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

const EMPTY_ITEM: SaveDiagnosticItemInput = { sentence: '', isNonsense: false, difficulty: 1 }

function itemInput(item?: DiagnosticItemDetail): SaveDiagnosticItemInput {
  return item
    ? { sentence: item.sentence, isNonsense: item.isNonsense, difficulty: item.difficulty }
    : EMPTY_ITEM
}

export default function DiagnosticsPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<DiagnosticItemDetail | null>(null)
  const [itemForm, setItemForm] = useState<SaveDiagnosticItemInput>(EMPTY_ITEM)
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setMessage(`${data.imported} Sätze importiert${data.skipped ? `, ${data.skipped} übersprungen` : ''}.`)
    },
    onError: () => setMessage('Import fehlgeschlagen. Bitte JSON-Datei prüfen.'),
  })

  const updateSelected = (patch: Partial<DiagnosticConfig>) => {
    if (!selected) return
    qc.setQueryData<DiagnosticConfig[]>(['diagnostics'], (prev) =>
      prev?.map((d) => d.id === selected.id ? { ...d, ...patch } : d),
    )
  }

  const saveItem = () => {
    const payload = { ...itemForm, sentence: itemForm.sentence.trim() }
    if (!payload.sentence) { setMessage('Satz fehlt.'); return }
    itemMutation.mutate(payload)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as SaveDiagnosticItemInput[]
        if (!Array.isArray(parsed)) throw new Error()
        importMutation.mutate(parsed)
      } catch {
        setMessage('Ungültige JSON-Datei.')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <TeacherLayout title="Diagnostik">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Diagnostik</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? 'Konfiguration und Satzpool der Diagnostiken verwalten.'
              : 'Dauer, Satzanzahl und Zeitpunkt der Zwischendiagnostik konfigurieren.'}
          </p>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Lade Diagnostik…</p>}
      {message && (
        <p className="mb-4 text-sm text-primary cursor-pointer" onClick={() => setMessage('')}>
          {message}
        </p>
      )}

      {diagnostics && selected && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Linke Spalte: Diagnostik-Auswahl */}
          <div className="flex flex-col gap-3">
            {diagnostics.map((d) => (
              <button
                key={d.id}
                onClick={() => { setSelectedId(d.id); setEditingItem(null); setItemForm(EMPTY_ITEM) }}
                className={[
                  'text-left bg-white rounded-xl border p-4 hover:border-primary',
                  selected.id === d.id ? 'border-primary' : 'border-gray-200',
                ].join(' ')}
              >
                <p className="font-bold text-gray-900 inline-flex items-center gap-2">
                  <PhosphorIcon name="listChecks" size={18} />
                  {TYPE_LABEL[d.type]}
                </p>
                <p className="text-sm text-gray-500">{d.itemTotal} Sätze · {d.durationSec} s</p>
              </button>
            ))}
          </div>

          {/* Rechte Spalte */}
          <div className="flex flex-col gap-6">
            {/* Konfiguration – für alle Lehrkräfte */}
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
                    type="number" min={30} max={600}
                    value={selected.durationSec}
                    onChange={(e) => updateSelected({ durationSec: Number(e.target.value) })}
                    className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                  Satzanzahl
                  <input
                    type="number" min={3} max={120}
                    value={selected.itemCount}
                    onChange={(e) => updateSelected({ itemCount: Number(e.target.value) })}
                    className="rounded-lg border border-gray-300 px-3 py-2 font-normal"
                  />
                </label>
                {selected.type === 'INTERMEDIATE' && (
                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Alle n Sitzungen
                    <input
                      type="number" min={1} max={100}
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

            {/* Satz anlegen/bearbeiten – nur Admin */}
            {isAdmin && (
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
                        type="number" min={1} max={5}
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
            )}

            {/* Import – nur Admin */}
            {isAdmin && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-1">Sätze importieren</h3>
                <p className="text-sm text-gray-500 mb-3">
                  JSON-Datei mit Array aus <code className="bg-gray-100 px-1 rounded">{'{ sentence, isNonsense, difficulty }'}</code>
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="diagnostic-import-file"
                  />
                  <Button
                    icon="uploadSimple"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? 'Importiere…' : 'JSON-Datei wählen'}
                  </Button>
                </div>
              </div>
            )}

            {/* Satzpool – für alle lesbar, Admin kann bearbeiten */}
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
                    {isAdmin && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {items?.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-gray-800">{item.sentence}</td>
                      <td className="px-3 py-2 text-center">{item.isNonsense ? 'Unsinn' : 'Sinn'}</td>
                      <td className="px-3 py-2 text-center">{item.difficulty}</td>
                      {isAdmin && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => { setEditingItem(item); setItemForm(itemInput(item)) }}
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
                      )}
                    </tr>
                  ))}
                  {items?.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className="px-4 py-6 text-center text-gray-400">
                        Noch keine Sätze vorhanden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  )
}
