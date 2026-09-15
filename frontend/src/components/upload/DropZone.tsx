import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'

const ACCEPTED = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'],
  'application/pdf': ['.pdf'],
}

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
          'cursor-pointer rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
          isDragActive ? 'border-ink bg-gray-100' : 'border-gray-300 bg-white hover:border-gray-400',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium text-ink">
          {isDragActive ? 'Drop to add' : 'Drop documents here, or click to choose'}
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Aadhaar, PAN, passport or visa. JPG, PNG or PDF, up to 20 MB each.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          A sharp, straight, well-lit photograph of the whole document. Poor captures are
          returned for a retake rather than analysed.
        </p>
      </div>

      {fileRejections.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {fileRejections.map(({ file, errors }) => (
            <li key={file.name} className="text-sm text-reject-fg">
              {file.name}: {errors.map((error) => error.message).join(', ')}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
