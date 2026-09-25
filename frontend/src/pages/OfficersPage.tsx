import { Link } from 'react-router-dom'
import { useOfficers } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Card, EmptyState, Note, Spinner } from '@/components/common/Primitives'
import { IconAlert, IconCheck, IconShield, IconUsers } from '@/components/common/Icons'
import { formatTimestamp } from '@/lib/format'
import { useAuth } from '@/lib/auth'

export function OfficersPage() {
  const { data, isLoading } = useOfficers()
  const { user } = useAuth()

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-ink-muted font-medium">
        <Spinner className="h-6 w-6" />
        <span>Loading authenticated officer roster…</span>
      </div>
    )
  }

  const activeOfficerName = user?.name || data.configured_officer

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Officer Identity & Clearance Roster</h1>
          <p className="text-[13px] text-ink-muted">Authorized examiners, cryptographic credentials, and duty status.</p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-bold text-white shadow-xs hover:bg-brand-700 transition"
        >
          <IconUsers className="h-4 w-4" />
          <span>Switch Officer Session</span>
        </Link>
      </div>

      <Note tone={user ? 'info' : 'warn'}>
        {user ? (
          <IconCheck className="h-5 w-5 shrink-0 text-clear" />
        ) : (
          <IconAlert className="h-5 w-5 shrink-0" />
        )}
        <span>
          <strong>Cryptographic Officer Attribution:</strong> All document verification verdicts are signed and sealed under{' '}
          <strong className="text-ink">{activeOfficerName}</strong> ({user?.email || 'officer@mha.gov.in'}), assigned as{' '}
          <span className="font-semibold text-brand-700">{user?.role || 'Verification Officer'}</span> with Badge ID{' '}
          <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-line">{user?.badgeNumber || 'IN-OFF-7042'}</code>.
        </span>
      </Note>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active Session Officer"
          value={activeOfficerName}
          sub={user?.role || 'Verification Officer'}
          tone="brand"
          icon={<IconShield className="text-brand-600" />}
        />
        <StatTile
          label="Clearance Status"
          value={user ? 'Certified L3' : 'Guest Mode'}
          sub="Court-admissible signing"
          tone={user ? 'clear' : 'refer'}
          icon={<IconCheck className="text-clear" />}
        />
        <StatTile
          label="Assigned Badge"
          value={user?.badgeNumber || 'IN-OFF-7042'}
          sub={user?.department || 'Document Forensics'}
        />
        <StatTile
          label="Recorded Actions"
          value={data.officers.reduce((s, o) => s + o.actions, 0)}
          sub="Chained to immutable ledger"
        />
      </div>

      <Card title="Active Duty Examiners & Field Log Roster" tricolourAccent>
        {data.officers.length === 0 ? (
          <EmptyState title="No officer actions recorded yet" detail="Examiner activity will appear as documents are screened." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="border-b border-line bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  {['Officer Identifier', 'Designation Role', 'Auth Source', 'Screenings Run', 'Latest Activity'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.officers.map((o) => (
                  <tr key={o.officer_id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-[11.5px] font-bold text-white shadow-xs">
                          {o.officer_id.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="font-mono text-[12.5px] font-bold text-ink">{o.officer_id}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-soft">{o.role}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-mono text-ink-muted border border-line">
                        {o.source}
                      </span>
                    </td>
                    <td className="tnum whitespace-nowrap px-4 py-3 font-mono font-bold text-brand-700">
                      {o.actions} verified
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-ink-muted">
                      {o.last_action ? formatTimestamp(o.last_action) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
