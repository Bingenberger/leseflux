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
import StudentDetailPage from '../pages/teacher/StudentDetailPage.tsx'
import TextsPage from '../pages/teacher/TextsPage.tsx'
import FlashWordsPage from '../pages/teacher/FlashWordsPage.tsx'
import DiagnosticsPage from '../pages/teacher/DiagnosticsPage.tsx'
import TemplatesPage from '../pages/teacher/TemplatesPage.tsx'
import QrPrintPage from '../pages/teacher/QrPrintPage.tsx'
import AdminTeachersPage from '../pages/admin/TeachersPage.tsx'

// Child diagnostic
import DiagnosticPage from '../pages/child/DiagnosticPage.tsx'

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

        {/* Kind – Diagnostik */}
        <Route
          path="/child/diagnostic/:type"
          element={
            <ProtectedRoute allowedRoles={['CHILD']} redirectTo="/child/login">
              <DiagnosticPage />
            </ProtectedRoute>
          }
        />

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
          path="/teacher/texts"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <TextsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/templates"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <TemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/flash-words"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <FlashWordsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/diagnostics"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <DiagnosticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/students/:id"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <StudentDetailPage />
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
        <Route
          path="/teacher/classes/:id/qr-print"
          element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']} redirectTo="/login">
              <QrPrintPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/teachers"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']} redirectTo="/login">
              <AdminTeachersPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
