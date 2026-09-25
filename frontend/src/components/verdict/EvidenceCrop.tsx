import { useEffect, useRef, useState } from 'react'
import type { BBox } from '@/api/types'

export function EvidenceCrop({
  imageUrl,
  region,
  padding = 0.25,
  maxWidth = 360,
}: {
  imageUrl: string
  region: BBox
  padding?: number
  maxWidth?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const padX = region.w * padding
      const padY = region.h * padding
      const sx = Math.max(0, region.x - padX)
      const sy = Math.max(0, region.y - padY)
      const sw = Math.min(image.naturalWidth - sx, region.w + padX * 2)
      const sh = Math.min(image.naturalHeight - sy, region.h + padY * 2)
      if (sw <= 0 || sh <= 0) {
        setFailed(true)
        return
      }

      const scale = Math.min(maxWidth / sw, 3)
      canvas.width = Math.round(sw * scale)
      canvas.height = Math.round(sh * scale)

      const context = canvas.getContext('2d')
      if (!context) return
      context.imageSmoothingQuality = 'high'
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

      // Highlight the exact tampering or extracted region
      context.strokeStyle = '#dc2626'
      context.lineWidth = 2.5
      context.shadowColor = 'rgba(220, 38, 38, 0.4)'
      context.shadowBlur = 6
      context.strokeRect(
        (region.x - sx) * scale,
        (region.y - sy) * scale,
        region.w * scale,
        region.h * scale,
      )
    }
    image.onerror = () => setFailed(true)
    image.src = imageUrl
  }, [imageUrl, region, padding, maxWidth])

  if (failed) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong p-3 text-[11px] text-ink-faint">
        Evidence region unavailable for crop preview
      </div>
    )
  }

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className="group relative cursor-pointer overflow-hidden rounded-lg border-2 border-line bg-white shadow-xs transition-all hover:border-brand-500 hover:shadow-md"
        title="Click to view full magnification"
      >
        <canvas
          ref={canvasRef}
          className="block transition-transform duration-200 group-hover:scale-105"
          aria-label="Cropped evidence from the document"
        />
        <span className="absolute bottom-1 right-1 rounded bg-navy-950/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
          ZOOM 🔍
        </span>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/90 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setModalOpen(false)}
        >
          <div className="relative max-h-[80vh] max-w-[80vw] rounded-2xl border border-line bg-white p-4 shadow-panel">
            <p className="mb-2 text-xs font-bold text-ink uppercase tracking-wider">
              Forensic Region Magnification
            </p>
            <img
              src={imageUrl}
              alt="High-resolution evidence"
              className="max-h-[65vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setModalOpen(false)}
              className="mt-3 w-full rounded-lg bg-navy-900 py-1.5 text-xs font-bold text-white hover:bg-navy-800"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
