import { cn } from '@/lib/utils'
import type { CheckResult, CheckType, Verdict } from '@/api/types'
import { CHECK_TYPE_LABEL, RESULT_LABEL, VERDICT_LABEL } from '@/lib/format'

const VERDICT_STYLES: Record<Verdict, string> = {
  clear: 'bg-clear-bg text-clear border-clear-border',
  reject: 'bg-reject-bg text-reject border-reject-border',
  refer: 'bg-refer-bg text-refer border-refer-border',
}

export function VerdictPill({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-[3px] text-[11px] font-bold tracking-wide',
        VERDICT_STYLES[verdict],
        className,
      )}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  )
}

const RESULT_STYLES: Record<CheckResult, string> = {
  pass: 'bg-clear-bg text-clear border-clear-border',
  fail: 'bg-reject-bg text-reject border-reject-border',
  inconclusive: 'bg-refer-bg text-refer border-refer-border',
  // Deliberately neutral, not amber. A gap in our evidence is not a finding
  // about the document, and colour must not suggest otherwise.
  unavailable: 'bg-canvas text-ink-muted border-line-strong',
  retake: 'bg-refer-bg text-refer border-refer-border',
}

export function ResultPill({ result }: { result: CheckResult }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-2 py-[2px] text-[11px] font-semibold',
        RESULT_STYLES[result],
      )}
    >
      {RESULT_LABEL[result]}
    </span>
  )
}

export function TypePill({ type }: { type: CheckType }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-canvas px-1.5 py-[1px] font-mono text-[10.5px] text-ink-muted">
      {CHECK_TYPE_LABEL[type]}
    </span>
  )
}

export function SeverityPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    critical: 'bg-reject-bg text-reject border-reject-border',
    high: 'bg-reject-bg text-reject border-reject-border',
    medium: 'bg-refer-bg text-refer border-refer-border',
    low: 'bg-canvas text-ink-muted border-line-strong',
    info: 'bg-canvas text-ink-muted border-line-strong',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-[1px] text-[10.5px] font-semibold capitalize',
        styles[severity] ?? styles.info,
      )}
    >
      {severity}
    </span>
  )
}
