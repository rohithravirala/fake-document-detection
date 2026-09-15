import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/common/Primitives'

/**
 * Capture a document straight from the device camera.
 *
 * `getUserMedia` needs a secure context, so this is unavailable over plain HTTP
 * on anything but localhost. That is said out loud rather than leaving a button
 * that silently does nothing at a demonstration.
 */
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
          ? 'Camera access was declined.'
          : 'The camera could not be opened on this device.',
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
      <p className="text-sm text-ink-muted">
        Camera capture needs a secure connection (HTTPS or localhost). Upload a file instead.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {active ? (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full rounded-lg border border-gray-200 bg-black"
          />
          <div className="flex gap-2">
            <Button onClick={capture}>Capture</Button>
            <Button variant="secondary" onClick={stop}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={start}>
          Use camera
        </Button>
      )}
      {error ? <p className="text-sm text-reject-fg">{error}</p> : null}
    </div>
  )
}
