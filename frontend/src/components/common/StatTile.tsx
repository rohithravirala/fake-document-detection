import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A headline counter.
 *
 * `delta` is only rendered when the backend actually computed one. With a
 * single period of data there is no baseline, and a made-up "+12%" on a
 * dashboard is exactly the detail that unravels under a question.
 */
export function StatTile({
  label,
  value,
  sub,
  delta,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: ReactNode
  sub?: string
  delta?: number | null
  tone?: 'neutral' | 'clear' | 'reject' | 'refer' | 'brand'
  icon?: ReactNode
}) {
  const tones = {
    neutral: 'bg-canvas text-ink-soft',
    brand: 'bg-brand-50 text-brand-700',
    clear: 'bg-clear-bg text-clear',
    reject: 'bg-reject-bg text-reject',
    refer: 'bg-refer-bg text-refer',
  }
  return (
    <div className="card flex items-center gap-3.5 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {icon ? (
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105', tones[tone])}>
          {icon}
        </div>
      ) : null}
      <div className="min-w-0">
        <p className="tnum text-[26px] font-bold leading-none text-ink tracking-tight">{value}</p>
        <p className="mt-1 text-[12.5px] font-medium text-ink-muted">{label}</p>
        {delta != null ? (
          <p
            className={cn(
              'tnum mt-0.5 text-[11.5px] font-medium',
              delta >= 0 ? 'text-clear' : 'text-reject',
            )}
          >
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% vs previous period
          </p>
        ) : sub ? (
          <p className="mt-0.5 text-[11.5px] text-ink-faint">{sub}</p>
        ) : null}
      </div>
    </div>

  )
}
