import { useEffect, useRef, useState } from 'react'
import type { BBox } from '@/api/types'

/**
 * Draw the pixels a check actually failed on.
 *
 * The backend returns a bounding box for every extracted field. The original
 * image is drawn to a canvas and that region cropped out, so the officer sees
 * the print itself rather than a sentence describing it. This is the difference
 * between evidence and an assertion.
 */
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

      // Outline the exact region the check refers to, inside the padded crop.
      context.strokeStyle = '#dc2626'
      context.lineWidth = 2
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
      <p className="text-[11.5px] text-ink-faint">The source image is no longer available to crop.</p>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="rounded border border-line-strong bg-white"
      aria-label="Cropped evidence from the document"
    />
  )
}
