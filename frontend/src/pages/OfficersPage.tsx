import { useOfficers } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconAlert, IconInfo, IconUsers } from '@/components/common/Icons'
import { formatTimestamp } from '@/lib/format'

/**
 * User management, as it actually is.
 *
 * There is one officer and it is hard-coded. Rendering a populated user table
 * with roles and permissions would be a lie told in the one screen where an
 * operator most needs the truth.
 */
export function OfficersPage() {
  const { data, isLoading } = useOfficers()

  if (isLoading || !data) return <Spinner />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">User Management</h1>
        <p className="text-[13px] text-ink-muted">Officers, roles and access.</p>
      </div>

      <Note tone="warn">
        <IconAlert className="h-4 w-4 shrink-0" />
        <span>
          <strong>No authentication system is built.</strong> {data.note} Every screening is
          attributed to <code className="font-mono">{data.configured_officer}</code>, set by the{' '}
          <code className="font-mono">OFFICER_ID</code> environment variable. The audit log already
          carries an officer id on every record, so adding real identities later changes where that
          value comes from — not the schema.
        </span>
      </Note>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Configured officers" value={data.officers.length} tone="brand" icon={<IconUsers />} />
        <StatTile label="Sign-in required" value="No" sub="deliberate non-goal" />
        <StatTile label="Roles enforced" value="No" sub="every action is permitted" />
        <StatTile
          label="Actions recorded"
          value={data.officers.reduce((s, o) => s + o.actions, 0)}
          sub="in the audit chain"
        />
      </div>

      <Card title="Officers seen in the audit log">
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

      <Card title="What a real deployment would need">
        <ul className="space-y-2 text-[13px] text-ink-soft">
          {[
            'Officer sign-in, with sessions and an identity provider',
            'Roles — a viewer must not be able to publish a verification profile',
            'Per-officer attribution on every case and audit record (the columns exist)',
            'Sign-in and sign-out written to the audit chain alongside screenings',
          ].map((item) => (
            <li key={item} className="flex gap-2.5">
              <IconInfo className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
              {item}
            </li>
          ))}
        </ul>
        <dl className="mt-4 border-t border-line pt-3">
          <Row label="Authentication" value={data.authentication ? 'enabled' : 'not built'} />
        </dl>
      </Card>
    </div>
  )
}
