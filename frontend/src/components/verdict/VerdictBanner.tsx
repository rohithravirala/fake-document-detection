import { useState } from 'react'
import type { Verdict } from '@/api/types'
import { VERDICT_LABEL, VERDICT_MEANING, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { IconCopy, IconCheck, IconPrinter } from '@/components/common/Icons'

const STYLES: Record<Verdict, string> = {
  clear: 'bg-gradient-to-r from-clear-bg to-emerald-50/50 border-clear-border shadow-glow-clear/10',
  reject: 'bg-gradient-to-r from-reject-bg to-rose-50/50 border-reject-border shadow-glow-reject/10',
  refer: 'bg-gradient-to-r from-refer-bg to-amber-50/50 border-refer-border',
}

const TEXT: Record<Verdict, string> = {
  clear: 'text-clear-dark',
  reject: 'text-reject-dark',
  refer: 'text-refer-dark',
}

const ICON_BG: Record<Verdict, string> = {
  clear: 'bg-clear text-white',
  reject: 'bg-reject text-white',
  refer: 'bg-refer text-white',
}

export function VerdictBanner({
  verdict,
  reason,
  durationMs,
  needsRetake,
}: {
  verdict: Verdict
  reason: string
  durationMs?: number | null
  needsRetake?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard?.writeText(
      `SVARAM VERDICT: ${VERDICT_LABEL[verdict].toUpperCase()}\nFINDING: ${reason}\nLATENCY: ${durationMs != null ? formatDuration(durationMs) : 'N/A'}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-6 shadow-sm transition-all',
        STYLES[verdict],
      )}
      aria-live="polite"
    >
      {/* Decorative Security Seal Watermark */}
      <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-10 select-none">
        <svg viewBox="0 0 100 100" className="h-44 w-44">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="6 3" />
          <text x="50" y="55" textAnchor="middle" fontSize="13" fontWeight="900" fill="currentColor">
            OFFICIAL VERIFIED
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs font-bold text-lg', ICON_BG[verdict])}>
            {verdict === 'clear' ? '✓' : verdict === 'reject' ? '✕' : '⚑'}
          </div>
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className={cn('text-2xl sm:text-3xl font-extrabold tracking-tight', TEXT[verdict])}>
                {VERDICT_LABEL[verdict]}
              </h1>
              <p className={cn('text-xs sm:text-sm font-semibold opacity-90', TEXT[verdict])}>
                {VERDICT_MEANING[verdict]}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {durationMs != null ? (
            <span className="rounded-lg bg-white/80 border border-line/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-soft shadow-xs backdrop-blur-xs">
              ⏱ {formatDuration(durationMs)}
            </span>
          ) : null}
          <button
            onClick={handleCopy}
            className="rounded-lg border border-line bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-ink hover:bg-white shadow-xs transition flex items-center gap-1.5"
            title="Copy verdict citation"
          >
            {copied ? <IconCheck className="h-3.5 w-3.5 text-clear" /> : <IconCopy className="h-3.5 w-3.5 text-ink-muted" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-line bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-ink hover:bg-white shadow-xs transition hidden sm:flex items-center gap-1.5"
            title="Print dossier verdict"
          >
            <IconPrinter className="h-3.5 w-3.5 text-ink-muted" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <p className="mt-3.5 text-[14.5px] font-medium leading-relaxed text-ink max-w-3xl">
        {reason}
      </p>

      {needsRetake ? (
        <p className="mt-3.5 rounded-xl border border-refer-border bg-white/85 px-4 py-2.5 text-[12.5px] font-medium text-refer-dark shadow-xs">
          The document capture could not be analysed. Request an immediate physical re-scan — this is not a finding about the document.
        </p>
      ) : null}
    </section>
  )
}
