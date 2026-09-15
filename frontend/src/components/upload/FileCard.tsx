import { DOC_TYPES, DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { humanSize } from '@/lib/utils'
import { Button } from '@/components/common/Primitives'

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
  return (
    <li className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3">
      {item.file.type.startsWith('image/') ? (
        <img
          src={item.previewUrl}
          alt=""
          className="h-16 w-24 shrink-0 rounded border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 font-mono text-xs text-ink-muted">
          PDF
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.file.name}</p>
        <p className="text-xs text-ink-faint">{humanSize(item.file.size)}</p>
      </div>

      <label className="text-sm">
        <span className="sr-only">Document type</span>
        <select
          value={item.docType}
          onChange={(event) => onTypeChange(event.target.value as DocType)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
        >
          {DOC_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOC_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <Button variant="ghost" onClick={onRemove} aria-label={`Remove ${item.file.name}`}>
        Remove
      </Button>
    </li>
  )
}
