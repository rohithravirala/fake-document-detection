import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAnalytics } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Card, EmptyState, Note, Spinner } from '@/components/common/Primitives'
import { BarList, CHART_COLORS, Donut, NoData, TrendChart } from '@/components/charts/Charts'
import { SeverityPill, VerdictPill } from '@/components/common/Badge'
import { IconAlert, IconCheck, IconClock, IconDoc, IconUsers, IconShield } from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { formatTimestamp } from '@/lib/format'

const TYPE_COLORS = ['#1D57EB', '#12854F', '#A96A00', '#7C3AED', '#0E7490', '#94A3B8']

export function AnalyticsPage() {
  const [windowDays, setWindowDays] = useState(15)
  const { data, isLoading } = useAnalytics(windowDays)

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-ink-muted font-medium">
        <Spinner className="h-6 w-6" />
        <span>Aggregating cross-checkpoint forensic metrics…</span>
      </div>
    )
  }

  const period = data.overview.period
  const checks = data.check_outcomes

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Forensic Analytics & Intelligence</h1>
          <p className="text-[13px] text-ink-muted">
            Aggregated empirical findings derived from real screening operations across all stations.
          </p>
        </div>

        {/* Window period switcher */}
        <div className="flex items-center gap-1 rounded-xl bg-canvas p-1 border border-line">
          {[7, 15, 30].map((days) => (
            <button
              key={days}
              onClick={() => setWindowDays(days)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                windowDays === days
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          label="Total Screenings"
          value={period.total}
          delta={data.overview.change_percent}
          tone="brand"
          icon={<IconDoc />}
        />
        <StatTile label="Cleared" value={period.clear} sub={`${period.clear_share}% genuine`} tone="clear" icon={<IconCheck />} />
        <StatTile label="Rejected" value={period.reject} sub={`${period.reject_share}% intercepted`} tone="reject" icon={<IconAlert />} />
        <StatTile label="Referred" value={period.refer} sub={`${period.refer_share}% examiner queue`} tone="refer" icon={<IconClock />} />
        <StatTile
          label="Unique Subjects"
          value={data.overview.unique_identities}
          sub="Distinct ID numbers"
          icon={<IconUsers />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Screening Verdict Trend" subtitle="Daily throughput breakdown" className="xl:col-span-1">
          <TrendChart data={data.trend} />
        </Card>

        <Card title="Document Category Share" subtitle="Breakdown by credential type">
          <Donut
            slices={data.document_types.map((d, i) => ({
              label: DOC_TYPE_LABELS[d.doc_type as DocType] ?? d.doc_type,
              value: d.count,
              color: TYPE_COLORS[i % TYPE_COLORS.length],
            }))}
            centreValue={data.document_types.reduce((s, d) => s + d.count, 0)}
            centreLabel="DOCUMENTS"
          />
        </Card>

        <Card title="Outcome Decisions" subtitle="Cleared vs Rejected vs Referred">
          <Donut
            slices={[
              { label: 'Cleared', value: period.clear, color: CHART_COLORS.clear },
              { label: 'Rejected', value: period.reject, color: CHART_COLORS.reject },
              { label: 'Referred', value: period.refer, color: CHART_COLORS.refer },
            ]}
            centreValue={period.clear + period.reject + period.refer}
            centreLabel="VERDICTS"
          />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Primary Forgery Vectors" subtitle="Root cause of rejections">
          <BarList
            items={data.rejection_reasons.map((r) => ({
              label: r.reason,
              value: r.count,
              share: r.share,
            }))}
            emptyLabel="Zero fraudulent documents detected in this window."
          />
        </Card>

        <Card title="Check Rule Pipeline Outcomes" subtitle="Micro-check performance">
          <BarList
            color={CHART_COLORS.brand}
            items={[
              { label: 'Passed Clean', value: checks.pass ?? 0 },
              { label: 'Failed Rule', value: checks.fail ?? 0 },
              { label: 'Inconclusive', value: checks.inconclusive ?? 0 },
              { label: 'Offline Skipped', value: checks.unavailable ?? 0 },
              { label: 'Optical Retake Needed', value: checks.retake ?? 0 },
            ].filter((i) => i.value > 0)}
            emptyLabel="No checks recorded yet."
          />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted border-t border-line/60 pt-2.5">
            <strong>Offline Skipped</strong> checks are counted separately from failures to ensure system availability does not falsely bias integrity statistics.
          </p>
        </Card>

        <Card title="Biometric Cross-Matches" subtitle="De-duplication signals">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-canvas/70 p-3.5 shadow-xs">
              <p className="tnum text-[26px] font-black text-reject-dark">{data.identity_links.flagged}</p>
              <p className="text-[11.5px] font-semibold text-ink-muted">Multi-Identity Flags</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas/70 p-3.5 shadow-xs">
              <p className="tnum text-[26px] font-black text-brand-700">
                {data.identity_links.encounters_stored}
              </p>
              <p className="text-[11.5px] font-semibold text-ink-muted">512D Embeddings</p>
            </div>
          </div>
          <p className="mt-3.5 text-[11px] leading-relaxed text-ink-muted">
            Intercepts cases where one individual presents disparate identity documents across time.
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="High-Risk Interceptions & Examiner Queue" subtitle="Flagged cases requiring review">
          {data.high_risk.length === 0 ? (
            <EmptyState title="No high-risk cases logged" detail="Clean operation recorded." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead className="border-b border-line bg-canvas/80 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  <tr>
                    {['Case Ref', 'Timestamp', 'Type', 'Reason', 'Severity', 'Verdict', ''].map((h) => (
                      <th key={h} className="px-3.5 py-2.5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.high_risk.map((row) => (
                    <tr key={row.case_id} className="hover:bg-brand-50/30 transition-colors">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[11px] font-bold text-brand-800">
                        {row.case_id.slice(0, 10)}…
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-[11.5px] text-ink-muted">
                        {formatTimestamp(row.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-medium text-ink">
                        {row.doc_types.map((t) => DOC_TYPE_LABELS[t as DocType] ?? t).join(', ')}
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-soft text-[12.5px]">{row.reason}</td>
                      <td className="px-3.5 py-2.5"><SeverityPill severity={row.severity} /></td>
                      <td className="px-3.5 py-2.5"><VerdictPill verdict={row.verdict} /></td>
                      <td className="px-3.5 py-2.5 text-right">
                        <Link
                          to={`/cases/${row.case_id}`}
                          className="rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] font-semibold text-brand-700 shadow-xs hover:bg-brand-50 transition"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Mathematical Defensibility">
            <Note tone="info">
              <IconShield className="h-5 w-5 shrink-0 text-brand-600" />
              <span>{data.accuracy_note}</span>
            </Note>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              Unlike black-box neural networks, SVARAM verifies mathematical parity between issuer public keys and scanned payload structures.
            </p>
          </Card>

          <Card title="Geographical Checkpoints">
            <NoData label={data.geography_note} />
          </Card>
        </div>
      </div>
    </div>
  )
}
