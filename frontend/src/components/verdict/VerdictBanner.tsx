import type { Verdict } from '@/api/types'
import { VERDICT_LABEL, VERDICT_MEANING, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const STYLES: Record<Verdict, string> = {
  clear: 'bg-clear-bg border-clear-border',
  reject: 'bg-reject-bg border-reject-border',
  refer: 'bg-refer-bg border-refer-border',
}

const TEXT: Record<Verdict, string> = {
  clear: 'text-clear',
  reject: 'text-reject',
  refer: 'text-refer',
}

/**
 * One verdict, one sentence.
 *
 * No score, no confidence bar, no percentage. An officer has about thirty
 * seconds, and a number they cannot defend afterwards is worse than nothing.
 */
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
  return (
    <section className={cn('rounded-lg border-2 p-6', STYLES[verdict])} aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className={cn('text-3xl font-bold tracking-tight', TEXT[verdict])}>
          {VERDICT_LABEL[verdict]}
        </h1>
        <p className={cn('text-sm', TEXT[verdict])}>{VERDICT_MEANING[verdict]}</p>
        {durationMs != null ? (
          <span className="ml-auto text-xs text-ink-faint">
            screened in {formatDuration(durationMs)}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-base leading-relaxed text-ink">{reason}</p>

      {needsRetake ? (
        <p className="mt-3 rounded border border-refer-border bg-white/70 px-3 py-2 text-[12.5px] text-refer-dark">
          The capture could not be analysed. Take another photograph — this is not a finding
          about the document.
        </p>
      ) : null}
    </section>
  )
}
