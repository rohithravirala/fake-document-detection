/**
 * Charts, hand-authored in SVG.
 *
 * Four shapes are needed across the analytics screen — a trend line, two
 * donuts and a bar list. A charting library would add ~150 KB to the bundle and
 * still need every axis, label and colour overridden to match the rest of the
 * interface, so they are drawn directly.
 *
 * One rule holds throughout: every label names a value the chart actually
 * reaches, and a chart with no data says so rather than drawing an empty frame
 * that reads as a zero.
 */

import { cn } from '@/lib/utils'

const SERIES = {
  clear: '#12854F',
  reject: '#C62828',
  refer: '#A96A00',
  brand: '#1D57EB',
}

export function NoData({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-line-strong px-4 text-center text-[12.5px] text-ink-muted">
      {label}
    </div>
  )
}

/* ------------------------------------------------------------------ trend */

export interface TrendPoint {
  date: string
  clear: number
  reject: number
  refer: number
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.clear + d.reject + d.refer, 0)
  if (!data.length || total === 0) {
    return <NoData label="No screenings in this period yet." />
  }

  const W = 640
  const H = 210
  // Right padding leaves room for the final point's marker, which sat on the
  // frame and was clipped when every screening landed on the same day.
  const pad = { t: 12, r: 22, b: 26, l: 34 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const peak = Math.max(1, ...data.flatMap((d) => [d.clear, d.reject, d.refer]))
  // Round the axis up to something a reader can hold in their head.
  const step = peak <= 5 ? 1 : peak <= 20 ? 5 : peak <= 60 ? 10 : 50
  const top = Math.ceil(peak / step) * step
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step)

  const x = (i: number) => pad.l + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1))
  const y = (v: number) => pad.t + innerH - (v / top) * innerH

  const line = (key: 'clear' | 'reject' | 'refer') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

  const area = `${line('clear')} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`

  const labelEvery = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
        {(['clear', 'reject', 'refer'] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5 capitalize text-ink-muted">
            <span className="h-[3px] w-4 rounded-full" style={{ background: SERIES[k] }} />
            {k === 'clear' ? 'Cleared' : k === 'reject' ? 'Rejected' : 'Referred'}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[440px]"
          role="img"
          aria-label={`Daily verdicts over ${data.length} days, peaking at ${peak} in a day.`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke="#E2E8F1" strokeWidth="1" />
              <text x={pad.l - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#95A0B1">
                {t}
              </text>
            </g>
          ))}
          <path d={area} fill={SERIES.clear} opacity="0.08" />
          {(['clear', 'reject', 'refer'] as const).map((k) => (
            <path key={k} d={line(k)} fill="none" stroke={SERIES[k]} strokeWidth="2" strokeLinejoin="round" />
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#95A0B1">
                {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            ) : null,
          )}
          {data.map((d, i) => (
            <circle key={d.date} cx={x(i)} cy={y(d.clear)} r="2.6" fill={SERIES.clear} />
          ))}
        </svg>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ donut */

export interface Slice {
  label: string
  value: number
  color: string
}

export function Donut({
  slices,
  centreValue,
  centreLabel,
}: {
  slices: Slice[]
  centreValue: number
  centreLabel: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total === 0) return <NoData label="Nothing screened yet." />

  const R = 54
  const stroke = 22
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        viewBox="0 0 140 140"
        className="h-[140px] w-[140px] shrink-0"
        role="img"
        aria-label={`${centreLabel}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`}
      >
        <g transform="translate(70,70) rotate(-90)">
          {slices.map((s) => {
            const len = (s.value / total) * C
            const el = (
              <circle
                key={s.label}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
        </g>
        <text x="70" y="67" textAnchor="middle" fontSize="22" fontWeight="700" fill="#101623">
          {centreValue}
        </text>
        <text x="70" y="84" textAnchor="middle" fontSize="10" fill="#657286">
          {centreLabel}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-soft">{s.label}</span>
            <span className="tnum font-medium text-ink">{s.value}</span>
            <span className="tnum w-12 text-right text-ink-faint">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------------------------------------------------------------- bar list */

export function BarList({
  items,
  color = SERIES.reject,
  emptyLabel = 'Nothing to show yet.',
}: {
  items: Array<{ label: string; value: number; share?: number }>
  color?: string
  emptyLabel?: string
}) {
  if (!items.length) return <NoData label={emptyLabel} />
  const peak = Math.max(...items.map((i) => i.value), 1)

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(110px,1.3fr)_2fr_auto] items-center gap-3">
          <span className="truncate text-[12.5px] text-ink-soft" title={item.label}>
            {item.label}
          </span>
          <span className="h-[7px] overflow-hidden rounded-full bg-canvas">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(item.value / peak) * 100}%`, background: color }}
            />
          </span>
          <span className="tnum whitespace-nowrap text-[12px] text-ink-muted">
            {item.value}
            {item.share != null ? ` (${item.share}%)` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------- score ring */

export function ScoreRing({
  score,
  size = 88,
  label,
}: {
  score: number
  size?: number
  label?: string
}) {
  const R = 38
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(1, score))
  // Face similarity is a measurement, not a verdict confidence — the band it
  // falls in is what the interface states, and the ring colour follows it.
  const colour = pct >= 0.85 ? SERIES.clear : pct <= 0.6 ? SERIES.reject : SERIES.refer

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Similarity ${pct.toFixed(2)}`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#E2E8F1" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={colour}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${pct * C} ${C}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle" fontSize="21" fontWeight="700" fill="#101623">
          {pct.toFixed(2)}
        </text>
      </svg>
      {label ? <span className={cn('text-[11.5px] text-ink-muted')}>{label}</span> : null}
    </div>
  )
}

export const CHART_COLORS = SERIES
