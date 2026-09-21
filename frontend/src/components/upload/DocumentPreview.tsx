import { useState } from 'react'
import { Button } from '@/components/common/Primitives'
import { cn } from '@/lib/utils'

/**
 * The document as the officer sees it, with the controls needed to read small
 * print: zoom, rotate, high contrast invert, and full-screen lightbox.
 */
export function DocumentPreview({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [invert, setInvert] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  return (
    <div>
      <div className="relative flex max-h-[340px] items-center justify-center overflow-auto rounded-lg border border-line bg-canvas p-3 group">
        <img
          src={src}
          alt={alt}
          className={cn(
            "max-w-full origin-center transition-all duration-150 cursor-zoom-in",
            invert && "invert contrast-125 brightness-90"
          )}
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          onClick={() => setLightbox(true)}
        />
        <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="rounded bg-gray-900/80 px-2 py-1 text-[11px] font-mono text-white">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>
      
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(3.5, z + 0.25))}>
          🔍 Zoom in
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          🔍 Zoom out
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
          🔄 Rotate
        </Button>
        <Button
          size="sm"
          variant={invert ? 'primary' : 'secondary'}
          onClick={() => setInvert((i) => !i)}
          title="Toggle High-Contrast / Invert colors to read faint stamps and MRZ digits"
        >
          🌓 {invert ? 'Normal' : 'High Contrast'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setLightbox(true)}>
          ⛶ Fullscreen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setZoom(1)
            setRotation(0)
            setInvert(false)
          }}
          className={cn((zoom === 1 && rotation === 0 && !invert) && 'invisible')}
        >
          Reset
        </Button>
      </div>

      {/* Lightbox Modal */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto">
            <img
              src={src}
              alt={alt}
              className={cn(
                "max-h-[85vh] max-w-[85vw] object-contain transition-transform",
                invert && "invert contrast-125 brightness-90"
              )}
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/40"
          >
            ✕ Close (Esc)
          </button>
        </div>
      ) : null}
    </div>
  )
}

