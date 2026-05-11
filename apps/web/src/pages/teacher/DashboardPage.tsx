import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { getClasses, createClass, deleteClass, getTeachers, updateClassTeacher } from '../../lib/api.ts'
import { useAuthStore } from '../../store/authStore.ts'

export default function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'

  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newYear, setNewYear] = useState('2025/26')
  const [formError, setFormError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: classes, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => getClasses().then((r) => r.data),
  })

  const { data: teachers } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => getTeachers().then((r) => r.data),
    enabled: isAdmin,
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] })
      setDeleteConfirm(null)
    },
  })

  const teacherMutation = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string }) =>
      updateClassTeacher(classId, teacherId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] })
      qc.invalidateQueries({ queryKey: ['teachers'] })
    },
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
        <h2 className="text-2xl font-bold text-gray-900">
          {isAdmin ? 'Alle Klassen' : 'Meine Klassen'}
        </h2>
        <Button icon="plus" onClick={() => setShowNew(true)}>Neue Klasse</Button>
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
            <Button icon="check" type="submit" disabled={createMutation.isPending}>Anlegen</Button>
            <Button icon="x" type="button" variant="ghost" onClick={() => setShowNew(false)}>Abbrechen</Button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-gray-500">Lade Klassen...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes?.map((cls) => (
          <div
            key={cls.id}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-primary hover:shadow-sm transition-all relative group"
          >
            <div
              className="cursor-pointer"
              onClick={() => navigate(`/teacher/classes/${cls.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{cls.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{cls.schoolYear}</p>
                  {isAdmin && cls.teacher && (
                    <p className="text-xs text-gray-400 mt-1">{cls.teacher.displayName}</p>
                  )}
                </div>
                <span className="bg-blue-50 text-primary text-sm font-semibold px-3 py-1 rounded-full">
                  {cls._count.students} Kinder
                </span>
              </div>
            </div>

            {/* Löschen */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col gap-3">
              {isAdmin && (
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                  Lehrkraft
                  <select
                    value={cls.teacher?.id ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => teacherMutation.mutate({ classId: cls.id, teacherId: e.target.value })}
                    disabled={!teachers || teacherMutation.isPending}
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-700 font-normal"
                  >
                    {teachers?.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.displayName}{teacher.role === 'ADMIN' ? ' (Admin)' : ''}
                      </option>
                    ))}
                  </select>
                  {teacherMutation.isPending && <span className="text-gray-400">Speichert…</span>}
                </label>
              )}

              <div className="flex justify-end">
              {deleteConfirm === cls.id ? (
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-gray-600">Wirklich löschen?</span>
                  <button
                    onClick={() => deleteMutation.mutate(cls.id)}
                    className="inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
                  >
                    <PhosphorIcon name="check" size={14} />
                    Ja
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="inline-flex items-center gap-1 text-gray-500 hover:underline"
                  >
                    <PhosphorIcon name="x" size={14} />
                    Nein
                  </button>
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cls.id) }}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:underline"
                >
                  <PhosphorIcon name="trash" size={13} />
                  Klasse löschen
                </button>
              )}
              </div>
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
