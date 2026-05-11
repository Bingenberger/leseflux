import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

interface Props {
  onScan: (result: string) => void
}

type Status = 'starting' | 'active' | 'error'

export function QrScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [status, setStatus] = useState<Status>('starting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let rafId: number
    let stopped = false

    const scan = () => {
      if (stopped) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < 2) {
        rafId = requestAnimationFrame(scan)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) { rafId = requestAnimationFrame(scan); return }

      ctx.drawImage(video, 0, 0)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height, {
        inversionAttempts: 'dontInvert',
      })
      if (code?.data) {
        stopped = true
        onScanRef.current(code.data)
        return
      }
      rafId = requestAnimationFrame(scan)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        setStatus('active')
        scan()
      } catch (err) {
        if (stopped) return
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(
          msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')
            ? 'Kamerazugriff verweigert. Bitte erlaube den Kamerazugriff in den Browser-Einstellungen.'
            : 'Kamera konnte nicht geöffnet werden.',
        )
        setStatus('error')
      }
    })()

    return () => {
      stopped = true
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 p-6 bg-orange-50 rounded-2xl border border-orange-200 max-w-sm w-full">
        <span className="text-3xl">📷</span>
        <p className="text-warning font-medium text-center text-sm">{errorMsg}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* Kamerabild */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full rounded-2xl bg-gray-900"
        style={{ aspectRatio: '1 / 1', objectFit: 'cover' }}
      />

      {/* Scan-Canvas (versteckt) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Lade-Overlay */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl">
          <p className="text-white text-sm animate-pulse">Kamera wird geöffnet…</p>
        </div>
      )}

      {/* Sucherrahmen mit Ecken */}
      {status === 'active' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Abgedunkelter Bereich außerhalb des Rahmens */}
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              background:
                'radial-gradient(ellipse 58% 58% at 50% 50%, transparent 0%, rgba(0,0,0,0.5) 100%)',
            }}
          />
          {/* Rahmen-Ecken */}
          <div className="relative w-52 h-52">
            <Corner pos="tl" />
            <Corner pos="tr" />
            <Corner pos="bl" />
            <Corner pos="br" />
            {/* Scan-Linie */}
            <div
              className="absolute left-1 right-1 h-0.5 bg-primary rounded-full opacity-90"
              style={{ animation: 'scanline 2s ease-in-out infinite', top: '50%' }}
            />
          </div>
        </div>
      )}

      {status === 'active' && (
        <p className="absolute bottom-3 left-0 right-0 text-center text-white text-sm font-semibold drop-shadow-md">
          QR-Code in den Rahmen halten
        </p>
      )}

      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(-52px); opacity: 0.4; }
          50%  { opacity: 1; }
          100% { transform: translateY(52px); opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = pos.startsWith('t')
  const left = pos.endsWith('l')
  return (
    <div
      className="absolute w-9 h-9 border-primary"
      style={{
        top: top ? 0 : undefined,
        bottom: top ? undefined : 0,
        left: left ? 0 : undefined,
        right: left ? undefined : 0,
        borderTopWidth: top ? 3 : 0,
        borderBottomWidth: top ? 0 : 3,
        borderLeftWidth: left ? 3 : 0,
        borderRightWidth: left ? 0 : 3,
        borderTopLeftRadius: pos === 'tl' ? 6 : 0,
        borderTopRightRadius: pos === 'tr' ? 6 : 0,
        borderBottomLeftRadius: pos === 'bl' ? 6 : 0,
        borderBottomRightRadius: pos === 'br' ? 6 : 0,
      }}
    />
  )
}
