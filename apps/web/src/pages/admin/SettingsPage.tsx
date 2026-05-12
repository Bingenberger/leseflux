import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { getAdminSettings, updateAdminSettings } from '../../lib/api.ts'
import type { ChildLoginMethod } from '../../lib/api.ts'

const METHOD_OPTIONS: { value: ChildLoginMethod; label: string; description: string }[] = [
  {
    value: 'QR_AND_CODE',
    label: 'QR-Code und Login-Code',
    description: 'Kinder können sich wahlweise per QR-Code scannen oder Code eintippen.',
  },
  {
    value: 'QR_ONLY',
    label: 'Nur QR-Code',
    description: 'Kinder melden sich ausschließlich per QR-Code-Scan an.',
  },
  {
    value: 'CODE_ONLY',
    label: 'Nur Login-Code',
    description: 'Kinder melden sich ausschließlich durch Eingabe ihres Codes an.',
  },
]

export default function AdminSettingsPage() {
  const qc = useQueryClient()
  const [message, setMessage] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => getAdminSettings().then((r) => r.data),
  })

  const [selected, setSelected] = useState<ChildLoginMethod | null>(null)
  const current = selected ?? settings?.childLoginMethods ?? 'QR_AND_CODE'

  const mutation = useMutation({
    mutationFn: (childLoginMethods: ChildLoginMethod) =>
      updateAdminSettings({ childLoginMethods }),
    onSuccess: ({ data }) => {
      qc.setQueryData(['admin-settings'], data)
      qc.invalidateQueries({ queryKey: ['public-settings'] })
      setSelected(null)
      setMessage('Einstellungen gespeichert.')
    },
    onError: () => setMessage('Fehler beim Speichern.'),
  })

  return (
    <TeacherLayout title="Einstellungen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Einstellungen</h2>
          <p className="text-sm text-gray-500 mt-1">Systemweite Konfiguration der App.</p>
        </div>
      </div>

      {message && (
        <p className="mb-4 text-sm text-primary cursor-pointer" onClick={() => setMessage('')}>
          {message}
        </p>
      )}

      {isLoading && <p className="text-gray-500">Lade Einstellungen…</p>}

      {settings && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-xl">
          <h3 className="font-semibold text-gray-900 mb-1">Schüler-Anmeldeoptionen</h3>
          <p className="text-sm text-gray-500 mb-4">
            Welche Anmeldemethoden auf dem Schüler-Login-Bildschirm angeboten werden.
          </p>

          <div className="flex flex-col gap-3 mb-5">
            {METHOD_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={[
                  'flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors',
                  current === opt.value
                    ? 'border-primary bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="childLoginMethods"
                  value={opt.value}
                  checked={current === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="mt-1 accent-primary"
                />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          <Button
            icon="floppyDisk"
            onClick={() => mutation.mutate(current)}
            disabled={mutation.isPending || current === settings.childLoginMethods}
          >
            Speichern
          </Button>
        </div>
      )}
    </TeacherLayout>
  )
}
