import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { useAuthStore } from '../../store/authStore.ts'
import {
  createSessionTemplate,
  deleteSessionTemplate,
  getSessionTemplates,
  updateSessionTemplate,
} from '../../lib/api.ts'
import type { ExerciseType, SaveSessionTemplateInput, SessionTemplateSummary } from '../../lib/api.ts'

const SYSTEM_TEMPLATE_IDS = new Set(['standard-12-min', 'measurement-day'])

const EXERCISE_LABEL: Record<ExerciseType, string> = {
  FLASH_WORD: 'Wortblitz',
  FADING: 'Fading',
  CLOZE: 'Lückentext',
  SELF_PACED: 'Eigentempo',
}

const EMPTY_TEMPLATE: SaveSessionTemplateInput = {
  name: '',
  isDefault: false,
  visibility: 'PRIVATE',
  blocks: [
    { type: 'FLASH_WORD', targetDurationSec: 120 },
    { type: 'FADING', targetDurationSec: 600 },
    { type: 'CLOZE', targetDurationSec: 180 },
  ],
}

function cloneTemplate(template: SessionTemplateSummary): SaveSessionTemplateInput {
  return {
    name: template.name,
    isDefault: template.isDefault,
    visibility: template.teacherId === null ? 'SCHOOL' : 'PRIVATE',
    blocks: template.blocks.map((block) => ({ ...block })),
  }
}

