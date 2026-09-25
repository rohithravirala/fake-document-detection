/**
 * High-performance SVG charts customized for SVARAM forensic analytics.
 * Zero external dependencies, ultra-lightweight, crisp on all resolutions.
 */

import { useState } from 'react'

const SERIES = {
  clear: '#12854F',
  reject: '#C62828',
  refer: '#A96A00',
  brand: '#1D57EB',
}

export function NoData({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong/80 bg-canvas/40 px-4 text-center">
      <svg viewBox="0 0 24 24" className="mb-2 h-7 w-7 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="m19 9-5 5-4-4-3 3" strokeLinecap="round" />
      </svg>
      <span className="text-[12.5px] font-medium text-ink-muted">{label}</span>
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const total = data.reduce((sum, d) => sum + d.clear + d.reject + d.refer, 0)
  if (!data.length || total === 0) {
    return <NoData label="No screenings in this period yet." />
  }

  const W = 640
  const H = 220
  const pad = { t: 16, r: 24, b: 30, l: 36 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const peak = Math.max(1, ...data.flatMap((d) => [d.clear, d.reject, d.refer]))
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
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(['clear', 'reject', 'refer'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5 font-medium text-ink-soft">
              <span className="h-2 w-2 rounded-full shadow-xs" style={{ background: SERIES[k] }} />
              {k === 'clear' ? 'Cleared' : k === 'reject' ? 'Rejected' : 'Referred'}
            </span>
          ))}
        </div>
        {hoveredIdx != null && data[hoveredIdx] ? (
          <div className="flex items-center gap-2 rounded-md bg-navy-900 px-2.5 py-1 text-[11px] font-mono text-white shadow-sm">
            <span>{new Date(data[hoveredIdx].date).toLocaleDateString()}</span>
            <span className="text-clear font-semibold">✓ {data[hoveredIdx].clear}</span>
            <span className="text-reject font-semibold">✕ {data[hoveredIdx].reject}</span>
            <span className="text-refer font-semibold">⚑ {data[hoveredIdx].refer}</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[460px]"
          role="img"
          aria-label={`Daily verdicts over ${data.length} days, peaking at ${peak} in a day.`}
        >
          <defs>
            <linearGradient id="clearAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.clear} stopOpacity="0.2" />
              <stop offset="100%" stopColor={SERIES.clear} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} y1={y(t)} x2={W - pad.r} y2={y(t)} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3 3" />
              <text x={pad.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8" fontFamily="sans-serif">
                {t}
              </text>
            </g>
          ))}

          <path d={area} fill="url(#clearAreaGrad)" />

          {(['clear', 'reject', 'refer'] as const).map((k) => (
            <path
              key={k}
              d={line(k)}
              fill="none"
              stroke={SERIES[k]}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94A3B8" fontFamily="sans-serif">
                {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            ) : null,
          )}

          {data.map((d, i) => (
            <g key={d.date} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
              <circle
                cx={x(i)}
                cy={y(d.clear)}
                r={hoveredIdx === i ? 4.5 : 3}
                fill={SERIES.clear}
                stroke="#fff"
                strokeWidth="1.5"
                className="cursor-pointer transition-all"
              />
              <circle
                cx={x(i)}
                cy={y(d.reject)}
                r={hoveredIdx === i ? 4.5 : 2.5}
                fill={SERIES.reject}
                stroke="#fff"
                strokeWidth="1.5"
                className="cursor-pointer transition-all"
              />
            </g>
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
  const stroke = 20
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative">
        <svg
          viewBox="0 0 140 140"
          className="h-[140px] w-[140px] shrink-0 drop-shadow-sm"
          role="img"
          aria-label={`${centreLabel}: ${slices.map((s) => `${s.label} ${s.value}`).join(', ')}`}
        >
          <circle cx="70" cy="70" r={R} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
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
                  strokeLinecap="round"
                />
              )
              offset += len
              return el
            })}
          </g>
          <text x="70" y="66" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0F172A">
            {centreValue}
          </text>
          <text x="70" y="83" textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748B" letterSpacing="0.05em">
            {centreLabel}
          </text>
        </svg>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-[12.5px]">
            <span className="h-3 w-3 shrink-0 rounded-md shadow-xs" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate font-medium text-ink-soft">{s.label}</span>
            <span className="tnum font-bold text-ink">{s.value}</span>
            <span className="tnum w-12 text-right font-mono text-[11px] text-ink-muted">
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
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(120px,1.4fr)_2fr_auto] items-center gap-3">
          <span className="truncate text-[12.5px] font-medium text-ink-soft" title={item.label}>
            {item.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-canvas shadow-inner">
            <span
              className="block h-full rounded-full transition-all duration-500"
              style={{ width: `${(item.value / peak) * 100}%`, background: color }}
            />
          </span>
          <span className="tnum whitespace-nowrap font-mono text-[11.5px] font-semibold text-ink-muted">
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
  size = 92,
  label,
}: {
  score: number
  size?: number
  label?: string
}) {
  const R = 38
  const C = 2 * Math.PI * R
  const pct = Math.max(0, Math.min(1, score))
  const colour = pct >= 0.85 ? SERIES.clear : pct <= 0.6 ? SERIES.reject : SERIES.refer

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Similarity ${pct.toFixed(2)}`}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#F1F5F9" strokeWidth="9" />
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
          <text x="50" y="55" textAnchor="middle" fontSize="21" fontWeight="800" fill="#0F172A">
            {pct.toFixed(2)}
          </text>
        </svg>
      </div>
      {label ? <span className="text-[11.5px] font-medium text-ink-muted">{label}</span> : null}
    </div>
  )
}

export const CHART_COLORS = SERIES
