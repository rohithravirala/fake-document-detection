import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuditRecords, useChainStatus } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Button, Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconAlert, IconCheck, IconCross, IconLink, IconSearch, IconShield } from '@/components/common/Icons'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

const ACTION_LABELS: Record<string, string> = {
  'case.submitted': 'Document submitted',
  'screening.complete': 'Screening completed',
  'profile.updated': 'Verification profile updated',
}

export function AuditLogsPage() {
  const { data: chain } = useChainStatus()
  const { data: records, isLoading } = useAuditRecords()
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (records ?? []).filter((r) => {
      if (action && r.action !== action) return false
      if (!needle) return true
      return (
        r.action.toLowerCase().includes(needle) ||
        (r.case_id ?? '').toLowerCase().includes(needle) ||
        r.record_hash.toLowerCase().includes(needle)
      )
    })
  }, [records, query, action])

  const actions = useMemo(
    () => Array.from(new Set((records ?? []).map((r) => r.action))).sort(),
    [records],
  )

  const detail = rows.find((r) => r.id === selected) ?? null
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of records ?? []) c[r.action] = (c[r.action] ?? 0) + 1
    return c
  }, [records])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">Audit Logs</h1>
        <p className="text-[13px] text-ink-muted">
          Every action, linked to the one before it by hash. Altering a past record breaks every
          link after it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total log entries" value={chain?.records ?? '—'} tone="brand" icon={<IconShield />} />
        <StatTile label="Screenings completed" value={counts['screening.complete'] ?? 0} tone="clear" icon={<IconCheck />} />
        <StatTile label="Documents submitted" value={counts['case.submitted'] ?? 0} icon={<IconLink />} />
        <StatTile label="Profile changes" value={counts['profile.updated'] ?? 0} tone="refer" icon={<IconAlert />} />
      </div>

      {chain ? (
        <div
          className={cn(
            'card flex flex-wrap items-center gap-x-6 gap-y-2 border-2 px-5 py-3.5',
            chain.intact ? 'border-clear-border bg-clear-bg' : 'border-reject-border bg-reject-bg',
          )}
        >
          {chain.intact ? (
            <IconCheck className="h-5 w-5 text-clear" />
          ) : (
            <IconAlert className="h-5 w-5 text-reject" />
          )}
          <div className="min-w-0">
            <p className={cn('text-[14px] font-semibold', chain.intact ? 'text-clear' : 'text-reject')}>
              {chain.intact ? 'Chain intact' : `Chain broken at record ${chain.broken_at}`}
            </p>
            <p className="text-[12.5px] text-ink-soft">{chain.detail}</p>
          </div>
          {chain.intact ? (
            <p className="ml-auto font-mono text-[11px] text-ink-faint">head {chain.head_hash.slice(0, 32)}…</p>
          ) : null}
        </div>
      ) : null}

      <div className={cn('grid gap-4', selected ? 'xl:grid-cols-[1fr_360px]' : 'grid-cols-1')}>
        <div className="card min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <label className="relative min-w-[200px] flex-1">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by action, case ID or hash"
                className="w-full rounded-md border border-line-strong py-1.5 pl-8 pr-3 text-[13px]"
              />
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-md border border-line-strong px-2 py-1.5 text-[13px]"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </select>
            {query || action ? (
              <Button size="sm" variant="ghost" onClick={() => { setQuery(''); setAction('') }}>
                Clear
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-6"><Spinner /></div>
          ) : rows.length === 0 ? (
            <div className="p-5"><EmptyState title="No audit records match" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-[13px]">
                <thead className="border-b border-line bg-canvas">
                  <tr>
                    {['#', 'Timestamp', 'Officer', 'Action', 'Case', 'Record hash'].map((h) => (
                      <th key={h} className="label whitespace-nowrap px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={cn('cursor-pointer hover:bg-brand-50/50', selected === r.id && 'bg-brand-50')}
                    >
                      <td className="tnum px-3 py-2.5 font-mono text-[11.5px] text-ink-faint">{r.sequence}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{formatTimestamp(r.timestamp)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{r.officer_id}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{ACTION_LABELS[r.action] ?? r.action}</td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-ink-muted">
                        {r.case_id ? `${r.case_id.slice(0, 10)}…` : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-ink-faint">
                        {r.record_hash.slice(0, 18)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-3 py-2 text-[12px] text-ink-faint">
            Showing {rows.length} of {records?.length ?? 0} entries
          </p>
        </div>

        {detail ? (
          <Card
            title="Log details"
            action={
              <button onClick={() => setSelected(null)} className="text-ink-faint hover:text-ink" aria-label="Close">
                <IconCross className="h-4 w-4" />
              </button>
            }
          >
            <dl>
              <Row label="Sequence" value={<span className="tnum font-mono">{detail.sequence}</span>} />
              <Row label="Action" value={ACTION_LABELS[detail.action] ?? detail.action} />
              <Row label="Officer" value={detail.officer_id} />
              <Row label="Timestamp" value={formatTimestamp(detail.timestamp)} />
              {detail.case_id ? (
                <Row
                  label="Case"
                  value={
                    <Link to={`/cases/${detail.case_id}`} className="font-mono text-[12px] text-brand-700 hover:underline">
                      {detail.case_id.slice(0, 16)}…
                    </Link>
                  }
                />
              ) : null}
            </dl>

            <p className="label mt-4">Chain integrity</p>
            <dl className="mt-1">
              <Row label="Payload hash" value={<span className="break-all font-mono text-[11px]">{detail.payload_hash}</span>} />
              <Row label="Previous" value={<span className="break-all font-mono text-[11px]">{detail.previous_hash}</span>} />
              <Row label="Record hash" value={<span className="break-all font-mono text-[11px]">{detail.record_hash}</span>} />
            </dl>

            <div className="mt-3">
              <Note>
                <IconShield className="h-4 w-4 shrink-0" />
                <span>
                  <code className="font-mono">sha256(payload + previous_hash)</code>. This is a hash
                  chain, not a blockchain — the same tamper-evidence, none of the consensus
                  machinery, and no network dependency.
                </span>
              </Note>
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-[12.5px] font-medium text-brand-700">
                Raw payload
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-canvas p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
{JSON.stringify(detail.payload, null, 2)}
              </pre>
            </details>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
