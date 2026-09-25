import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCase, useCases, useStats } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Button, EmptyState, Row, Spinner } from '@/components/common/Primitives'
import { VerdictPill } from '@/components/common/Badge'
import { IconCheck, IconClock, IconCross, IconDoc, IconSearch, IconDownload } from '@/components/common/Icons'
import { showToast } from '@/components/common/Toast'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { formatDuration, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

const VERDICT_FILTERS = [
  { id: '', label: 'All Statuses' },
  { id: 'clear', label: 'Cleared' },
  { id: 'reject', label: 'Rejected' },
  { id: 'refer', label: 'Referred' },
]

export function CaseHistoryPage() {
  const [verdict, setVerdict] = useState('')
  const [docType, setDocType] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const { data: stats } = useStats()
  const { data: cases, isLoading } = useCases(verdict || undefined)
  const { data: detail } = useCase(selected ?? undefined)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (cases ?? []).filter((item) => {
      if (docType && !item.doc_types.includes(docType)) return false
      if (!needle) return true
      return (
        item.id.toLowerCase().includes(needle) ||
        (item.reason ?? '').toLowerCase().includes(needle) ||
        item.doc_types.join(' ').toLowerCase().includes(needle)
      )
    })
  }, [cases, docType, query])

  const exportCSV = () => {
    if (!rows.length) return
    const headers = ['Case ID', 'Created At', 'Doc Types', 'Verdict', 'Reason', 'Duration (ms)']
    const lines = rows.map((r) => [
      r.id,
      r.created_at,
      r.doc_types.join(';'),
      r.verdict ?? '',
      `"${(r.reason ?? '').replace(/"/g, '""')}"`,
      r.duration_ms,
    ])
    const csvContent = [headers.join(','), ...lines.map((l) => l.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `svaram_cases_export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${rows.length} cases to CSV spreadsheet`, 'success')
  }

  const all = stats?.all_time

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Case Archive & Records</h1>
          <p className="text-[13px] text-ink-muted">
            Tamper-evident log of all past identity screening records with defensible citations.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={exportCSV} disabled={!rows.length} className="shadow-xs">
          <IconDownload className="h-3.5 w-3.5" />
          <span>Export CSV Records ({rows.length})</span>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Archive Volume" value={all?.total ?? '—'} tone="brand" icon={<IconDoc />} />
        <StatTile
          label="Total Cleared"
          value={all?.clear ?? '—'}
          sub={all ? `${all.clear_share}% genuine` : undefined}
          tone="clear"
          icon={<IconCheck />}
        />
        <StatTile
          label="Total Intercepted"
          value={all?.reject ?? '—'}
          sub={all ? `${all.reject_share}% fraudulent` : undefined}
          tone="reject"
          icon={<IconCross />}
        />
        <StatTile
          label="Total Referred"
          value={all?.refer ?? '—'}
          sub={all ? `${all.refer_share}% manual examination` : undefined}
          tone="refer"
          icon={<IconClock />}
        />
      </div>

      <div className={cn('grid gap-5', selected ? 'xl:grid-cols-[1fr_380px]' : 'grid-cols-1')}>
        <div className="card min-w-0 overflow-hidden shadow-card">
          {/* Search and Filters Strip */}
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-canvas/40 p-3.5">
            <div className="relative min-w-[220px] flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search case ID, reasons, or credentials..."
                className="w-full rounded-xl border border-line bg-white py-1.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">All Document Types</option>
              {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink focus:border-brand-500 focus:outline-none"
            >
              {VERDICT_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            {query || docType || verdict ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setQuery(''); setDocType(''); setVerdict('') }}
              >
                Reset
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-8 text-center"><Spinner className="mx-auto h-6 w-6" /></div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No case records matched"
                detail="Every screening transaction is recorded in this tamper-proof database."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-b border-line bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    {['Case Ref', 'Date & Time', 'Document Type', 'Verdict', 'Finding Reason', 'Latency', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-brand-50/40',
                        selected === item.id && 'bg-brand-50/80 font-medium',
                      )}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11.5px] text-brand-800 font-semibold">
                        {item.id.slice(0, 14)}…
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-ink-muted">
                        {formatTimestamp(item.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                        {item.doc_types.map((t) => DOC_TYPE_LABELS[t as DocType] ?? t).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.verdict ? (
                          <VerdictPill verdict={item.verdict} />
                        ) : (
                          <span className="rounded bg-canvas px-2 py-0.5 text-[11px] text-ink-muted border border-line">
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[300px] px-4 py-3">
                        <span className="line-clamp-2 text-[12.5px] text-ink-soft">{item.reason ?? '—'}</span>
                      </td>
                      <td className="tnum whitespace-nowrap px-4 py-3 font-mono text-[11.5px] text-ink-faint">
                        {formatDuration(item.duration_ms)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/cases/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 shadow-xs hover:bg-brand-50 hover:border-brand-300 transition"
                        >
                          Dossier →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Case Side Drawer */}
        {selected && detail ? (
          <aside className="card space-y-4 p-5 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="label">Quick Case Inspector</span>
              <button
                onClick={() => setSelected(null)}
                className="text-ink-muted hover:text-ink text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            {detail.verdict ? (
              <div className="space-y-2">
                <VerdictPill verdict={detail.verdict} />
                <p className="text-[13px] font-medium leading-relaxed text-ink">{detail.reason}</p>
              </div>
            ) : null}

            <dl className="space-y-1.5 border-t border-line pt-3 text-[12.5px]">
              <Row label="Full ID" value={<span className="font-mono text-[10.5px] break-all">{detail.id}</span>} />
              <Row label="Officer" value={detail.officer_id || 'On duty'} />
              <Row label="Latency" value={formatDuration(detail.duration_ms)} />
            </dl>

            <Link
              to={`/cases/${detail.id}`}
              className="mt-4 block w-full rounded-xl bg-brand-600 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xs hover:bg-brand-700 transition"
            >
              Open Full Forensic Dossier →
            </Link>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
