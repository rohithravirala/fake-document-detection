import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/common/Primitives'
import { IconCamera } from '@/components/common/Icons'

export function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setActive(false)
  }, [])

  useEffect(() => stop, [stop])

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } },
      })
      streamRef.current = stream
      setActive(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in browser settings.'
          : 'Unable to initialize device camera feed.',
      )
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      onCapture(new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' }))
      stop()
    }, 'image/png')
  }

  if (!supported) {
    return (
      <p className="text-xs text-ink-muted">
        Live camera scanner requires a secure context (HTTPS or localhost).
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {active ? (
        <div className="relative overflow-hidden rounded-2xl border-2 border-brand-500 bg-black shadow-panel">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-h-[380px] object-cover"
          />

          {/* Viewfinder Target Overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="relative h-[80%] w-[90%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 border-amber-400" />
              <div className="absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 border-amber-400" />
              <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-amber-400" />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-amber-400" />
              <span className="absolute top-2 left-3 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-300 drop-shadow">
                ALIGN DOCUMENT BOUNDS
              </span>
            </div>
          </div>

          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 z-10">
            <Button variant="primary" size="md" onClick={capture} className="shadow-lg px-6">
              📸 Snapshot
            </Button>
            <Button variant="secondary" size="md" onClick={stop} className="bg-white/90">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={start} className="gap-2">
          <IconCamera className="h-4 w-4" />
          <span>Live Camera Scan</span>
        </Button>
      )}

      {error ? (
        <p className="rounded-lg bg-reject-bg border border-reject-border p-2 text-xs font-semibold text-reject-dark">
          {error}
        </p>
      ) : null}
    </div>
  )
}
