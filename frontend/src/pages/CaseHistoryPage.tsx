import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCase, useCases, useStats } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Button, Card, EmptyState, Row, Spinner } from '@/components/common/Primitives'
import { ResultPill, VerdictPill } from '@/components/common/Badge'
import { IconCheck, IconClock, IconCross, IconDoc, IconSearch } from '@/components/common/Icons'
import { showToast } from '@/components/common/Toast'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { formatDuration, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

const VERDICT_FILTERS = [
  { id: '', label: 'All statuses' },
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
    showToast(`Exported ${rows.length} cases to CSV`, 'success')
  }

  const all = stats?.all_time

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Case History</h1>
          <p className="text-[13px] text-ink-muted">Every screening, with the reason it was decided.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={exportCSV} disabled={!rows.length}>
          📥 Export CSV ({rows.length})
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total cases" value={all?.total ?? '—'} tone="brand" icon={<IconDoc />} />
        <StatTile
          label="Cleared"
          value={all?.clear ?? '—'}
          sub={all ? `${all.clear_share}%` : undefined}
          tone="clear"
          icon={<IconCheck />}
        />
        <StatTile
          label="Rejected"
          value={all?.reject ?? '—'}
          sub={all ? `${all.reject_share}%` : undefined}
          tone="reject"
          icon={<IconCross />}
        />
        <StatTile
          label="Referred"
          value={all?.refer ?? '—'}
          sub={all ? `${all.refer_share}%` : undefined}
          tone="refer"
          icon={<IconClock />}
        />
      </div>

      <div className={cn('grid gap-4', selected ? 'xl:grid-cols-[1fr_360px]' : 'grid-cols-1')}>
        <div className="card min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <label className="relative min-w-[200px] flex-1">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by case ID, document type or reason"
                className="w-full rounded-md border border-line-strong py-1.5 pl-8 pr-3 text-[13px]"
              />
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-md border border-line-strong px-2 py-1.5 text-[13px]"
            >
              <option value="">All document types</option>
              {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value)}
              className="rounded-md border border-line-strong px-2 py-1.5 text-[13px]"
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
                Clear filters
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-6"><Spinner /></div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No cases match"
                detail="Every screening is recorded here and written to the audit chain."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="border-b border-line bg-canvas">
                  <tr>
                    {['Case ID', 'Date & time', 'Document', 'Status', 'Reason', 'Time', ''].map((h) => (
                      <th key={h} className="label whitespace-nowrap px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item.id)}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-brand-50/50',
                        selected === item.id && 'bg-brand-50 font-medium',
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-ink-muted">
                        {item.id.slice(0, 12)}…
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                        {formatTimestamp(item.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {item.doc_types.map((t) => DOC_TYPE_LABELS[t as DocType] ?? t).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.verdict ? (
                          <VerdictPill verdict={item.verdict} />
                        ) : (
                          <span className="text-[11.5px] text-ink-faint">{item.status}</span>
                        )}
                      </td>
                      <td className="max-w-[280px] px-3 py-2.5">
                        <span className="line-clamp-2 text-ink-muted">{item.reason ?? '—'}</span>
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-2.5 text-ink-faint">
                        {formatDuration(item.duration_ms)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to={`/cases/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="whitespace-nowrap font-medium text-brand-700 hover:underline"
                        >
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[12px] text-ink-faint">
            <span>Showing {rows.length} of {cases?.length ?? 0} cases</span>
            {rows.length > 0 ? (
              <span>Click any row for side panel details</span>
            ) : null}
          </div>
        </div>

        {selected ? (
          <Card
            title="Case details"
            action={
              <button onClick={() => setSelected(null)} className="text-ink-faint hover:text-ink" aria-label="Close">
                <IconCross className="h-4 w-4" />
              </button>
            }
          >
            {!detail ? (
              <Spinner />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {detail.verdict ? <VerdictPill verdict={detail.verdict} /> : null}
                    <span className="font-mono text-[11.5px] text-ink-faint">{detail.id.slice(0, 12)}…</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(detail.id)
                      showToast('Case ID copied to clipboard', 'success')
                    }}
                    className="text-[11px] text-brand-600 hover:underline font-mono"
                  >
                    Copy ID
                  </button>
                </div>
                <dl className="mt-3">
                  <Row label="Screened" value={formatTimestamp(detail.created_at)} />
                  <Row label="Officer" value={detail.officer_id} />
                  <Row label="Duration" value={formatDuration(detail.duration_ms)} />
                  <Row
                    label="Documents"
                    value={detail.doc_types.map((t) => DOC_TYPE_LABELS[t as DocType] ?? t).join(', ')}
                  />
                </dl>

                <p className="label mt-4">Verification timeline</p>
                <ol className="mt-2 space-y-0">
                  {(detail.documents[0]?.checks ?? []).map((check) => (
                    <li key={check.id} className="flex items-start gap-2.5 border-l border-line py-1.5 pl-3 hover:bg-canvas transition-colors">
                      <ResultPill result={check.result} />
                      <span className="min-w-0 flex-1 font-mono text-[11px] text-ink-muted">
                        {check.check_id}
                      </span>
                    </li>
                  ))}
                </ol>

                <div
                  className={cn(
                    'mt-4 rounded-md border px-3 py-2.5 text-[12.5px] leading-relaxed font-medium shadow-xs',
                    detail.verdict === 'clear' && 'border-clear-border bg-clear-bg text-ink-soft',
                    detail.verdict === 'reject' && 'border-reject-border bg-reject-bg text-ink-soft',
                    detail.verdict === 'refer' && 'border-refer-border bg-refer-bg text-ink-soft',
                  )}
                >
                  {detail.reason}
                </div>

                <Link
                  to={`/cases/${detail.id}`}
                  className="mt-3 inline-block text-[12.5px] font-medium text-brand-700 hover:underline"
                >
                  Open full evidence →
                </Link>
              </>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  )
}

