import { useState } from 'react'
import type { Check } from '@/api/types'
import { ResultPill, TypePill, SeverityPill } from '@/components/common/Badge'
import { CHECK_TYPE_WEIGHT, formatDuration } from '@/lib/format'
import { EvidenceCrop } from './EvidenceCrop'
import { cn } from '@/lib/utils'

export function CheckRow({ check, imageUrl }: { check: Check; imageUrl?: string | null }) {
  const [open, setOpen] = useState(false)
  const hasDetail = check.evidence.length > 0

  return (
    <li
      className={cn(
        'border-l-4 px-4 py-3.5 transition-all duration-150',
        check.result === 'fail'
          ? 'border-l-reject bg-reject-bg/40 hover:bg-reject-bg/60'
          : check.result === 'pass'
            ? 'border-l-clear hover:bg-clear-bg/20'
            : 'border-l-refer hover:bg-refer-bg/20',
      )}
    >
      <div className="flex items-start gap-3">
        <ResultPill result={check.result} />
        <div className="min-w-0 flex-1">
          {/* The citation is the primary finding */}
          <p className="text-[13.5px] font-semibold leading-relaxed text-ink">{check.citation}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
            <TypePill type={check.check_type} />
            <SeverityPill severity={check.severity} />
            <span>{CHECK_TYPE_WEIGHT[check.check_type]}</span>
            <span className="font-mono text-ink-faint">ID: {check.check_id}</span>
            {check.duration_ms ? (
              <span className="font-mono text-ink-faint">⏱ {formatDuration(check.duration_ms)}</span>
            ) : null}
          </div>
        </div>
        {hasDetail ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 shadow-xs hover:bg-brand-50 hover:border-brand-300 transition cursor-pointer"
            aria-expanded={open}
          >
            <span>{open ? 'Hide Evidence' : 'Inspect Evidence'}</span>
            <span className="text-[10px]">{open ? '▲' : '▼'}</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3.5 space-y-3 rounded-xl border border-line bg-white/90 p-4 shadow-xs">
          {check.evidence.map((evidence, index) => (
            <div key={index} className="flex flex-wrap gap-5">
              <div className="min-w-[240px] flex-1 space-y-2">
                <p className="text-[12.5px] font-medium text-ink-soft leading-relaxed">{evidence.note}</p>
                {evidence.expected != null || evidence.observed != null ? (
                  <div className="rounded-lg border border-line bg-canvas/70 p-3 text-[12px]">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                      {evidence.expected != null ? (
                        <>
                          <dt className="font-semibold text-ink-muted">Expected Format:</dt>
                          <dd className="break-words font-mono font-medium text-clear-dark">{evidence.expected}</dd>
                        </>
                      ) : null}
                      {evidence.observed != null ? (
                        <>
                          <dt className="font-semibold text-ink-muted">On Document:</dt>
                          <dd className="break-words font-mono font-bold text-reject-dark">{evidence.observed}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
                {evidence.strength != null ? (
                  <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                    <span>Signal Strength:</span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-canvas">
                      <div
                        className="h-full bg-brand-600 rounded-full"
                        style={{ width: `${Math.min(100, evidence.strength * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold">{(evidence.strength * 100).toFixed(0)}%</span>
                  </div>
                ) : null}
              </div>
              {imageUrl && evidence.region ? (
                <div className="shrink-0">
                  <EvidenceCrop imageUrl={imageUrl} region={evidence.region} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </li>
  )
}
