import { useState } from 'react'
import { Button } from '@/components/common/Primitives'
import { cn } from '@/lib/utils'

/**
 * The document as the officer sees it, with the controls needed to read small
 * print: zoom and rotate. A phone photograph of a card is frequently sideways,
 * and an officer should not have to re-take it just to read a date.
 */
export function DocumentPreview({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  return (
    <div>
      <div className="flex max-h-[320px] items-center justify-center overflow-auto rounded-md border border-line bg-canvas p-3">
        <img
          src={src}
          alt={alt}
          className="max-w-full origin-center transition-transform duration-150"
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
          Zoom in
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          Zoom out
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setRotation((r) => (r + 90) % 360)}>
          Rotate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setZoom(1)
            setRotation(0)
          }}
          className={cn(zoom === 1 && rotation === 0 && 'invisible')}
        >
          Reset
        </Button>
      </div>
    </div>
  )
}
