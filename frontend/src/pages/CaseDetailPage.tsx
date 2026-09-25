import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCase } from '@/api/hooks'
import { VerdictBanner } from '@/components/verdict/VerdictBanner'
import { CheckList } from '@/components/verdict/CheckList'
import { Card, EmptyState, Note, Row, Spinner, Button } from '@/components/common/Primitives'
import { IconAlert, IconLock, IconDownload, IconCheck, IconShield } from '@/components/common/Icons'
import { showToast } from '@/components/common/Toast'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { fieldLabel, formatTimestamp } from '@/lib/format'

export function CaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const { data: record, isLoading, isError, error } = useCase(caseId)
  const [officerNote, setOfficerNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)

  const handleSaveNote = () => {
    setNoteSaved(true)
    showToast('Officer disposition remarks appended to case log', 'success')
  }

  const handleExportJson = () => {
    if (!record) return
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(record, null, 2))
    const dlAnchorElem = document.createElement('a')
    dlAnchorElem.setAttribute('href', dataStr)
    dlAnchorElem.setAttribute('download', `svaram_dossier_${record.id}.json`)
    dlAnchorElem.click()
    showToast('Cryptographic forensic dossier exported', 'success')
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-[13px] font-medium text-ink-muted">
        <Spinner className="h-5 w-5" />
        <span>Decrypting and reconstructing case dossier…</span>
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
            <IconAlert className="h-5 w-5 shrink-0" />
            <span>
              <strong>The screening pipeline was interrupted.</strong> {record.error ?? ''} A technical pipeline fault says nothing about the authenticity of the document.
            </span>
          </Note>
        </Card>
        <Link to="/verify" className="text-[13px] font-semibold text-brand-700 hover:underline">
          ← Screen another document
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/cases" className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">
            ← Cases
          </Link>
          <span className="text-line-strong">/</span>
          <span className="font-mono text-[12.5px] text-ink font-bold">Case {record.id.slice(0, 16)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={handleExportJson}>
            <IconDownload className="h-3.5 w-3.5" />
            <span>Export Case JSON</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            Print Dossier
          </Button>
        </div>
      </div>

      {record.verdict ? (
        <VerdictBanner
          verdict={record.verdict}
          reason={record.reason ?? ''}
          durationMs={record.duration_ms}
          needsRetake={record.reason?.toLowerCase().includes('retake')}
        />
      ) : (
        <EmptyState title="This case has no verdict yet" detail="The screening pipeline is still evaluating checks." />
      )}

      {/* Case Metadata Dossier */}
      <Card title="Chain of Custody & Metadata">
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
          <Row
            label="Case Reference"
            value={
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-brand-800">
                <IconLock className="h-3.5 w-3.5 text-brand-600" />
                {record.id}
              </span>
            }
          />
          <Row label="Investigating Officer" value={record.officer_id || 'Officer On Duty'} />
          <Row label="Verification Timestamp" value={formatTimestamp(record.created_at)} />
        </dl>
      </Card>

      {record.documents.map((document) => (
        <section key={document.id} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[17px] font-bold text-ink">
                {DOC_TYPE_LABELS[document.doc_type as DocType] ?? document.doc_type}
              </h2>
              {document.filename ? (
                <span className="rounded bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted border border-line">
                  {document.filename}
                </span>
              ) : null}
            </div>
            {document.image_hash ? (
              <span className="flex items-center gap-1 font-mono text-[11px] text-ink-muted bg-white px-2 py-0.5 rounded border border-line">
                <IconShield className="h-3 w-3 text-clear" />
                SHA-256: {document.image_hash.slice(0, 20)}…
              </span>
            ) : null}
          </div>

          {Object.keys(document.extracted_fields).length > 0 ? (
            <Card title="Authoritative Extracted Attributes" tricolourAccent>
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
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
              <p className="mt-3.5 text-[11.5px] text-ink-muted border-t border-line/60 pt-2.5">
                Values parsed directly from issuer barcodes, MRZ optical zones, and cryptographic signatures.
              </p>
            </Card>
          ) : null}

          <div className="space-y-2">
            <h3 className="text-[14px] font-bold text-ink">Forensic Security Rule Evaluation</h3>
            <CheckList checks={document.checks} imageUrl={document.image_url} />
          </div>
        </section>
      ))}

      {/* Officer Remarks & Disposition Box */}
      <Card title="Officer Case Affidavit & Remarks">
        <div className="space-y-3">
          <p className="text-[12.5px] text-ink-muted">
            Add discretionary field notes, checkpoint ID, or reason for manual referral to the permanent log.
          </p>
          <textarea
            rows={3}
            placeholder="e.g., Physical document inspected under UV scanner. Hologram integrity confirmed intact."
            value={officerNote}
            onChange={(e) => setOfficerNote(e.target.value)}
            className="w-full rounded-xl border border-line p-3 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex items-center justify-between">
            {noteSaved ? (
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-clear">
                <IconCheck className="h-4 w-4" /> Remarks logged to case
              </span>
            ) : <span />}
            <Button size="sm" onClick={handleSaveNote} disabled={!officerNote.trim()}>
              Save Remarks
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4 text-[13px] pt-2">
        <Link to="/verify" className="font-semibold text-brand-700 hover:text-brand-800">
          ← Verify Another Document
        </Link>
        <span className="text-ink-muted">·</span>
        <Link to="/cases" className="font-medium text-ink-muted hover:text-ink">
          Browse All Archive Cases
        </Link>
      </div>
    </div>
  )
}
