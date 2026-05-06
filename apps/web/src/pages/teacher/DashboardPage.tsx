import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { getClasses, createClass } from '../../lib/api.ts'

export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newYear, setNewYear] = useState('2025/26')
  const [formError, setFormError] = useState('')

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => getClasses().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => createClass(newName, newYear),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] })
      setShowNew(false)
      setNewName('')
    },
    onError: () => setFormError('Fehler beim Anlegen der Klasse.'),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!newName.trim()) return setFormError('Klassenname erforderlich.')
    createMutation.mutate()
  }

  return (
    <TeacherLayout title="Meine Klassen">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Meine Klassen</h2>
        <Button onClick={() => setShowNew(true)}>+ Neue Klasse</Button>
      </div>

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex flex-col gap-4 max-w-md"
        >
          <h3 className="font-semibold text-gray-800">Neue Klasse anlegen</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Klassenbezeichnung (z. B. „3a")
            </label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="3a"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schuljahr</label>
            <input
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="2025/26"
            />
          </div>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={createMutation.isPending}>
              Anlegen
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-gray-500">Lade Klassen...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes?.map((cls) => (
          <div
            key={cls.id}
            onClick={() => navigate(`/teacher/classes/${cls.id}`)}
            className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-primary hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{cls.name}</p>
                <p className="text-sm text-gray-500 mt-1">{cls.schoolYear}</p>
              </div>
              <span className="bg-blue-50 text-primary text-sm font-semibold px-3 py-1 rounded-full">
                {cls._count.students} Kinder
              </span>
            </div>
          </div>
        ))}
      </div>

      {classes?.length === 0 && !isLoading && (
        <p className="text-gray-500 text-center py-16">
          Noch keine Klassen angelegt. Klicke auf „Neue Klasse", um loszulegen.
        </p>
      )}
    </TeacherLayout>
  )
}
