import { Link } from 'react-router-dom'
import { useCase, useCases, useHealth, useStats } from '@/api/hooks'
import { StatTile } from '@/components/common/StatTile'
import { Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { ResultPill, VerdictPill } from '@/components/common/Badge'
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconDoc,
  IconInfo,
  IconShield,
} from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { fieldLabel, formatDuration, formatRelative, formatTimestamp } from '@/lib/format'

export function DashboardPage() {
  const { data: stats } = useStats()
  const { data: cases } = useCases()
  const { data: health } = useHealth()

  const latestId = cases?.[0]?.id
  const { data: latest } = useCase(latestId)
  const document = latest?.documents?.[0]

  const period = stats?.period
  const missing = health
    ? Object.entries(health.modules).filter(([, ok]) => !ok).map(([n]) => n)
    : []

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="card relative overflow-hidden px-5 py-4">
        <div className="relative z-10">
          <h1 className="text-[22px] font-bold text-ink">Welcome, Officer</h1>
          <p className="text-[13px] text-ink-muted">Together for a Secure and Authentic India.</p>
        </div>
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-1/3 opacity-[0.13]"
          style={{ background: 'linear-gradient(115deg, #FF9933 0%, #ffffff 50%, #138808 100%)' }}
          aria-hidden="true"
        />
        <p className="absolute right-6 top-1/2 z-10 hidden -translate-y-1/2 text-right text-[15px] font-semibold italic leading-tight text-navy-800 md:block">
          “Viksit Bharat
          <br />
          Secure Bharat”
        </p>
      </div>

      {/* Counters */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total verifications"
          value={period?.total ?? '—'}
          delta={stats?.change_percent ?? null}
          sub={stats ? `last ${stats.window_days} days` : undefined}
          tone="brand"
          icon={<IconDoc />}
        />
        <StatTile
          label="Cleared"
          value={period?.clear ?? '—'}
          sub={period ? `${period.clear_share}% of decided` : undefined}
          tone="clear"
          icon={<IconCheck />}
        />
        <StatTile
          label="Rejected"
          value={period?.reject ?? '—'}
          sub={period ? `${period.reject_share}% of decided` : undefined}
          tone="reject"
          icon={<IconAlert />}
        />
        <StatTile
          label="Referred to an examiner"
          value={period?.refer ?? '—'}
          sub={period ? `${period.refer_share}% of decided` : undefined}
          tone="refer"
          icon={<IconClock />}
        />
      </div>

      {/* Latest screening */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Start a verification" step={1}>
          <p className="text-[13px] text-ink-muted">
            Each document is checked against its own source of truth — a UIDAI signature, a PAN
            structure, an MRZ check digit — before anything about its appearance is considered.
          </p>
          <Link
            to="/verify"
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-brand-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-brand-700"
          >
            Verify a document
          </Link>
          <div className="mt-4 space-y-2 border-t border-line pt-4 text-[12.5px]">
            <Row label="Storage" value={<span className="font-mono">{health?.storage ?? '—'}</span>} />
            <Row label="Execution" value={<span className="font-mono">{health?.execution ?? '—'}</span>} />
            <Row
              label="Offline"
              value={
                health?.offline_capable ? (
                  <span className="text-clear">decisive checks need no network</span>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </Card>

        <Card title="Most recent screening" step={2}>
          {!latest ? (
            <EmptyState title="Nothing screened yet" detail="Verified documents appear here." />
          ) : (
            <>
              <div className="flex items-center gap-3">
                {latest.verdict ? <VerdictPill verdict={latest.verdict} /> : null}
                <span className="text-[12px] text-ink-muted">
                  {formatRelative(latest.created_at)} · {formatDuration(latest.duration_ms)}
                </span>
              </div>
              <ol className="mt-4 space-y-0">
                {(document?.checks ?? []).slice(0, 7).map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5 border-b border-line py-2 last:border-0">
                    <ResultPill result={check.result} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft" title={check.citation}>
                      {check.check_id}
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                to={`/cases/${latest.id}`}
                className="mt-3 inline-block text-[12.5px] font-medium text-brand-700 hover:underline"
              >
                Open full result →
              </Link>
            </>
          )}
        </Card>

        <Card title="Verification result" step={3}>
          {!latest?.verdict ? (
            <EmptyState title="No verdict yet" />
          ) : (
            <>
              <div
                className={
                  latest.verdict === 'clear'
                    ? 'rounded-lg border-2 border-clear-border bg-clear-bg p-4 text-center'
                    : latest.verdict === 'reject'
                      ? 'rounded-lg border-2 border-reject-border bg-reject-bg p-4 text-center'
                      : 'rounded-lg border-2 border-refer-border bg-refer-bg p-4 text-center'
                }
              >
                <p
                  className={
                    latest.verdict === 'clear'
                      ? 'text-[26px] font-bold text-clear'
                      : latest.verdict === 'reject'
                        ? 'text-[26px] font-bold text-reject'
                        : 'text-[26px] font-bold text-refer'
                  }
                >
                  {latest.verdict.toUpperCase()}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{latest.reason}</p>
              </div>
              <dl className="mt-4 space-y-0">
                <Row
                  label="Document"
                  value={DOC_TYPE_LABELS[(document?.doc_type ?? 'unknown') as DocType] ?? document?.doc_type}
                />
                <Row label="Case ID" value={<span className="font-mono text-[11.5px]">{latest.id.slice(0, 18)}…</span>} />
                <Row label="Processed" value={formatTimestamp(latest.created_at)} />
              </dl>
            </>
          )}
        </Card>
      </div>

      {/* Detail strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Extracted information">
          {!document || Object.keys(document.extracted_fields).length === 0 ? (
            <EmptyState title="Nothing extracted yet" />
          ) : (
            <dl>
              {Object.entries(document.extracted_fields)
                .filter(([name]) => name !== 'raw_text' && name !== 'aadhaar_qr')
                .slice(0, 9)
                .map(([name, value]) => (
                  <Row
                    key={name}
                    label={fieldLabel(name)}
                    value={<span className="font-mono text-[12px]">{String(value)}</span>}
                  />
                ))}
            </dl>
          )}
        </Card>

        <Card title="Security checks">
          {!document ? (
            <EmptyState title="No checks yet" />
          ) : (
            <ul className="space-y-1.5">
              {document.checks.map((check) => (
                <li key={check.id} className="flex items-center gap-2.5 text-[12.5px]">
                  <ResultPill result={check.result} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-soft">
                    {check.check_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Deployment capability">
          <p className="text-[12.5px] text-ink-muted">
            What this deployment can and cannot do right now.
          </p>
          <ul className="mt-3 space-y-1.5">
            {Object.entries(health?.modules ?? {}).map(([name, ok]) => (
              <li key={name} className="flex items-center gap-2 text-[12.5px]">
                {ok ? (
                  <IconCheck className="h-4 w-4 text-clear" />
                ) : (
                  <IconInfo className="h-4 w-4 text-ink-faint" />
                )}
                <span className="capitalize text-ink-soft">{name}</span>
                <span className="ml-auto text-[11.5px] text-ink-faint">
                  {ok ? 'available' : 'not installed'}
                </span>
              </li>
            ))}
          </ul>
          {missing.length ? (
            <div className="mt-3">
              <Note tone="warn">
                <IconShield className="h-4 w-4 shrink-0" />
                <span>
                  A module that cannot run reports <strong>could not run</strong> and sends the
                  case to an examiner. It never becomes a rejection.
                </span>
              </Note>
            </div>
          ) : null}
        </Card>
      </div>

      {!stats ? <Spinner /> : null}
    </div>
  )
}
