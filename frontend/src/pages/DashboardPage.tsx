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
  IconVerify,
  IconSparkles,
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
    <div className="space-y-6">
      {/* Modern High-Impact Welcome Banner */}
      <div className="card relative overflow-hidden bg-gradient-to-r from-navy-950 via-navy-900 to-navy-850 px-6 py-5 text-white shadow-panel">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-saffron px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-navy-950">
                OFFICIAL PORTAL
              </span>
              <span className="text-[12px] text-white/60">SIH 2026 · Problem SIH26188</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl text-white">
              SVARAM Mission Dashboard
            </h1>
            <p className="mt-1 text-[13px] text-white/80 max-w-xl">
              Real-time cryptographic forensic screening & tamper detection for Indian identity credentials.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/verify"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-glow transition-all hover:opacity-95 hover:scale-[1.02] active:scale-[0.98]"
            >
              <IconVerify className="h-4 w-4" />
              <span>Verify New Document</span>
            </Link>
          </div>
        </div>

        {/* Decorative background national tricolour watermark */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-full w-2/5 opacity-15"
          style={{ background: 'linear-gradient(115deg, #FF9933 0%, #ffffff 50%, #138808 100%)' }}
          aria-hidden="true"
        />
      </div>

      {/* Counters Grid with Rich Accents */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Screenings"
          value={period?.total ?? '—'}
          delta={stats?.change_percent ?? null}
          sub={stats ? `Last ${stats.window_days} days throughput` : undefined}
          tone="brand"
          icon={<IconDoc className="text-brand-600" />}
        />
        <StatTile
          label="Cleared (Genuine)"
          value={period?.clear ?? '—'}
          sub={period ? `${period.clear_share}% verified clean` : undefined}
          tone="clear"
          icon={<IconCheck className="text-clear" />}
        />
        <StatTile
          label="Rejected (Fraudulent)"
          value={period?.reject ?? '—'}
          sub={period ? `${period.reject_share}% flagged tamper` : undefined}
          tone="reject"
          icon={<IconAlert className="text-reject" />}
        />
        <StatTile
          label="Referred to Examiner"
          value={period?.refer ?? '—'}
          sub={period ? `${period.refer_share}% manual review` : undefined}
          tone="refer"
          icon={<IconClock className="text-refer" />}
        />
      </div>

      {/* 3-Step Verification Flow Overview */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Start Verification" subtitle="Ingest and parse credential" step={1} tricolourAccent>
          <p className="text-[13px] text-ink-muted leading-relaxed">
            Each document is checked against its mathematical source of truth — a UIDAI cryptographic signature,
            a PAN checksum algorithm, an ICAO MRZ check digit — before appearance is inspected.
          </p>
          <Link
            to="/verify"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-xs hover:bg-brand-700 transition"
          >
            <IconSparkles className="h-4 w-4" />
            <span>Launch Ingestion Pipeline</span>
          </Link>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-[12.5px]">
            <Row label="Cryptographic Storage" value={<span className="font-mono text-brand-700">{health?.storage ?? '—'}</span>} />
            <Row label="Pipeline Engine" value={<span className="font-mono">{health?.execution ?? '—'}</span>} />
            <Row
              label="Offline Capability"
              value={
                health?.offline_capable ? (
                  <span className="font-semibold text-clear">Certified Offline</span>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </Card>

        <Card title="Latest Screening" subtitle="Real-time case log" step={2}>
          {!latest ? (
            <EmptyState title="No screening history" detail="Screened documents will populate here in real-time." />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  {latest.verdict ? <VerdictPill verdict={latest.verdict} /> : null}
                  <span className="font-mono text-[11px] text-ink-muted">
                    {latest.id.slice(0, 14)}...
                  </span>
                </div>
                <span className="text-[11.5px] font-medium text-ink-muted">
                  {formatRelative(latest.created_at)}
                </span>
              </div>
              <ol className="mt-3 space-y-1.5">
                {(document?.checks ?? []).slice(0, 6).map((check) => (
                  <li key={check.id} className="flex items-center gap-2 rounded-lg bg-canvas/60 px-2.5 py-1.5 text-[12px]">
                    <ResultPill result={check.result} />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-soft" title={check.citation}>
                      {check.check_id}
                    </span>
                  </li>
                ))}
              </ol>
              <Link
                to={`/cases/${latest.id}`}
                className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800 transition"
              >
                <span>View Full Forensic Dossier</span>
                <span>→</span>
              </Link>
            </>
          )}
        </Card>

        <Card title="Decision Summary" subtitle="Defensible evidence" step={3}>
          {!latest?.verdict ? (
            <EmptyState title="Awaiting screening" detail="Launch a verification to inspect findings." />
          ) : (
            <>
              <div
                className={
                  latest.verdict === 'clear'
                    ? 'rounded-xl border-2 border-clear-border bg-clear-bg p-4 text-center shadow-xs'
                    : latest.verdict === 'reject'
                      ? 'rounded-xl border-2 border-reject-border bg-reject-bg p-4 text-center shadow-xs'
                      : 'rounded-xl border-2 border-refer-border bg-refer-bg p-4 text-center shadow-xs'
                }
              >
                <p
                  className={
                    latest.verdict === 'clear'
                      ? 'text-[24px] font-black tracking-tight text-clear-dark'
                      : latest.verdict === 'reject'
                        ? 'text-[24px] font-black tracking-tight text-reject-dark'
                        : 'text-[24px] font-black tracking-tight text-refer-dark'
                  }
                >
                  {latest.verdict.toUpperCase()}
                </p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-ink-soft">{latest.reason}</p>
              </div>
              <dl className="mt-4 space-y-1">
                <Row
                  label="Document Type"
                  value={DOC_TYPE_LABELS[(document?.doc_type ?? 'unknown') as DocType] ?? document?.doc_type}
                />
                <Row label="Screening Latency" value={formatDuration(latest.duration_ms)} />
                <Row label="Timestamp" value={formatTimestamp(latest.created_at)} />
              </dl>
            </>
          )}
        </Card>
      </div>

      {/* Deployment & Capability Overview */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Extracted Forensic Metadata">
          {!document || Object.keys(document.extracted_fields).length === 0 ? (
            <EmptyState title="No field metadata" detail="Run an OCR or QR verification to extract fields." />
          ) : (
            <dl className="space-y-1">
              {Object.entries(document.extracted_fields)
                .filter(([name]) => name !== 'raw_text' && name !== 'aadhaar_qr')
                .slice(0, 8)
                .map(([name, value]) => (
                  <Row
                    key={name}
                    label={fieldLabel(name)}
                    value={<span className="font-mono text-[12px] text-ink">{String(value)}</span>}
                  />
                ))}
            </dl>
          )}
        </Card>

        <Card title="Security Rule Set">
          {!document ? (
            <EmptyState title="Rules standby" detail="Ingest a document to execute rule sets." />
          ) : (
            <ul className="space-y-1.5">
              {document.checks.map((check) => (
                <li key={check.id} className="flex items-center gap-2 text-[12px]">
                  <ResultPill result={check.result} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-soft">
                    {check.check_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Subsystem Health">
          <p className="text-[12px] text-ink-muted">
            Status of local micro-services and forensic modules.
          </p>
          <ul className="mt-3 space-y-1.5">
            {Object.entries(health?.modules ?? {}).map(([name, ok]) => (
              <li key={name} className="flex items-center gap-2 rounded-lg bg-canvas/50 px-2.5 py-1.5 text-[12px]">
                {ok ? (
                  <IconCheck className="h-4 w-4 text-clear" />
                ) : (
                  <IconInfo className="h-4 w-4 text-ink-faint" />
                )}
                <span className="capitalize font-medium text-ink-soft">{name}</span>
                <span className="ml-auto font-mono text-[11px] text-ink-muted">
                  {ok ? 'ONLINE' : 'OFFLINE'}
                </span>
              </li>
            ))}
          </ul>
          {missing.length ? (
            <div className="mt-3">
              <Note tone="warn">
                <IconShield className="h-4 w-4 shrink-0" />
                <span>
                  Uninstalled modules gracefully forward documents to a human forensic examiner without false rejections.
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
