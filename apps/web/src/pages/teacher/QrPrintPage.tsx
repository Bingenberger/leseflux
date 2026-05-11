import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { getClassQrData } from '../../lib/api.ts'
import { PhosphorIcon } from '../../components/shared/PhosphorIcons.tsx'

function StudentCard({ name, loginCode }: { name: string; loginCode: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current && loginCode) {
      QRCode.toCanvas(canvasRef.current, loginCode, {
        width: 160,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [loginCode])

  return (
    <div
      className="border-2 border-gray-300 rounded-xl p-4 flex flex-col items-center gap-2 break-inside-avoid"
      style={{ width: 200, minHeight: 230 }}
    >
      {loginCode ? (
        <canvas ref={canvasRef} width={160} height={160} />
      ) : (
        <div className="w-40 h-40 bg-gray-100 flex items-center justify-center text-xs text-gray-400 rounded">
          Kein Code
        </div>
      )}
      <p className="font-bold text-lg text-center leading-tight">{name}</p>
      {loginCode && (
        <p className="font-mono text-sm tracking-widest text-gray-600">{loginCode}</p>
      )}
    </div>
  )
}

export default function QrPrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [printed, setPrinted] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['class-qr-data', id],
    queryFn: () => getClassQrData(id!).then((r) => r.data),
    enabled: !!id,
  })

  const handlePrint = () => {
    setPrinted(true)
    window.print()
  }

  return (
    <>
      {/* Druckansicht: Navigation ausblenden */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="min-h-screen bg-white p-8">
        {/* Toolbar (nicht gedruckt) */}
        <div className="no-print flex items-center gap-4 mb-8 border-b pb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <PhosphorIcon name="arrowLeft" size={16} />
            Zurück
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">
            QR-Codes: {data?.className ?? '…'} ({data?.schoolYear ?? ''})
          </h1>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <PhosphorIcon name="printer" size={16} />
            Drucken / Als PDF speichern
          </button>
        </div>

        {/* Druckkopf (sichtbar beim Drucken) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">
            Klasse {data?.className} – {data?.schoolYear}
          </h1>
          <p className="text-sm text-gray-500">Leseflux Login-QR-Codes · Bitte sicher aufbewahren.</p>
        </div>

        {isLoading && <p className="text-gray-500">Lade Schülerdaten...</p>}

        {data && (
          <div
            className="flex flex-wrap gap-4"
            style={{ gap: 16 }}
          >
            {data.students.map((s) => (
              <StudentCard key={s.id} name={s.displayName} loginCode={s.loginCode} />
            ))}
          </div>
        )}

        {data && data.students.length === 0 && (
          <p className="text-gray-400 text-center py-16">
            Keine Schüler in dieser Klasse gefunden.
          </p>
        )}

        {!printed && data && (
          <p className="no-print text-xs text-gray-400 mt-8 text-center">
            Die QR-Codes enthalten den Login-Code jedes Schülers. Kinder können ihn scannen oder abtippen.
          </p>
        )}
      </div>
    </>
  )
}