function minutesLabel(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return `${minutes} Min`
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN'
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SaveSessionTemplateInput>(EMPTY_TEMPLATE)
  const [error, setError] = useState('')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['session-templates'],
    queryFn: () => getSessionTemplates().then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: (payload: SaveSessionTemplateInput) =>
      editingId
        ? updateSessionTemplate(editingId, payload)
        : createSessionTemplate(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session-templates'] })
      setEditingId(null)
      setForm(EMPTY_TEMPLATE)
      setError('')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(message ?? 'Speichern fehlgeschlagen.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSessionTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session-templates'] }),
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(message ?? 'Löschen fehlgeschlagen.')
    },
  })

  const startCreate = () => {
    setEditingId(null)
    setForm({
      ...EMPTY_TEMPLATE,
      blocks: EMPTY_TEMPLATE.blocks.map((block) => ({ ...block })),
    })
    setError('')
  }

  const startEdit = (template: SessionTemplateSummary) => {
    setEditingId(template.id)
    setForm(cloneTemplate(template))
    setError('')
  }

  const updateBlock = (index: number, patch: Partial<SaveSessionTemplateInput['blocks'][number]>) => {
    setForm((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, i) => i === index ? { ...block, ...patch } : block),
    }))
  }

  const removeBlock = (index: number) => {
    setForm((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((_, i) => i !== index),
    }))
  }

  const submit = () => {
    setError('')
    if (!form.name.trim()) {
      setError('Name fehlt.')
      return
    }
    if (!form.blocks.some((block) => block.type === 'FADING' || block.type === 'SELF_PACED')) {
      setError('Mindestens ein Fading- oder Eigentempo-Block ist erforderlich.')
      return
    }
    saveMutation.mutate(form)
  }

  const editingSystemTemplate = editingId ? SYSTEM_TEMPLATE_IDS.has(editingId) : false
  const editingTemplate = editingId ? templates?.find((template) => template.id === editingId) : null
  const editingSchoolTemplate = editingTemplate?.teacherId === null
  const canEditCurrent = !editingTemplate || isAdmin || editingTemplate.teacherId === user?.id

  return (
    <TeacherLayout title="Vorlagen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sitzungs-Vorlagen</h2>
          <p className="text-sm text-gray-500 mt-1">
            Lege fest, welche Übungsblöcke in einer Trainingseinheit vorkommen.
          </p>
        </div>
        <Button icon="plus" onClick={startCreate}>Vorlage erstellen</Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_420px] gap-6">
        <div className="flex flex-col gap-4">
          {isLoading && <p className="text-gray-500">Lade Vorlagen…</p>}
          {templates?.map((template) => (
            <div key={template.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{template.name}</h3>
                    {template.isDefault && (
                      <span className="text-xs bg-blue-50 text-primary px-2 py-0.5 rounded-full">Default</span>
                    )}
                    {SYSTEM_TEMPLATE_IDS.has(template.id) && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">System</span>
                    )}
                    {template.teacherId === null ? (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Schulweit</span>
                    ) : (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                        Privat{template.teacher ? ` · ${template.teacher.displayName}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{template.id}</p>
                </div>
                <div className="flex gap-2">
                  {(isAdmin || template.teacherId === user?.id) && (
                    <button onClick={() => startEdit(template)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      <PhosphorIcon name="pencilSimple" size={15} />
                      Bearbeiten
                    </button>
                  )}
                  {!SYSTEM_TEMPLATE_IDS.has(template.id) && (isAdmin || template.teacherId === user?.id) && (
                    <button
                      onClick={() => deleteMutation.mutate(template.id)}
                      disabled={deleteMutation.isPending}
                      className="inline-flex items-center gap-1 text-sm text-red-500 hover:underline disabled:opacity-50"
                    >
                      <PhosphorIcon name="trash" size={15} />
                      Löschen
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {template.blocks.map((block, index) => (
                  <span key={`${block.type}-${index}`} className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1">
                    {EXERCISE_LABEL[block.type]} · {minutesLabel(block.targetDurationSec)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit sticky top-20">
          <h3 className="font-bold text-gray-900 mb-4">
            {editingId ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
          </h3>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            disabled={!canEditCurrent}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-4"
            placeholder="z. B. Klasse 2 kurz"
          />

          {isAdmin && (
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Sichtbarkeit
              <select
                value={form.visibility ?? 'PRIVATE'}
                onChange={(e) => setForm((prev) => ({
                  ...prev,
                  visibility: e.target.value as 'PRIVATE' | 'SCHOOL',
                  isDefault: e.target.value === 'SCHOOL' ? (prev.isDefault ?? false) : false,
                }))}
                disabled={editingSystemTemplate || !canEditCurrent}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
              >
                <option value="PRIVATE">Privat nur für mich</option>
                <option value="SCHOOL">Schulweit sichtbar</option>
              </select>
            </label>
          )}

          {(!editingSchoolTemplate || isAdmin) && (
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
              <input
                type="checkbox"
                checked={form.isDefault ?? false}
                disabled={(form.visibility ?? 'PRIVATE') !== 'SCHOOL'}
                onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              />
              Als schulweiten System-Default verwenden
            </label>
          )}

          {!canEditCurrent && (
            <p className="text-xs text-gray-400 mb-4">
              Schulweite Vorlagen können von Lehrkräften verwendet, aber nicht bearbeitet werden.
            </p>
          )}

          <div className="flex flex-col gap-3 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Blöcke</p>
              <button
                onClick={() => setForm((prev) => ({
                  ...prev,
                  blocks: [...prev.blocks, { type: 'FADING', targetDurationSec: 300 }],
                }))}
                disabled={editingSystemTemplate || !canEditCurrent}
                className="text-xs text-primary hover:underline disabled:text-gray-300"
              >
                <span className="inline-flex items-center gap-1">
                  <PhosphorIcon name="plus" size={13} />
                  Block hinzufügen
                </span>
              </button>
            </div>

            {editingSystemTemplate && (
              <p className="text-xs text-gray-400">
                System-Vorlagen können nur umbenannt oder als Default markiert werden.
              </p>
            )}

            {form.blocks.map((block, index) => (
              <div key={index} className="grid grid-cols-[1fr_90px_96px] gap-2 items-center">
                <select
                  value={block.type}
                  onChange={(e) => updateBlock(index, { type: e.target.value as ExerciseType })}
                  disabled={editingSystemTemplate || !canEditCurrent}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-50"
                >
                  {Object.entries(EXERCISE_LABEL).map(([type, label]) => (
                    <option key={type} value={type}>{label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={30}
                  max={1800}
                  step={30}
                  value={block.targetDurationSec}
                  onChange={(e) => updateBlock(index, { targetDurationSec: Number(e.target.value) })}
                  disabled={editingSystemTemplate || !canEditCurrent}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-50"
                />
                <button
                  onClick={() => removeBlock(index)}
                  disabled={editingSystemTemplate || !canEditCurrent || form.blocks.length <= 1}
                  className="text-red-500 disabled:text-gray-300"
                  aria-label="Block entfernen"
                >
                  <span className="inline-flex items-center gap-1 text-xs">
                    <PhosphorIcon name="x" size={14} />
                    Entfernen
                  </span>
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button icon="floppyDisk" onClick={submit} disabled={saveMutation.isPending || !canEditCurrent}>
              {saveMutation.isPending ? 'Speichert…' : 'Speichern'}
            </Button>
            <Button icon="arrowClockwise" variant="ghost" onClick={startCreate}>
              Zurücksetzen
            </Button>
          </div>
        </div>
      </div>
    </TeacherLayout>
  )
}
