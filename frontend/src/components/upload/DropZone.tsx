import { useDropzone } from 'react-dropzone'
import { IconUpload } from '@/components/common/Icons'
import { cn } from '@/lib/utils'

const ACCEPTED = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'],
  'application/pdf': ['.pdf'],
}

const FORMAT_TAGS = ['Aadhaar', 'PAN Card', 'Passport', 'Visa', 'JPG / PNG / PDF']

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
    maxSize: 20 * 1024 * 1024,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300',
          isDragActive
            ? 'border-brand-600 bg-brand-50/80 shadow-lg scale-[1.01] ring-4 ring-brand-500/20'
            : 'border-line-strong bg-white hover:border-brand-500 hover:bg-brand-50/20 hover:shadow-sm',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 transition-transform group-hover:scale-110">
          <IconUpload className={cn('h-6 w-6 transition-transform', isDragActive && 'scale-125 animate-bounce')} />
        </div>
        <p className="text-[14px] font-semibold text-ink">
          {isDragActive ? 'Drop document to start verification' : 'Drop document here, or click to browse'}
        </p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Aadhaar, PAN, passport or visa. Supports images & PDFs up to 20 MB each.
        </p>

        {/* Quick Format Chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {FORMAT_TAGS.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-canvas border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="mt-4 text-[11.5px] text-ink-faint">
          💡 For best results, use a sharp, well-lit photograph. High-resolution captures increase check accuracy.
        </p>
      </div>

      {fileRejections.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name} className="text-xs font-medium text-reject-fg">
              {file.name}: {errors.map((error) => error.message).join(', ')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

