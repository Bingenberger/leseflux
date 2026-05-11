import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { TeacherLayout } from '../../components/shared/Layout.tsx'
import { Button } from '../../components/shared/Button.tsx'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'
import { QrCodeDisplay } from '../../components/shared/QrCodeDisplay.tsx'
import { QrScanner } from '../../components/shared/QrScanner.tsx'
import { createStudent, regenerateStudentQr } from '../../lib/api.ts'

type Step = 'form' | 'qr-display'

export default function NewStudentPage() {
  const { classId } = useParams<{ classId: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('form')
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [consentChecked, setConsentChecked] = useState(false)
  const [showAntonScanner, setShowAntonScanner] = useState(false)
  const [createdQrToken, setCreatedQrToken] = useState('')
  const [createdStudentName, setCreatedStudentName] = useState('')
  const [createdLoginCode, setCreatedLoginCode] = useState('')
  const [formError, setFormError] = useState('')

  const [antonToken, setAntonToken] = useState<string | undefined>(undefined)

  const doCreate = (existingQrToken?: string) => {
    const payload: Parameters<typeof createStudent>[0] = {
      displayName,
      parentalConsentDate: new Date().toISOString(),
    }
    if (classId) payload.classId = classId
    if (birthYear) payload.birthYear = Number(birthYear)
    if (existingQrToken) payload.existingQrToken = existingQrToken
    return createStudent(payload)
  }

  const createMutation = useMutation({
    mutationFn: () => doCreate(antonToken),
    onSuccess: ({ data }) => {
      setCreatedQrToken(data.qrToken)
      setCreatedStudentName(data.student.displayName)
      setCreatedLoginCode(data.loginCode ?? '')
      setStep('qr-display')
    },
    onError: () => setFormError('Fehler beim Anlegen des Schülers.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!displayName.trim()) return setFormError('Name erforderlich.')
    if (!consentChecked)
      return setFormError(
        'Bitte bestätige, dass die schriftliche Einwilligung der Erziehungsberechtigten vorliegt.',
      )
    createMutation.mutate()
  }

  // Anton-Ausweis einscannen: gespeicherter QR-Inhalt wird als Identifier genutzt
  const handleAntonScan = (token: string) => {
    setAntonToken(token)
    setShowAntonScanner(false)
  }

  if (step === 'qr-display') {
    return (
      <TeacherLayout title="QR-Code">
        <div className="max-w-md mx-auto flex flex-col items-center gap-6 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">QR-Code für {createdStudentName}</h2>
            <p className="text-gray-500 mt-2 text-sm">
              Drucke diesen QR-Code aus und gib ihn dem Kind. Er wird nicht erneut angezeigt.
            </p>
          </div>

          <QrCodeDisplay value={createdQrToken} label={createdStudentName} size={250} />

          {createdLoginCode && (
            <div className="text-center bg-blue-50 rounded-xl border border-primary/20 px-6 py-4 w-full">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                Login-Code (Testphase)
              </p>
              <p className="text-3xl font-bold tracking-[0.25em] text-primary">
                {createdLoginCode}
              </p>
            </div>
          )}

          <div className="flex gap-3 w-full">
            <Button
              icon="printer"
              variant="ghost"
              className="flex-1"
              onClick={() => window.print()}
            >
              Drucken
            </Button>
            <Button
              icon="check"
              className="flex-1"
              onClick={() => navigate(`/teacher/classes/${classId}`)}
            >
              Fertig
            </Button>
          </div>
        </div>
      </TeacherLayout>
    )
  }

  return (
    <TeacherLayout title="Neuer Schüler">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Schüler hinzufügen</h2>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Spitzname / Vorname
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder='z. B. „Mia"'
            />
            <p className="text-xs text-gray-400 mt-1">Kein Nachname erforderlich.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Geburtsjahr (optional)
            </label>
            <input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="2017"
              min={2010}
              max={2025}
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <input
              type="checkbox"
              id="consent"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <label htmlFor="consent" className="text-sm text-amber-900">
              Ich bestätige, dass die{' '}
              <strong>schriftliche Einwilligung der Erziehungsberechtigten</strong> für die
              Verarbeitung der Daten dieses Kindes vorliegt (DSGVO Art. 8).
            </label>
          </div>

          {formError && <p className="text-red-600 text-sm">{formError}</p>}

          <Button icon="userPlus" type="submit" disabled={createMutation.isPending} className="w-full">
            {createMutation.isPending ? 'Wird angelegt...' : 'Schüler anlegen & QR generieren'}
          </Button>
        </form>

        <div className="mt-4 text-center flex flex-col gap-2">
          <button
            onClick={() => setShowAntonScanner((v) => !v)}
            className="inline-flex items-center justify-center gap-1 text-sm text-primary underline"
          >
            <PhosphorIcon name="uploadSimple" size={15} />
            Anton-Ausweis einscannen (bestehenden QR zuordnen)
          </button>
          {antonToken && (
            <p className="text-sm text-success font-medium">
              ✓ Anton-QR gescannt — wird beim Anlegen verwendet.
            </p>
          )}
          {showAntonScanner && (
            <div className="mt-4">
              <QrScanner onScan={handleAntonScan} />
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  )
}
