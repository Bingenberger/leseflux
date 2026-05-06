import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute.tsx'
import { useAuthStore } from '../store/authStore.ts'

// Child pages
import ChildLoginPage from '../pages/child/LoginPage.tsx'
import ChildHomePage from '../pages/child/HomePage.tsx'
import SessionPage from '../pages/child/SessionPage.tsx'

// Teacher pages
import TeacherLoginPage from '../pages/teacher/LoginPage.tsx'
import DashboardPage from '../pages/teacher/DashboardPage.tsx'
import ClassPage from '../pages/teacher/ClassPage.tsx'
import NewStudentPage from '../pages/teacher/NewStudentPage.tsx'

function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'CHILD') return <Navigate to="/child/home" replace />
  return <Navigate to="/teacher/dashboard" replace />
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        {/* Öffentliche Routen */}
        <Route path="/login" element={<TeacherLoginPage />} />
        <Route path="/child/login" element={<ChildLoginPage />} />

        {/* Kind-Routen */}
        <Route
          path="/child/home"
          element={
            <ProtectedRoute allowedRoles={['CHILD']} redirectTo="/child/login">
              <ChildHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/child/session"
          element={
            <ProtectedRoute allowedRoles={['CHILD']} redirectTo="/child/login">
              <SessionPage />
            </ProtectedRoute>
          }
        />

        {/* Lehrer-Routen */}
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/classes/:id"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <ClassPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/classes/:classId/students/new"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <NewStudentPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
