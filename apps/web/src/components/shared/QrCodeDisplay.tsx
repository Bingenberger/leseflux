import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

interface Props {
  value: string
  label?: string
  size?: number
}

export function QrCodeDisplay({ value, label, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 2 }).catch(console.error)
  }, [value, size])

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded-lg border border-gray-200" />
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
    </div>
  )
}
