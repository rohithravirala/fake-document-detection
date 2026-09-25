import { useState } from 'react'
import { Button } from '@/components/common/Primitives'
import { cn } from '@/lib/utils'

export function DocumentPreview({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [mode, setMode] = useState<'normal' | 'invert' | 'grayscale' | 'contrast'>('normal')
  const [showGrid, setShowGrid] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  const filterClass = {
    normal: '',
    invert: 'invert contrast-125 brightness-90',
    grayscale: 'grayscale contrast-125',
    contrast: 'contrast-175 brightness-105',
  }[mode]

  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setMode('normal')
    setShowGrid(false)
  }

  const isModified = zoom !== 1 || rotation !== 0 || mode !== 'normal' || showGrid

  return (
    <div>
      <div className="relative flex max-h-[360px] min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-line bg-navy-950/5 p-4 group select-none">
        {/* Background crosshair / alignment grid */}
        {showGrid ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'linear-gradient(to right, #3B73F6 1px, transparent 1px), linear-gradient(to bottom, #3B73F6 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
        ) : null}

        <img
          src={src}
          alt={alt}
          className={cn(
            'max-h-[320px] max-w-full origin-center transition-all duration-200 cursor-zoom-in drop-shadow-sm',
            filterClass,
          )}
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
          onClick={() => setLightbox(true)}
        />

        {/* Floating Zoom & Filter Tag */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
          {mode !== 'normal' && (
            <span className="rounded-md bg-navy-900/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-300 backdrop-blur-xs">
              {mode}
            </span>
          )}
          <span className="rounded-md bg-navy-900/90 px-2 py-0.5 font-mono text-[11px] font-bold text-white backdrop-blur-xs">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Forensic Inspection Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(3.5, z + 0.25))}>
          + Zoom
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          - Zoom
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
          ↻ Rotate
        </Button>
        <Button
          size="sm"
          variant={mode === 'invert' ? 'primary' : 'secondary'}
          onClick={() => setMode((m) => (m === 'invert' ? 'normal' : 'invert'))}
          title="Invert colors to expose pixel tampering and hidden fonts"
        >
          Invert
        </Button>
        <Button
          size="sm"
          variant={mode === 'contrast' ? 'primary' : 'secondary'}
          onClick={() => setMode((m) => (m === 'contrast' ? 'normal' : 'contrast'))}
          title="High contrast for faint microprinting and security seals"
        >
          Contrast
        </Button>
        <Button
          size="sm"
          variant={showGrid ? 'primary' : 'secondary'}
          onClick={() => setShowGrid((g) => !g)}
          title="Toggle alignment grid"
        >
          Grid
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setLightbox(true)}>
          Fullscreen
        </Button>
        {isModified ? (
          <Button size="sm" variant="ghost" onClick={handleReset} className="text-ink-muted">
            Reset
          </Button>
        ) : null}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/95 p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto">
            <img
              src={src}
              alt={alt}
              className={cn(
                'max-h-[85vh] max-w-[85vw] object-contain transition-transform',
                filterClass,
              )}
              style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            />
          </div>
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-5 right-5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/40 transition cursor-pointer"
          >
            ✕ Close (ESC)
          </button>
        </div>
      ) : null}
    </div>
  )
}
