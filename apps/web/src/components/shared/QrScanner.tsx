import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (result: string) => void
  onError?: (error: string) => void
}

export function QrScanner({ onScan, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const scannerId = 'leseflux-qr-scanner'
    const scanner = new Html5Qrcode(scannerId)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => onScan(decoded),
        (err) => onError?.(err),
      )
      .catch((err) => onError?.(String(err)))

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [onScan, onError])

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="leseflux-qr-scanner"
        ref={containerRef}
        className="w-full max-w-sm rounded-xl overflow-hidden border-4 border-primary"
      />
      <p className="text-sm text-gray-500">Halte den QR-Code vor die Kamera</p>
    </div>
  )
}
