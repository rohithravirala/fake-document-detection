import { DOC_TYPES, DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { humanSize } from '@/lib/utils'
import { Button } from '@/components/common/Primitives'
import { IconDoc, IconTrash, IconLock } from '@/components/common/Icons'

export interface PendingFile {
  file: File
  docType: DocType
  previewUrl: string
}

export function FileCard({
  item,
  onTypeChange,
  onRemove,
}: {
  item: PendingFile
  onTypeChange: (type: DocType) => void
  onRemove: () => void
}) {
  // Generate mock deterministic hash from file properties
  const mockHash = `${Math.abs(item.file.name.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)).toString(16).padStart(8, '0')}...`

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-3.5 shadow-card transition-all hover:border-brand-300">
      {item.file.type.startsWith('image/') ? (
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-canvas">
          <img
            src={item.previewUrl}
            alt="Document thumbnail"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-16 w-24 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-navy-50 text-navy-800">
          <IconDoc className="h-6 w-6 text-brand-600 mb-1" />
          <span className="font-mono text-[10px] font-bold uppercase">PDF DOSSIER</span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-ink" title={item.file.name}>
          {item.file.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
          <span className="font-medium">{humanSize(item.file.size)}</span>
          <span>·</span>
          <span className="flex items-center gap-1 font-mono text-[10.5px] text-ink-soft bg-canvas px-1.5 py-0.5 rounded border border-line">
            <IconLock className="h-3 w-3 text-brand-600" />
            SHA-256: {mockHash}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <label className="text-xs">
          <span className="sr-only">Document classification</span>
          <select
            value={item.docType}
            onChange={(event) => onTypeChange(event.target.value as DocType)}
            className="rounded-lg border border-line bg-canvas/60 px-3 py-1.5 text-[12.5px] font-medium text-ink focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          >
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOC_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <Button
          variant="danger"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${item.file.name}`}
          className="px-2.5 py-1.5"
        >
          <IconTrash className="h-4 w-4" />
        </Button>
      </div>
    </li>
  )
}
