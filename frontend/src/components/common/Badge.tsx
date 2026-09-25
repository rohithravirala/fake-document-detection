import { cn } from '@/lib/utils'
import type { CheckResult, CheckType, Verdict } from '@/api/types'
import { CHECK_TYPE_LABEL, RESULT_LABEL, VERDICT_LABEL } from '@/lib/format'

const VERDICT_STYLES: Record<Verdict, { pill: string; dot: string }> = {
  clear: {
    pill: 'bg-clear-bg text-clear-dark border-clear-border ring-1 ring-clear/20',
    dot: 'bg-clear',
  },
  reject: {
    pill: 'bg-reject-bg text-reject-dark border-reject-border ring-1 ring-reject/20',
    dot: 'bg-reject',
  },
  refer: {
    pill: 'bg-refer-bg text-refer-dark border-refer-border ring-1 ring-refer/20',
    dot: 'bg-refer',
  },
}

export function VerdictPill({
  verdict,
  className,
  showPulse = true,
}: {
  verdict: Verdict
  className?: string
  showPulse?: boolean
}) {
  const style = VERDICT_STYLES[verdict]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide shadow-xs transition-all',
        style.pill,
        className,
      )}
    >
      {showPulse ? (
        <span className="relative flex h-2 w-2">
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', style.dot)} />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', style.dot)} />
        </span>
      ) : null}
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

const RESULT_STYLES: Record<CheckResult, string> = {
  pass: 'bg-clear-bg text-clear-dark border-clear-border font-medium',
  fail: 'bg-reject-bg text-reject-dark border-reject-border font-semibold',
  inconclusive: 'bg-refer-bg text-refer-dark border-refer-border font-medium',
  unavailable: 'bg-canvas-subtle text-ink-muted border-line font-normal',
  retake: 'bg-refer-bg text-refer-dark border-refer-border font-medium',
}

export function ResultPill({ result }: { result: CheckResult }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px]',
        RESULT_STYLES[result],
      )}
    >
      {RESULT_LABEL[result]}
    </span>
  )
}

export function TypePill({ type }: { type: CheckType }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-canvas px-2 py-0.5 font-mono text-[10.5px] font-medium text-ink-muted border border-line">
      {CHECK_TYPE_LABEL[type]}
    </span>
  )
}

export function SeverityPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-reject-bg text-reject-dark border-reject-border font-bold',
    high: 'bg-reject-bg text-reject-dark border-reject-border font-semibold',
    medium: 'bg-refer-bg text-refer-dark border-refer-border font-medium',
    low: 'bg-canvas-subtle text-ink-muted border-line',
    info: 'bg-canvas-subtle text-ink-muted border-line',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] capitalize tracking-wide',
        styles[severity] ?? styles.info,
      )}
    >
      {severity}
    </span>
  )
}

export function ConfidencePill({ score }: { score: number }) {
  const percent = Math.round(score * 100)
  const isHigh = percent >= 85
  const isMed = percent >= 60 && percent < 85

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-semibold',
        isHigh
          ? 'bg-clear-bg text-clear-dark border-clear-border'
          : isMed
            ? 'bg-refer-bg text-refer-dark border-refer-border'
            : 'bg-reject-bg text-reject-dark border-reject-border',
      )}
    >
      <span className="text-[9px] uppercase tracking-wider text-ink-muted">Conf:</span>
      {percent}%
    </span>
  )
}
