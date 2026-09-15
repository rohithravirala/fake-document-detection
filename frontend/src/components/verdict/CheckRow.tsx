import { useState } from 'react'
import type { Check } from '@/api/types'
import { ResultPill, TypePill } from '@/components/common/Badge'
import { CHECK_TYPE_WEIGHT, formatDuration } from '@/lib/format'
import { EvidenceCrop } from './EvidenceCrop'
import { cn } from '@/lib/utils'

export function CheckRow({ check, imageUrl }: { check: Check; imageUrl?: string | null }) {
  const [open, setOpen] = useState(false)
  const hasDetail = check.evidence.length > 0

  return (
    <li
      className={cn(
        'border-l-[3px] px-4 py-3',
        check.result === 'fail'
          ? 'border-l-reject bg-reject-bg/40'
          : check.result === 'pass'
            ? 'border-l-clear-border'
            : 'border-l-line-strong',
      )}
    >
      <div className="flex items-start gap-3">
        <ResultPill result={check.result} />
        <div className="min-w-0 flex-1">
          {/* The citation is the product. It leads, at full size. */}
          <p className="text-[13.5px] leading-relaxed text-ink">{check.citation}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
            <TypePill type={check.check_type} />
            <span>{CHECK_TYPE_WEIGHT[check.check_type]}</span>
            <span className="font-mono">{check.check_id}</span>
            {check.duration_ms ? <span>{formatDuration(check.duration_ms)}</span> : null}
          </div>
        </div>
        {hasDetail ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-[12px] font-medium text-brand-700 hover:underline"
            aria-expanded={open}
          >
            {open ? 'Hide evidence' : 'Evidence'}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {check.evidence.map((evidence, index) => (
            <div key={index} className="flex flex-wrap gap-4">
              <div className="min-w-[220px] flex-1 space-y-1.5">
                <p className="text-[12.5px] text-ink-muted">{evidence.note}</p>
                {evidence.expected != null || evidence.observed != null ? (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
                    {evidence.expected != null ? (
                      <>
                        <dt className="text-ink-faint">Expected</dt>
                        <dd className="break-words font-mono text-ink">{evidence.expected}</dd>
                      </>
                    ) : null}
                    {evidence.observed != null ? (
                      <>
                        <dt className="text-ink-faint">On the document</dt>
                        <dd className="break-words font-mono text-ink">{evidence.observed}</dd>
                      </>
                    ) : null}
                  </dl>
                ) : null}
                {evidence.strength != null ? (
                  <p className="text-[11.5px] text-ink-faint">
                    Signal strength {evidence.strength.toFixed(2)} — an indication for an examiner,
                    not a probability that the document is forged.
                  </p>
                ) : null}
              </div>
              {imageUrl && evidence.region ? (
                <EvidenceCrop imageUrl={imageUrl} region={evidence.region} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  )
}
