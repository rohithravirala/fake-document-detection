import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
    neutral: {
      bg: 'bg-canvas text-ink-soft border-line',
      borderTop: 'hover:border-t-ink-muted',
      spark: '#64748B',
    },
    brand: {
      bg: 'bg-brand-50 text-brand-700 border-brand-200',
      borderTop: 'hover:border-t-brand-500',
      spark: '#3B73F6',
    },
    clear: {
      bg: 'bg-clear-bg text-clear-dark border-clear-border',
      borderTop: 'hover:border-t-clear',
      spark: '#12854F',
    },
    reject: {
      bg: 'bg-reject-bg text-reject-dark border-reject-border',
      borderTop: 'hover:border-t-reject',
      spark: '#C62828',
    },
    refer: {
      bg: 'bg-refer-bg text-refer-dark border-refer-border',
      borderTop: 'hover:border-t-refer',
      spark: '#A96A00',
    },
  }

  const selectedTone = tones[tone]

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-card border border-line bg-white p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover border-t-2 border-t-transparent',
        selectedTone.borderTop,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium tracking-wide text-ink-muted uppercase">{label}</p>
          <p className="tnum mt-1.5 text-[28px] font-extrabold leading-none tracking-tight text-ink">
            {value}
          </p>

          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px]">
            {delta != null ? (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono font-semibold',
                  delta >= 0 ? 'bg-clear-bg text-clear-dark' : 'bg-reject-bg text-reject-dark',
                )}
              >
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
              </span>
            ) : null}
            {sub ? <span className="text-ink-muted truncate">{sub}</span> : null}
          </div>
        </div>

        {icon ? (
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-300 group-hover:scale-110',
              selectedTone.bg,
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {/* Decorative background sparkline */}
      <div className="pointer-events-none absolute -bottom-1 -right-2 h-10 w-24 opacity-15 transition-opacity group-hover:opacity-30">
        <svg viewBox="0 0 100 40" className="h-full w-full" fill="none" stroke={selectedTone.spark} strokeWidth="2.5">
          <path d="M0 30 Q 25 35, 40 20 T 70 15 T 100 5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}
