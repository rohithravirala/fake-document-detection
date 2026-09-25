import { useDropzone } from 'react-dropzone'
import { IconUpload, IconSparkles } from '@/components/common/Icons'
import { cn } from '@/lib/utils'

const ACCEPTED = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'],
  'application/pdf': ['.pdf'],
}

const FORMAT_TAGS = ['Aadhaar Card', 'PAN Card', 'Indian Passport', 'Voter ID (EPIC)', 'Driving Licence']

export function DropZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: ACCEPTED,
    disabled,
    onDrop: onFiles,
    maxSize: 25 * 1024 * 1024,
  })

  // Quick sample generator to immediately demo documents
  const loadPresetSample = (docType: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = 600
    sampleCanvas.height = 400
    const ctx = sampleCanvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, 600, 400)
      ctx.fillStyle = '#0B1F4B'
      ctx.fillRect(0, 0, 600, 60)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px sans-serif'
      ctx.fillText(`GOVERNMENT OF INDIA - ${docType.toUpperCase()}`, 30, 40)
      ctx.fillStyle = '#101623'
      ctx.font = '16px monospace'
      ctx.fillText(`SAMPLE DOCUMENT · ${docType}`, 30, 110)
      ctx.fillText(`ID NUMBER: IN-2026-99214`, 30, 140)
      ctx.fillText(`DOB: 15/08/1990  SEX: M`, 30, 170)
      ctx.fillText(`ISSUED BY: NATIONAL AUTHORITY`, 30, 200)
      // Fake barcode / MRZ
      ctx.fillStyle = '#334155'
      ctx.fillRect(30, 240, 540, 25)
      ctx.fillRect(30, 280, 540, 25)
    }

    sampleCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `sample_${docType.toLowerCase().replace(/\s+/g, '_')}.png`, {
          type: 'image/png',
        })
        onFiles([file])
      }
    }, 'image/png')
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300',
          isDragActive
            ? 'border-brand-600 bg-brand-50/90 shadow-glow scale-[1.01] ring-4 ring-brand-500/20'
            : 'border-line-strong bg-white hover:border-brand-500 hover:bg-canvas/50 hover:shadow-card-hover',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input {...getInputProps()} />

        {/* Animated Scanning Line when drag active */}
        {isDragActive ? (
          <div className="pointer-events-none absolute inset-x-0 h-1 scanner-line animate-scan" />
        ) : null}

        <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 shadow-xs ring-1 ring-brand-200 transition-transform group-hover:scale-110">
          <IconUpload className={cn('h-7 w-7 transition-transform', isDragActive && 'scale-125 animate-bounce')} />
        </div>

        <p className="text-[15px] font-bold text-ink">
          {isDragActive ? 'Release to ingest document...' : 'Drag & drop identity document here, or click to browse'}
        </p>
        <p className="mt-1.5 text-[12.5px] text-ink-muted max-w-md mx-auto">
          Ingest raw scans, camera photos, or PDF dossiers (up to 25 MB). Analyzed with on-device cryptographic verification.
        </p>

        {/* Quick Format Chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {FORMAT_TAGS.map((tag) => (
            <span
              key={tag}
              className="rounded-lg bg-canvas border border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-xs"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Instant Demo Presets */}
        <div className="mt-5 border-t border-line/70 pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center justify-center gap-1.5">
            <IconSparkles className="h-3.5 w-3.5 text-brand-600" />
            Quick Presets for Live Testing
          </p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-2">
            {['Aadhaar Card', 'PAN Card', 'Passport'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={(e) => loadPresetSample(preset, e)}
                className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink shadow-xs hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
              >
                + Demo {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {fileRejections.length > 0 ? (
        <ul className="mt-2.5 space-y-1">
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name} className="text-xs font-semibold text-reject-dark bg-reject-bg border border-reject-border rounded-lg px-3 py-1.5">
              {file.name}: {errors.map((error) => error.message).join(', ')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
