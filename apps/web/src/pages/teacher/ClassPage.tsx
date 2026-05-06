import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { StudentTable } from '../../components/teacher/StudentTable.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { getStudentsOverview } from '../../lib/api.ts'

export default function ClassPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: students, isLoading } = useQuery({
    queryKey: ['students-overview', id],
    queryFn: () => getStudentsOverview(id!).then((r) => r.data),
    enabled: !!id,
  })

  return (
    <TeacherLayout title="Klasse">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Schülerübersicht</h2>
        <Button onClick={() => navigate(`/teacher/classes/${id}/students/new`)}>
          + Schüler hinzufügen
        </Button>
      </div>

      {isLoading && <p className="text-gray-500">Lade Übersicht...</p>}
      {students && <StudentTable students={students} classId={id!} />}
    </TeacherLayout>
  )
}
