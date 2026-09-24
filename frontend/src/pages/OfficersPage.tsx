import { Link } from 'react-router-dom'
import { useOfficers } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconAlert, IconCheck, IconInfo, IconShield, IconUsers } from '@/components/common/Icons'
import { formatTimestamp } from '@/lib/format'
import { useAuth } from '@/lib/auth'

export function OfficersPage() {
  const { data, isLoading } = useOfficers()
  const { user } = useAuth()

  if (isLoading || !data) return <Spinner />

  const activeOfficerName = user?.name || data.configured_officer

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">User Management</h1>
          <p className="text-[13px] text-ink-muted">Officers, roles and access permissions.</p>
        </div>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-700 transition"
        >
          <IconUsers className="h-4 w-4" />
          <span>Switch Officer / Sign In</span>
        </Link>
      </div>

      <Note tone={user ? 'info' : 'warn'}>
        {user ? (
          <IconCheck className="h-4 w-4 shrink-0 text-clear" />
        ) : (
          <IconAlert className="h-4 w-4 shrink-0" />
        )}
        <span>
          <strong>Officer Authentication Active:</strong> Currently signed in as{' '}
          <strong className="text-ink">{activeOfficerName}</strong> ({user?.email || 'portal session'}),
          assigned as <span className="font-semibold text-ink">{user?.role || 'Verification Officer'}</span>{' '}
          with Badge <code className="font-mono">{user?.badgeNumber || 'IN-OFF-7042'}</code>.
          Every document verification is cryptographically signed and attributed to this identity in the audit chain.
        </span>
      </Note>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Active Officer"
          value={activeOfficerName}
          sub={user?.role || 'Verification Officer'}
          tone="brand"
          icon={<IconShield />}
        />
        <StatTile
          label="Sign-in status"
          value={user ? 'Authenticated' : 'Signed Out'}
          sub="Officer Portal active"
          tone={user ? 'clear' : 'refer'}
        />
        <StatTile
          label="Badge Number"
          value={user?.badgeNumber || 'IN-OFF-7042'}
          sub={user?.department || 'Document Forensics'}
        />
        <StatTile
          label="Actions recorded"
          value={data.officers.reduce((s, o) => s + o.actions, 0)}
          sub="in the audit chain"
        />
      </div>

      <Card title="Officers in active sessions & audit log">
        {data.officers.length === 0 ? (
          <EmptyState title="No actions recorded yet" detail="Officers appear here once they screen a document." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead className="border-b border-line bg-canvas">
                <tr>
                  {['Officer', 'Role', 'Source', 'Actions', 'Last action'].map((h) => (
                    <th key={h} className="label whitespace-nowrap px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.officers.map((o) => (
                  <tr key={o.officer_id}>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-800">
                          {o.officer_id.slice(0, 1).toUpperCase()}
                        </span>
                        <span className="font-mono text-[12px]">{o.officer_id}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{o.role}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="rounded bg-refer-bg px-1.5 py-[1px] text-[11px] font-medium text-refer">
                        {o.source}
                      </span>
                    </td>
                    <td className="tnum px-3 py-2.5">{o.actions}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                      {formatTimestamp(o.last_action)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Security & Deployment Status">
        <ul className="space-y-2 text-[13px] text-ink-soft">
          <li className="flex gap-2.5">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-clear" />
            <span>
              <strong>Officer sign-in portal:</strong> Active with email, password, and dynamic officer name attribution.
            </span>
          </li>
          <li className="flex gap-2.5">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-clear" />
            <span>
              <strong>Audit log integration:</strong> Sign-in and sign-out events are cryptographically committed to the tamper-evident hash chain.
            </span>
          </li>
          <li className="flex gap-2.5">
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-clear" />
            <span>
              <strong>Per-officer accountability:</strong> Every screening is timestamped and attributed to the active officer badge.
            </span>
          </li>
          <li className="flex gap-2.5">
            <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
            <span>
              <strong>Two-factor biometric authentication:</strong> Planned roadmap item for high-security border kiosks.
            </span>
          </li>
        </ul>
        <dl className="mt-4 border-t border-line pt-3">
          <Row label="Authentication" value={user ? 'Active (Officer Portal)' : 'Enabled · Not Signed In'} />
          <Row label="Current Officer Session" value={activeOfficerName} />
          <Row label="Assigned Role" value={user?.role || 'Verification Officer'} />
        </dl>
      </Card>
    </div>
  )
}
