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
      window.location.href = window.location.pathname.startsWith('/child') ? '/child/login' : '/login'
    }
    return Promise.reject(err)
  },
)

// ── Auth ──────────────────────────────────────────────────────────────────

export const loginChild = (qrToken: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login-child', { qrToken })

export const loginChildCode = (loginCode: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login-child-code', { loginCode })

export const loginTeacher = (email: string, password: string) =>
  api.post<{ token: string; user: AuthUser }>('/auth/login-teacher', { email, password })

export const logout = () => api.post('/auth/logout')

export const getMe = () => api.get<AuthUser>('/auth/me')

// ── Training ──────────────────────────────────────────────────────────────

export interface MyProgress {
  starCount: number
  streakDays: number
  totalSessions: number
  currentTargetWpm: number | null
  nextTargetWpm: number | null
  sessionsUntilNextCheck: number
  todayDone: boolean
}

export interface TodayProgram {
  todayDone: boolean
  templateName: string | null
  isMeasurementDay: boolean
  totalDurationSec: number
  blocks: { type: ExerciseType; targetDurationSec: number }[]
}

export const getMyProgress = () => api.get<MyProgress>('/training/my-progress')

export const getTodayProgram = () => api.get<TodayProgram>('/training/today-program')

export const startSession = (durationMinutes?: 10 | 15, trainingUnitId?: string) =>
  api.post<StartSessionResponse>('/training/start', { durationMinutes, trainingUnitId })

export const finishExercise = (runId: string, payload: FinishExercisePayload) =>
  api.post<FinishExerciseResponse>(`/training/exercise/${runId}/finish`, payload)

export const startNextReadingExercise = (runId: string) =>
  api.post<ReadingExercise>(`/training/exercise/${runId}/next-reading`)

export const finishSession = (payload: FinishSessionPayload) =>
  api.post<FinishSessionResponse>('/training/finish', payload)

// ── Lehrer ────────────────────────────────────────────────────────────────

export const getClasses = () => api.get<ClassSummary[]>('/teacher/classes')

export const createClass = (name: string, schoolYear: string) =>
  api.post<ClassDetail>('/teacher/classes', { name, schoolYear })

export const getClassDetail = (id: string) =>
  api.get<ClassDetail>(`/teacher/classes/${id}`)

export const deleteClass = (id: string) => api.delete(`/teacher/classes/${id}`)

export const updateClassTemplate = (id: string, sessionTemplateId: string | null) =>
  api.patch<ClassDetail>(`/teacher/classes/${id}/template`, { sessionTemplateId })

export const updateClassTeacher = (id: string, teacherId: string) =>
  api.patch<ClassSummary>(`/admin/classes/${id}/teacher`, { teacherId })

export const createStudent = (data: CreateStudentData) =>
  api.post<{ student: StudentSummary; qrToken: string; loginCode: string }>('/teacher/students', data)

export const deleteStudent = (id: string) => api.delete(`/teacher/students/${id}`)

export const regenerateStudentQr = (id: string) =>
  api.post<{ qrToken: string }>(`/teacher/students/${id}/regenerate-qr`)

export const regenerateStudentCode = (id: string) =>
  api.post<{ loginCode: string }>(`/teacher/students/${id}/regenerate-code`)

export const getStudentsOverview = (classId: string) =>
  api.get<StudentOverview[]>(`/teacher/classes/${classId}/students-overview`)

export const getStudentDetail = (studentId: string) =>
  api.get<StudentOverview>(`/teacher/students/${studentId}`)

export const updateStudentTemplate = (studentId: string, sessionTemplateId: string | null) =>
  api.patch<StudentOverview>(`/teacher/students/${studentId}/template`, { sessionTemplateId })

export const getStudentSessions = (studentId: string, from?: string, to?: string) =>
  api.get<SessionOverview[]>(`/teacher/students/${studentId}/sessions`, {
    params: { from, to },
  })

export const getStudentExercises = (studentId: string, type: ExerciseTypeFilter = 'ALL', from?: string, to?: string) =>
  api.get<ExerciseRunOverview[]>(`/teacher/students/${studentId}/exercises/${type}`, {
    params: { from, to },
  })

// ── Textverwaltung ────────────────────────────────────────────────────────

export const getTexts = () => api.get<TextsByLevel[]>('/teacher/texts')

export const getTextDetail = (id: string) =>
  api.get<TextDetail>(`/teacher/texts/${id}`)

export const importTexts = (data: ImportTextInput[]) =>
  api.post<{ imported: number; skipped: number }>('/teacher/texts/import', data)

export const updateText = (id: string, data: SaveTextInput) =>
  api.patch<TextDetail>(`/teacher/texts/${id}`, data)

export const deleteText = (id: string) => api.delete(`/teacher/texts/${id}`)

export const saveClozeTemplate = (id: string, data: SaveClozeTemplateInput) =>
  api.post<ClozeTemplateDetail>(`/teacher/texts/${id}/cloze-template`, data)

export const importAntonStudents = (payload: {
  defaultClassId?: string
  rows: { vorname: string; nachname?: string; klasse?: string; antonCode: string; schuljahr?: string }[]
}) => api.post<{ imported: number; skipped: string[] }>('/teacher/students/import-anton', payload)

export const importFlashWords = (data: ImportFlashWordInput[]) =>
  api.post<{ imported: number; updated: number }>('/teacher/flash-words/import', data)

export const getFlashWords = (params?: { q?: string; level?: number | null }) =>
  api.get<FlashWordDetail[]>('/teacher/flash-words', { params })

export const createFlashWord = (data: SaveFlashWordInput) =>
  api.post<FlashWordDetail>('/teacher/flash-words', data)

export const updateFlashWord = (id: string, data: SaveFlashWordInput) =>
  api.patch<FlashWordDetail>(`/teacher/flash-words/${id}`, data)

export const deleteFlashWord = (id: string) =>
  api.delete(`/teacher/flash-words/${id}`)

export interface DiagnosticAnswerDetail {
  sentence: string
  isNonsense: boolean
  difficulty: number
  answer: 'TRUE' | 'FALSE' | 'SKIP'
  isCorrect: boolean
  responseTimeMs: number
}

export interface DiagnosticResultDetail {
  id: string
  type: 'ENTRY' | 'INTERMEDIATE'
  name: string
  startedAt: string
  finishedAt: string | null
  estimatedWpm: number | null
  correctCount: number
  wrongCount: number
  skippedCount: number
  answers: DiagnosticAnswerDetail[]
}

export interface DiagnosticConfig {
  id: string
  type: 'ENTRY' | 'INTERMEDIATE'
  name: string
  durationSec: number
  itemCount: number
  intervalSessions: number | null
  itemTotal: number
  resultTotal: number
}

export interface SaveDiagnosticConfigInput {
  name: string
  durationSec: number
  itemCount: number
  intervalSessions?: number | null
}

export interface DiagnosticItemDetail {
  id: string
  diagnosticId: string
  sentence: string
  isNonsense: boolean
  orderIndex: number
  difficulty: number
}

export interface SaveDiagnosticItemInput {
  sentence: string
  isNonsense: boolean
  difficulty: number
}

export const getStudentDiagnostics = (studentId: string) =>
  api.get<DiagnosticResultDetail[]>(`/teacher/students/${studentId}/diagnostics`)

export const getDiagnostics = () =>
  api.get<DiagnosticConfig[]>('/teacher/diagnostics')

export const updateDiagnostic = (id: string, data: SaveDiagnosticConfigInput) =>
  api.patch<DiagnosticConfig>(`/teacher/diagnostics/${id}`, data)

export const getDiagnosticItems = (id: string) =>
  api.get<DiagnosticItemDetail[]>(`/teacher/diagnostics/${id}/items`)

export const createDiagnosticItem = (diagnosticId: string, data: SaveDiagnosticItemInput) =>
  api.post<DiagnosticItemDetail>(`/teacher/diagnostics/${diagnosticId}/items`, data)

export const importDiagnosticItems = (diagnosticId: string, data: SaveDiagnosticItemInput[]) =>
  api.post<{ imported: number; skipped: number }>(`/teacher/diagnostics/${diagnosticId}/items/import`, data)

export const updateDiagnosticItem = (id: string, data: SaveDiagnosticItemInput) =>
  api.patch<DiagnosticItemDetail>(`/teacher/diagnostic-items/${id}`, data)

export const deleteDiagnosticItem = (id: string) =>
  api.delete(`/teacher/diagnostic-items/${id}`)

export const exportStudentJson = (studentId: string) =>
  api.get(`/teacher/students/${studentId}/export.json`, { responseType: 'blob' })

export const exportStudentCsv = (studentId: string) =>
  api.get(`/teacher/students/${studentId}/export.csv`, { responseType: 'blob' })

export const getClassQrData = (classId: string) =>
  api.get<ClassQrData>(`/teacher/classes/${classId}/qr-data`)

export const getSessionTemplates = () =>
  api.get<SessionTemplateSummary[]>('/teacher/session-templates')

export const createSessionTemplate = (data: SaveSessionTemplateInput) =>
  api.post<SessionTemplateSummary>('/teacher/session-templates', data)

export const updateSessionTemplate = (id: string, data: Partial<SaveSessionTemplateInput>) =>
  api.patch<SessionTemplateSummary>(`/teacher/session-templates/${id}`, data)

export const deleteSessionTemplate = (id: string) =>
  api.delete(`/teacher/session-templates/${id}`)

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.patch<{ ok: boolean }>('/teacher/me/password', { currentPassword, newPassword })

// ── Admin ─────────────────────────────────────────────────────────────────

// ── Einstellungen ─────────────────────────────────────────────────────────

export type ChildLoginMethod = 'QR_AND_CODE' | 'QR_ONLY' | 'CODE_ONLY'
export interface PublicSettings { childLoginMethods: ChildLoginMethod }

export const getPublicSettings = () => api.get<PublicSettings>('/settings')
export const getAdminSettings = () => api.get<PublicSettings>('/admin/settings')
export const updateAdminSettings = (data: { childLoginMethods?: ChildLoginMethod }) =>
  api.patch<PublicSettings>('/admin/settings', data)

// ── Admin: Lehrkräfte ──────────────────────────────────────────────────────

export const getTeachers = () => api.get<TeacherSummary[]>('/admin/teachers')

export const createTeacher = (data: { displayName: string; email: string; password: string }) =>
  api.post<TeacherSummary>('/admin/teachers', data)

export const updateTeacher = (
  id: string,
  data: { displayName?: string; email?: string; password?: string },
) => api.patch<TeacherSummary>(`/admin/teachers/${id}`, data)

export const deleteTeacher = (id: string) => api.delete(`/admin/teachers/${id}`)

export const importTeachers = (
  data: { displayName: string; email: string; password: string }[],
) => api.post<{ imported: number; skipped: string[] }>('/admin/teachers/import', data)

// ── Diagnostik ────────────────────────────────────────────────────────────

export const checkDiagnostic = () =>
  api.get<{ needsEntry: boolean }>('/diagnostic/check')

export const startDiagnostic = (type: 'ENTRY' | 'INTERMEDIATE') =>
  api.post<StartDiagnosticResponse>('/diagnostic/start', { type })

export const finishDiagnostic = (resultId: string, data: FinishDiagnosticPayload) =>
  api.post<{ estimatedWpm: number; newTargetWpm: number }>(`/diagnostic/${resultId}/finish`, data)

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
  sessionId: string
  templateName: string
  trainingUnitId: string
  exercises: TrainingExercise[]
}

export type ReadingExercise = FadingExercise | SelfPacedExercise
export type TrainingExercise = ReadingExercise | FlashWordExercise | ClozeExercise

export interface FadingExercise {
  runId: string
  type: 'FADING'
  targetDurationSec: number
  fadingTargetWpm: number
  fadingMsBase: number
  fadingMsPerChar: number
  text: {
    id: string
    title: string
    content: string
    wordCount: number
    estimatedSec: number
  }
  questions: SessionQuestion[]
}

export interface SelfPacedExercise {
  runId: string
  type: 'SELF_PACED'
  targetDurationSec: number
  text: {
    id: string
    title: string
    content: string
    wordCount: number
    estimatedSec: number
  }
  questions: SessionQuestion[]
}

export interface FlashWordItem {
  id: string
  word: string
  syllables: number
  difficultyLevel: number
  options: string[]
}

export interface FlashWordExercise {
  runId: string
  type: 'FLASH_WORD'
  targetDurationSec: number
  flashDurationMs: number
  flashDifficulty: number
  words: FlashWordItem[]
}

export interface ClozeGap {
  id: string
  wordIndex: number
  correctWord: string
  distractors: string[]
  options: string[]
}

export interface ClozeExercise {
  runId: string
  type: 'CLOZE'
  targetDurationSec: number
  text: {
    id: string
    title: string
    content: string
    wordCount: number
    estimatedSec: number
  }
  words: string[]
  gaps: ClozeGap[]
}

export type ExerciseResponse =
  | { questionId: string; selectedIndex: number; responseTimeMs: number }
  | { itemId: string; word: string; selectedWord: string; isCorrect: boolean; responseTimeMs: number }
  | {
      gapId: string
      wordIndex: number
      correctWord: string
      selectedWord: string
      isCorrect: boolean
      responseTimeMs: number
    }
  | { event: 'READING_DONE'; wordCount: number; durationMs: number }

export interface FinishExercisePayload {
  responses: ExerciseResponse[]
  durationMs: number
}

export interface FinishExerciseResponse {
  accuracy: number
  correctCount: number
  totalQuestions: number
}

export interface FinishSessionPayload {
  sessionId: string
  totalDurationMs: number
}

export interface FinishSessionResponse {
  accuracy: number
  correctCount: number
  totalQuestions: number
  newTargetWpm: number
  offerIntermediateDiagnostic: boolean
  starsEarned?: number
  streakDays?: number
}

export interface ClassSummary {
  id: string
  name: string
  schoolYear: string
  _count: { students: number }
  teacher?: { id: string; displayName: string; email: string | null }
}

export interface ClassDetail {
  id: string
  name: string
  schoolYear: string
  sessionTemplateId?: string | null
  sessionTemplate?: SessionTemplateSummary | null
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
  loginCode?: string | null
  classId?: string | null
  className?: string | null
  classSessionTemplateId?: string | null
  sessionTemplateId?: string | null
  sessionTemplate?: SessionTemplateSummary | null
  currentTargetWpm: number | null
  totalSessions: number
  averageQuizAccuracy: number | null
  lastSessionAt: string | null
  lastSessionAccuracy: number | null
  starCount?: number
  streakDays?: number
}

export interface SessionOverview {
  id: string
  textTitle: string
  targetWpm: number
  measuredWpm: number | null
  wpmFlag: 'UNREALISTIC' | null
  startedAt: string
  durationMs: number | null
  completed: boolean
  quizAccuracy: number | null
}

export type ExerciseType = 'FADING' | 'FLASH_WORD' | 'CLOZE' | 'SELF_PACED'
export type ExerciseTypeFilter = ExerciseType | 'ALL'

export interface ExerciseRunOverview {
  id: string
  sessionId: string
  exerciseType: ExerciseType
  textTitle: string | null
  startedAt: string
  sessionStartedAt: string
  durationMs: number | null
  itemsTotal: number
  itemsCorrect: number
  accuracy: number | null
  targetWpm: number | null
  measuredWpm: number | null
  wpmFlag: 'UNREALISTIC' | null
}

export interface TextSummary {
  id: string
  title: string
  targetLevel: number
  wordCount: number
  lixScore: number
}

export interface TextQuestionDetail {
  id: string
  question: string
  options: string[]
  correctIndex: number
  orderIndex: number
}

export interface ClozeGapDetail {
  id: string
  wordIndex: number
  correctWord: string
  distractors: string[]
}

export interface ClozeTemplateDetail {
  id: string
  textId: string
  strategy: 'AUTO_EVERY_N' | 'MANUAL'
  gapInterval: number | null
  gaps: ClozeGapDetail[]
}

export interface TextDetail {
  id: string
  title: string
  content: string
  wordCount: number
  lixScore: number
  targetLevel: number
  estimatedSec: number
  questions: TextQuestionDetail[]
  clozeTemplate: ClozeTemplateDetail | null
}

export interface SaveClozeTemplateInput {
  strategy: 'AUTO_EVERY_N' | 'MANUAL'
  gapInterval?: number
  gaps?: { wordIndex: number; correctWord: string; distractors: string[] }[]
}

export interface SessionTemplateSummary {
  id: string
  name: string
  isDefault: boolean
  teacherId: string | null
  teacher?: { id: string; displayName: string } | null
  blocks: { type: ExerciseType; targetDurationSec: number }[]
  createdAt: string
}

export interface SaveSessionTemplateInput {
  name: string
  isDefault?: boolean
  visibility?: 'PRIVATE' | 'SCHOOL'
  blocks: { type: ExerciseType; targetDurationSec: number }[]
}

export interface TextsByLevel {
  level: number
  texts: TextSummary[]
}

export interface ImportTextInput {
  title: string
  content: string
  targetLevel: 2 | 3 | 4
  questions: { question: string; options: string[]; correctIndex: number }[]
}

export interface ImportFlashWordInput {
  word: string
  syllables: number
  difficultyLevel: number
  distractors: string[]
}

export interface SaveTextInput {
  title: string
  content: string
  targetLevel: 2 | 3 | 4
  questions: { question: string; options: string[]; correctIndex: number }[]
}

export interface FlashWordDetail {
  id: string
  word: string
  syllables: number
  difficultyLevel: number
  distractors: string[]
  createdAt: string
}

export interface SaveFlashWordInput {
  word: string
  syllables: number
  difficultyLevel: number
  distractors: string[]
}

export interface TeacherSummary {
  id: string
  displayName: string
  email: string | null
  role: 'TEACHER' | 'ADMIN'
  createdAt: string
  classCount: number
}

export interface ClassQrData {
  className: string
  schoolYear: string
  students: { id: string; displayName: string; loginCode: string | null }[]
}

export interface DiagnosticItem {
  id: string
  sentence: string
  orderIndex: number
  difficulty: number
}

export interface StartDiagnosticResponse {
  resultId: string
  durationSec: number
  items: DiagnosticItem[]
}

export interface FinishDiagnosticPayload {
  answers: { itemId: string; answer: 'TRUE' | 'FALSE' | 'SKIP'; responseTimeMs: number }[]
  durationMs: number
}

export interface CreateStudentData {
  displayName: string
  classId?: string
  birthYear?: number
  parentalConsentDate: string
  existingQrToken?: string
}
