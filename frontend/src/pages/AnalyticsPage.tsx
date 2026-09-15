import { Link } from 'react-router-dom'
import { useAnalytics } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Card, EmptyState, Note, Spinner } from '@/components/common/Primitives'
import { BarList, CHART_COLORS, Donut, NoData, TrendChart } from '@/components/charts/Charts'
import { SeverityPill, VerdictPill } from '@/components/common/Badge'
import { IconAlert, IconCheck, IconClock, IconDoc, IconInfo, IconUsers } from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { formatTimestamp } from '@/lib/format'

const TYPE_COLORS = ['#1D57EB', '#12854F', '#A96A00', '#7C3AED', '#0E7490', '#94A3B8']

export function AnalyticsPage() {
  const { data, isLoading } = useAnalytics(15)

  if (isLoading || !data) return <Spinner />

  const period = data.overview.period
  const checks = data.check_outcomes

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-ink">Analytics</h1>
          <p className="text-[13px] text-ink-muted">
            Every figure below is computed from screenings actually performed.
          </p>
        </div>
        <span className="text-[12.5px] text-ink-muted">Last {data.overview.window_days} days</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Total verifications"
          value={period.total}
          delta={data.overview.change_percent}
          tone="brand"
          icon={<IconDoc />}
        />
        <StatTile label="Cleared" value={period.clear} sub={`${period.clear_share}%`} tone="clear" icon={<IconCheck />} />
        <StatTile label="Rejected" value={period.reject} sub={`${period.reject_share}%`} tone="reject" icon={<IconAlert />} />
        <StatTile label="Referred" value={period.refer} sub={`${period.refer_share}%`} tone="refer" icon={<IconClock />} />
        <StatTile
          label="Distinct identities"
          value={data.overview.unique_identities}
          sub="by document number"
          icon={<IconUsers />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Verification trend" className="xl:col-span-1">
          <TrendChart data={data.trend} />
        </Card>

        <Card title="Document type distribution">
          <Donut
            slices={data.document_types.map((d, i) => ({
              label: DOC_TYPE_LABELS[d.doc_type as DocType] ?? d.doc_type,
              value: d.count,
              color: TYPE_COLORS[i % TYPE_COLORS.length],
            }))}
            centreValue={data.document_types.reduce((s, d) => s + d.count, 0)}
            centreLabel="documents"
          />
        </Card>

        <Card title="Verification outcome">
          <Donut
            slices={[
              { label: 'Cleared', value: period.clear, color: CHART_COLORS.clear },
              { label: 'Rejected', value: period.reject, color: CHART_COLORS.reject },
              { label: 'Referred', value: period.refer, color: CHART_COLORS.refer },
            ]}
            centreValue={period.clear + period.reject + period.refer}
            centreLabel="decided"
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Why documents failed">
          <BarList
            items={data.rejection_reasons.map((r) => ({
              label: r.reason,
              value: r.count,
              share: r.share,
            }))}
            emptyLabel="No check has failed yet."
          />
        </Card>

        <Card title="Check outcomes">
          <BarList
            color={CHART_COLORS.brand}
            items={[
              { label: 'Passed', value: checks.pass ?? 0 },
              { label: 'Failed', value: checks.fail ?? 0 },
              { label: 'Inconclusive', value: checks.inconclusive ?? 0 },
              { label: 'Could not run', value: checks.unavailable ?? 0 },
              { label: 'Retake needed', value: checks.retake ?? 0 },
            ].filter((i) => i.value > 0)}
            emptyLabel="No checks recorded yet."
          />
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            <strong>Could not run</strong> is counted separately from <strong>failed</strong> on
            purpose. A missing model is not a forgery, and collapsing the two would make the system
            look more decisive than it is.
          </p>
        </Card>

        <Card title="Identity links">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-canvas px-3 py-3">
              <p className="tnum text-[24px] font-bold text-ink">{data.identity_links.flagged}</p>
              <p className="text-[12px] text-ink-muted">Multiple identities flagged</p>
            </div>
            <div className="rounded-md border border-line bg-canvas px-3 py-3">
              <p className="tnum text-[24px] font-bold text-ink">
                {data.identity_links.encounters_stored}
              </p>
              <p className="text-[12px] text-ink-muted">Face embeddings stored</p>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            A flag means one face was screened under more than one document number. Verifying a
            document cannot find this — only comparing across screenings can.
          </p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card title="Recent cases needing attention">
          {data.high_risk.length === 0 ? (
            <EmptyState title="Nothing rejected or referred yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="border-b border-line bg-canvas">
                  <tr>
                    {['Case', 'When', 'Document', 'Cause', 'Severity', 'Outcome', ''].map((h) => (
                      <th key={h} className="label whitespace-nowrap px-3 py-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.high_risk.map((row) => (
                    <tr key={row.case_id}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px] text-ink-muted">
                        {row.case_id.slice(0, 10)}…
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                        {formatTimestamp(row.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {row.doc_types.map((t) => DOC_TYPE_LABELS[t as DocType] ?? t).join(', ')}
                      </td>
                      <td className="px-3 py-2 text-ink-soft">{row.reason}</td>
                      <td className="px-3 py-2"><SeverityPill severity={row.severity} /></td>
                      <td className="px-3 py-2"><VerdictPill verdict={row.verdict} /></td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/cases/${row.case_id}`}
                          className="whitespace-nowrap font-medium text-brand-700 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Accuracy">
            <Note tone="warn">
              <IconInfo className="h-4 w-4 shrink-0" />
              <span>{data.accuracy_note}</span>
            </Note>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
              What can be claimed precisely: if the UIDAI signature verifies and the printed text
              disagrees with what was signed, the document was altered. That is not statistical.
            </p>
          </Card>

          <Card title="Geographical distribution">
            <NoData label={data.geography_note} />
          </Card>
        </div>
      </div>
    </div>
  )
}
