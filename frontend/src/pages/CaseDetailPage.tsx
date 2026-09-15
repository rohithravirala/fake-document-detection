import { Link, useParams } from 'react-router-dom'
import { useCase } from '@/api/hooks'
import { VerdictBanner } from '@/components/verdict/VerdictBanner'
import { CheckList } from '@/components/verdict/CheckList'
import { Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconAlert } from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { fieldLabel, formatTimestamp } from '@/lib/format'

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const { data: record, isLoading, isError, error } = useCase(caseId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-ink-muted">
        <Spinner /> Loading case
      </div>
    )
  }

  if (isError || !record) {
    return <EmptyState title="Case not found" detail={(error as Error | undefined)?.message} />
  }

  if (record.status === 'failed') {
    return (
      <div className="space-y-4">
        <Card>
          <Note tone="warn">
            <IconAlert className="h-4 w-4 shrink-0" />
            <span>
              <strong>The screening did not complete.</strong> {record.error ?? ''} No verdict has
              been produced. A failure inside the system says nothing about the document — do not
              treat this as either a pass or a rejection.
            </span>
          </Note>
        </Card>
        <Link to="/verify" className="text-[13px] font-medium text-brand-700 hover:underline">
          Screen another document
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {record.verdict ? (
        <VerdictBanner
          verdict={record.verdict}
          reason={record.reason ?? ''}
          durationMs={record.duration_ms}
          needsRetake={record.reason?.toLowerCase().includes('retake')}
        />
      ) : (
        <EmptyState title="This case has no verdict yet" detail="The screening is still running." />
      )}

      <Card>
        <dl className="grid gap-x-8 sm:grid-cols-3">
          <Row label="Case" value={<span className="font-mono text-[11.5px]">{record.id}</span>} />
          <Row label="Officer" value={record.officer_id} />
          <Row label="Screened" value={formatTimestamp(record.created_at)} />
        </dl>
      </Card>

      {record.documents.map((document) => (
        <section key={document.id} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-[16px] font-semibold text-ink">
              {DOC_TYPE_LABELS[document.doc_type as DocType] ?? document.doc_type}
            </h2>
            {document.filename ? (
              <span className="text-[12px] text-ink-faint">{document.filename}</span>
            ) : null}
            {document.image_hash ? (
              <span className="font-mono text-[11px] text-ink-faint">
                sha256 {document.image_hash.slice(0, 16)}…
              </span>
            ) : null}
          </div>

          {Object.keys(document.extracted_fields).length > 0 ? (
            <Card title="What was read from this document">
              <dl className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(document.extracted_fields)
                  .filter(([name]) => name !== 'raw_text' && name !== 'aadhaar_qr')
                  .map(([name, value]) => (
                    <Row
                      key={name}
                      label={fieldLabel(name)}
                      value={<span className="font-mono text-[12px]">{String(value)}</span>}
                    />
                  ))}
              </dl>
              <p className="mt-3 text-[11.5px] text-ink-faint">
                These are the values printed on the document. Where a signed source states
                something different, the failing check below names both.
              </p>
            </Card>
          ) : null}

          <CheckList checks={document.checks} imageUrl={document.image_url} />
        </section>
      ))}

      <div className="flex gap-4 text-[13px]">
        <Link to="/verify" className="font-medium text-brand-700 hover:underline">
          Screen another document
        </Link>
        <Link to="/cases" className="font-medium text-ink-muted hover:underline">
          Case history
        </Link>
      </div>
    </div>
  )
}
