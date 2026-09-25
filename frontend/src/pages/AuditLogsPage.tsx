import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuditRecords, useChainStatus } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Button, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconAlert, IconCheck, IconLink, IconSearch, IconShield, IconLock, IconCopy } from '@/components/common/Icons'
import { showToast } from '@/components/common/Toast'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

const ACTION_LABELS: Record<string, string> = {
  'case.submitted': 'Document Ingestion',
  'screening.complete': 'Verdict Rendered',
  'profile.updated': 'Config Matrix Modified',
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

  const copyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash)
    showToast('Hash copied to clipboard', 'info')
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Cryptographic Audit Trail</h1>
        <p className="text-[13px] text-ink-muted">
          Tamper-evident append-only ledger secured by sequential SHA-256 block hash chaining.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Ledger Blocks" value={chain?.records ?? '—'} tone="brand" icon={<IconShield />} />
        <StatTile label="Verdicts Rendered" value={counts['screening.complete'] ?? 0} tone="clear" icon={<IconCheck />} />
        <StatTile label="Documents Ingested" value={counts['case.submitted'] ?? 0} icon={<IconLink />} />
        <StatTile label="Security Matrix Edits" value={counts['profile.updated'] ?? 0} tone="refer" icon={<IconAlert />} />
      </div>

      {chain ? (
        <div
          className={cn(
            'card flex flex-wrap items-center justify-between gap-4 border-2 p-4 shadow-sm',
            chain.intact ? 'border-clear-border bg-clear-bg/60' : 'border-reject-border bg-reject-bg/60',
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', chain.intact ? 'bg-clear text-white' : 'bg-reject text-white')}>
              {chain.intact ? <IconCheck className="h-5 w-5" /> : <IconAlert className="h-5 w-5" />}
            </div>
            <div>
              <p className={cn('text-[14.5px] font-extrabold', chain.intact ? 'text-clear-dark' : 'text-reject-dark')}>
                {chain.intact ? 'Ledger Chain Verified Intact' : `Cryptographic Discrepancy at Record ${chain.broken_at}`}
              </p>
              <p className="text-[12px] text-ink-soft">{chain.detail}</p>
            </div>
          </div>
          {chain.intact ? (
            <div className="flex items-center gap-2 rounded-lg bg-white/80 px-3 py-1.5 font-mono text-[11px] text-ink-muted border border-line shadow-xs">
              <IconLock className="h-3.5 w-3.5 text-brand-600" />
              <span>HEAD: {chain.head_hash.slice(0, 24)}…</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={cn('grid gap-5', selected ? 'xl:grid-cols-[1fr_380px]' : 'grid-cols-1')}>
        <div className="card min-w-0 overflow-hidden shadow-card">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-canvas/40 p-3.5">
            <div className="relative min-w-[200px] flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by action, case ID or hash..."
                className="w-full rounded-xl border border-line bg-white py-1.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="rounded-xl border border-line bg-white px-3 py-1.5 text-[12.5px] font-medium text-ink focus:border-brand-500 focus:outline-none"
            >
              <option value="">All Action Types</option>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
              ))}
            </select>
            {query || action ? (
              <Button size="sm" variant="ghost" onClick={() => { setQuery(''); setAction('') }}>
                Reset
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-8 text-center"><Spinner className="mx-auto h-6 w-6" /></div>
          ) : rows.length === 0 ? (
            <div className="p-6"><EmptyState title="No ledger records match filter query" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-[13px]">
                <thead className="border-b border-line bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    {['Block #', 'Timestamp', 'Officer ID', 'Ledger Event', 'Case Ref', 'SHA-256 Hash'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={cn('cursor-pointer transition-colors hover:bg-brand-50/40', selected === r.id && 'bg-brand-50/80 font-medium')}
                    >
                      <td className="tnum px-4 py-3 font-mono text-[11.5px] font-bold text-brand-700">#{r.sequence}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[12px] text-ink-muted">{formatTimestamp(r.timestamp)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{r.officer_id}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-semibold text-ink-soft border border-line">
                          {ACTION_LABELS[r.action] ?? r.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-ink-muted">
                        {r.case_id ? `${r.case_id.slice(0, 12)}…` : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-faint">
                        {r.record_hash.slice(0, 18)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-line bg-canvas/40 px-4 py-2 text-[11.5px] text-ink-muted font-medium">
            Displaying {rows.length} verified blocks out of {records?.length ?? 0} total ledger events
          </div>
        </div>

        {detail ? (
          <aside className="card space-y-4 p-5 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="label">Block Ledger Inspector</span>
              <button onClick={() => setSelected(null)} className="text-ink-muted hover:text-ink text-xs font-bold" aria-label="Close">
                ✕ Close
              </button>
            </div>

            <dl className="space-y-1.5 text-[12.5px]">
              <Row label="Block Height" value={<span className="font-mono font-bold text-brand-700">#{detail.sequence}</span>} />
              <Row label="Ledger Event" value={ACTION_LABELS[detail.action] ?? detail.action} />
              <Row label="Officer" value={detail.officer_id} />
              <Row label="Recorded At" value={formatTimestamp(detail.timestamp)} />
              {detail.case_id ? (
                <Row
                  label="Linked Case"
                  value={
                    <Link to={`/cases/${detail.case_id}`} className="font-mono text-[11.5px] font-bold text-brand-700 hover:underline">
                      {detail.case_id.slice(0, 16)}… →
                    </Link>
                  }
                />
              ) : null}
            </dl>

            <div className="space-y-2 border-t border-line pt-3">
              <span className="label">Cryptographic Proof Hashes</span>
              <div className="rounded-xl border border-line bg-canvas/70 p-3 space-y-2 text-[11px]">
                <div>
                  <span className="block font-semibold text-ink-muted">Payload Hash:</span>
                  <div className="flex items-center justify-between font-mono text-ink-soft mt-0.5">
                    <span className="truncate">{detail.payload_hash}</span>
                    <button onClick={() => copyHash(detail.payload_hash)} className="text-brand-600 hover:text-brand-800 ml-1">
                      <IconCopy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <span className="block font-semibold text-ink-muted">Previous Block Hash:</span>
                  <span className="block font-mono text-ink-soft truncate mt-0.5">{detail.previous_hash}</span>
                </div>
                <div>
                  <span className="block font-semibold text-ink-muted">Chained Record Hash:</span>
                  <span className="block font-mono font-bold text-clear-dark truncate mt-0.5">{detail.record_hash}</span>
                </div>
              </div>
            </div>

            <Note tone="info">
              <IconShield className="h-4 w-4 shrink-0 text-brand-600" />
              <span>
                <code className="font-mono text-[10.5px]">SHA256(payload + prev_hash)</code> guarantees tamper detection with zero external cloud dependencies.
              </span>
            </Note>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
