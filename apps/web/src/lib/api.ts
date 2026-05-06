import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────

export const loginChild = (qrToken: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login-child', { qrToken })

export const loginTeacher = (email: string, password: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login-teacher', { email, password })

export const logout = () => api.post('/auth/logout')

export const getMe = () => api.get<AuthUser>('/auth/me')

// ── Training ──────────────────────────────────────────────────────────────

export const startSession = (durationMinutes: 10 | 15) =>
  api.post<StartSessionResponse>('/training/start', { durationMinutes })

export const finishSession = (payload: FinishSessionPayload) =>
  api.post<FinishSessionResponse>('/training/finish', payload)

// ── Lehrer ────────────────────────────────────────────────────────────────

export const getClasses = () => api.get<ClassSummary[]>('/teacher/classes')

export const createClass = (name: string, schoolYear: string) =>
  api.post<ClassDetail>('/teacher/classes', { name, schoolYear })

export const getClassDetail = (id: string) =>
  api.get<ClassDetail>(`/teacher/classes/${id}`)

export const deleteClass = (id: string) => api.delete(`/teacher/classes/${id}`)

export const createStudent = (data: CreateStudentData) =>
  api.post<{ student: StudentSummary; qrToken: string }>('/teacher/students', data)

export const deleteStudent = (id: string) => api.delete(`/teacher/students/${id}`)

export const regenerateStudentQr = (id: string) =>
  api.post<{ qrToken: string }>(`/teacher/students/${id}/regenerate-qr`)

export const getStudentsOverview = (classId: string) =>
  api.get<StudentOverview[]>(`/teacher/classes/${classId}/students-overview`)

export const getStudentSessions = (studentId: string, from?: string, to?: string) =>
  api.get<SessionOverview[]>(`/teacher/students/${studentId}/sessions`, {
    params: { from, to },
  })

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  role: 'CHILD' | 'TEACHER' | 'ADMIN'
  displayName: string
  email?: string | null
  classId?: string | null
}

export interface SessionQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
}

export interface StartSessionResponse {
  session: {
    id: string
    targetWpm: number
    fadingMsBase: number
    fadingMsPerChar: number
    durationMinutes: number
  }
  text: {
    id: string
    title: string
    content: string
    wordCount: number
    estimatedSec: number
    questions: SessionQuestion[]
  }
}

export interface FinishSessionPayload {
  sessionId: string
  answers: { questionId: string; selectedIndex: number; responseTimeMs: number }[]
  durationMs: number
}

export interface FinishSessionResponse {
  accuracy: number
  correctCount: number
  totalQuestions: number
  newTargetWpm: number
  offerIntermediateDiagnostic: boolean
}

export interface ClassSummary {
  id: string
  name: string
  schoolYear: string
  _count: { students: number }
}

export interface ClassDetail {
  id: string
  name: string
  schoolYear: string
  students: StudentSummary[]
}

export interface StudentSummary {
  id: string
  displayName: string
  classId: string | null
  birthYear: number | null
  role: string
  createdAt: string
}

export interface StudentOverview {
  id: string
  displayName: string
  currentTargetWpm: number | null
  totalSessions: number
  averageQuizAccuracy: number | null
  lastSessionAt: string | null
  lastSessionAccuracy: number | null
}

export interface SessionOverview {
  id: string
  textTitle: string
  targetWpm: number
  startedAt: string
  durationMs: number | null
  completed: boolean
  quizAccuracy: number | null
}

export interface CreateStudentData {
  displayName: string
  classId?: string
  birthYear?: number
  parentalConsentDate: string
  existingQrToken?: string
}
