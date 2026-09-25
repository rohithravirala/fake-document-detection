import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DropZone } from '@/components/upload/DropZone'
import { CameraCapture } from '@/components/upload/CameraCapture'
import { DocumentPreview } from '@/components/upload/DocumentPreview'
import { Button, Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { ResultPill, VerdictPill } from '@/components/common/Badge'
import { IconCamera, IconCheck, IconInfo, IconQr, IconUpload, IconSparkles, IconLock } from '@/components/common/Icons'
import { showToast } from '@/components/common/Toast'
import { useCase, useScreeningStream, useSubmit, useSubmitManual } from '@/api/hooks'
import { DOC_TYPES, DOC_TYPE_LABELS, type Check, type DocType, type StreamEvent } from '@/api/types'
import { fieldLabel } from '@/lib/format'
import { guessDocType, humanSize } from '@/lib/utils'
import { DEMO_CASES } from '@/mocks/demo'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: 'Upload & Classify', detail: 'Ingest raw document' },
  { n: 2, label: 'OCR & Parsing', detail: 'Extract MRZ / QR / Fields' },
  { n: 3, label: 'Forensic Check', detail: 'Math & signature verification' },
  { n: 4, label: 'Admissible Verdict', detail: 'Evidence & audit certificate' },
]

function Stepper({ current }: { current: number }) {
  return (
    <ol className="card flex flex-wrap items-center gap-y-3 px-5 py-3.5 shadow-xs border-line">
      {STEPS.map((step, index) => {
        const state = current > step.n ? 'done' : current === step.n ? 'active' : 'todo'
        return (
          <li key={step.n} className="flex min-w-[140px] flex-1 items-center gap-3">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold transition-all duration-300 shadow-xs',
                state === 'done' && 'bg-clear text-white ring-2 ring-clear/20',
                state === 'active' && 'bg-brand-600 text-white shadow-glow ring-2 ring-brand-300 animate-pulse',
                state === 'todo' && 'bg-canvas text-ink-muted border border-line',
              )}
            >
              {state === 'done' ? <IconCheck className="h-4 w-4" /> : step.n}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[12.5px] font-bold tracking-tight',
                  state === 'todo' ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {step.label}
              </span>
              <span className="block truncate text-[11px] text-ink-muted">{step.detail}</span>
            </span>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  'ml-auto hidden h-[2px] min-w-[20px] flex-1 rounded lg:block transition-colors duration-300',
                  current > step.n ? 'bg-clear' : 'bg-line',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function checksFrom(events: StreamEvent[]): Check[] {
  return events
    .filter((e): e is Extract<StreamEvent, { type: 'check' }> => e.type === 'check')
    .map((e) => e.check)
}

export function VerifyPage() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()

  const [tab, setTab] = useState<'file' | 'camera' | 'qr'>('file')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [docType, setDocType] = useState<DocType>('aadhaar')

  const submit = useSubmit()
  const submitManual = useSubmitManual()
  const { events, done } = useScreeningStream(caseId)
  const { data: record } = useCase(caseId, { poll: true })

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const accept = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(next)
    })
    setDocType(guessDocType(next.name) as DocType)
    showToast(`Document "${next.name}" staged`, 'info')
  }, [])

  const streamed = useMemo(() => checksFrom(events), [events])
  const persisted = record?.documents?.[0]?.checks ?? []
  const checks = persisted.length ? persisted : streamed
  const finished = done || record?.status === 'complete' || record?.status === 'failed'

  const step = !caseId ? 1 : finished ? 4 : checks.length ? 3 : 2
  const busy = submit.isPending || submitManual.isPending

  const onSubmit = async () => {
    if (!file) return
    const created = await submit.mutateAsync({ files: [file], docTypes: [docType] })
    showToast('Screening pipeline initiated', 'info')
    navigate(`/verify/${created.case_id}`)
  }

  const runDemo = async (index: number) => {
    const created = await submitManual.mutateAsync(DEMO_CASES[index].documents)
    showToast(`Staged demo dossier: ${DEMO_CASES[index].label}`, 'success')
    navigate(`/verify/${created.case_id}`)
  }

  const reset = () => {
    setFile(null)
    setPreviewUrl(null)
    navigate('/verify')
    showToast('Ready for next document screening', 'info')
  }

  const copyCaseId = () => {
    if (caseId) {
      navigator.clipboard.writeText(caseId)
      showToast('Case reference copied to clipboard', 'success')
    }
  }

  const imageUrl = record?.documents?.[0]?.image_url ?? previewUrl
  const fields = record?.documents?.[0]?.extracted_fields ?? {}

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-tight">Verify Identity Credential</h1>
          <p className="text-[13px] text-ink-muted">
            Inspect authentic documents against authoritative cryptograms and issuer signatures.
          </p>
        </div>
        {caseId ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={copyCaseId}>
              📋 Copy Reference
            </Button>
            <Button size="sm" variant="primary" onClick={reset}>
              ➕ New Document
            </Button>
          </div>
        ) : null}
      </div>

      <Stepper current={step} />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* 1 — upload */}
        <Card title="Input Credential" step={1} tricolourAccent>
          <div className="mb-3.5 flex gap-1 rounded-xl bg-canvas p-1 border border-line">
            {([
              ['file', 'Upload File', IconUpload],
              ['camera', 'Camera Scan', IconCamera],
              ['qr', 'Aadhaar QR', IconQr],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-all cursor-pointer',
                  tab === id ? 'bg-white text-brand-700 shadow-xs' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {tab === 'file' ? <DropZone onFiles={accept} disabled={busy || Boolean(caseId)} /> : null}
          {tab === 'camera' ? <CameraCapture onCapture={(f) => accept([f])} /> : null}
          {tab === 'qr' ? (
            <Note>
              <IconInfo className="h-4 w-4 shrink-0" />
              <span>
                Photograph the entire Aadhaar card. The system decodes the Secure QR image and compares it with OCR field extractions simultaneously.
              </span>
            </Note>
          ) : null}

          {file ? (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-canvas p-2.5 text-[12px] border border-line">
              <span className="truncate font-medium text-ink">📄 {file.name}</span>
              <span className="font-mono text-ink-muted text-[11px]">{humanSize(file.size)}</span>
            </div>
          ) : null}

          <p className="label mt-4">Document Category</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DOC_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                disabled={Boolean(caseId)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 disabled:opacity-60 cursor-pointer',
                  docType === type
                    ? 'border-brand-600 bg-brand-50 text-brand-800 shadow-xs'
                    : 'border-line bg-white text-ink-muted hover:border-brand-300 hover:text-ink',
                )}
              >
                {DOC_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {caseId ? (
              <Button variant="secondary" onClick={reset} className="flex-1">
                New Verification
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={!file || busy} className="flex-1 shadow-sm">
                {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
                <span>Start Forensic Screening</span>
              </Button>
            )}
          </div>

          {submit.isError ? (
            <p className="mt-2 rounded-lg bg-reject-bg p-2 text-[12px] font-semibold text-reject-dark">
              {(submit.error as Error).message}
            </p>
          ) : null}

          {!caseId ? (
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <span className="label flex items-center gap-1">
                  <IconSparkles className="h-3.5 w-3.5 text-brand-600" />
                  Instant Test Scenarios
                </span>
                <span className="text-[11px] font-semibold text-brand-700">1-click demo</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {DEMO_CASES.map((demo, index) => (
                  <button
                    key={demo.label}
                    onClick={() => runDemo(index)}
                    disabled={busy}
                    className="group flex w-full flex-col rounded-xl border border-line p-2.5 text-left transition-all hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-bold text-ink group-hover:text-brand-800">{demo.label}</span>
                      <span className="font-mono text-[11px] text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">Run →</span>
                    </div>
                    <span className="text-[11px] text-ink-muted">{demo.expectation}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* 2 — preview + extraction */}
        <Card title="Forensic Preview & OCR" step={2}>
          {imageUrl ? (
            <DocumentPreview src={imageUrl} alt="Document under examination" />
          ) : (
            <EmptyState
              title="No image staged"
              detail="Upload an image or run a demo scenario to activate forensic preview."
            />
          )}

          <p className="label mt-5">Extracted Document Data</p>
          {Object.keys(fields).length === 0 ? (
            <p className="mt-2 text-[12.5px] text-ink-muted">
              {caseId ? 'Running OCR and cryptographic parse…' : 'Awaiting document ingestion.'}
            </p>
          ) : (
            <dl className="mt-2 space-y-1">
              {Object.entries(fields)
                .filter(([name]) => name !== 'raw_text' && name !== 'aadhaar_qr')
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

        {/* 3 — result */}
        <Card
          title="Screening Verdict"
          step={3}
          action={
            record ? (
              <button
                onClick={copyCaseId}
                title="Click to copy case reference"
                className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-brand-600 transition-colors"
              >
                <IconLock className="h-3 w-3" />
                <span>{record.id.slice(0, 10)}…</span>
              </button>
            ) : null
          }
        >
          {!caseId ? (
            <EmptyState title="Awaiting document" detail="Screening verdict will generate automatically upon ingestion." />
          ) : !finished ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 rounded-xl bg-brand-50 p-3 text-[12.5px] font-semibold text-brand-800 border border-brand-200">
                <Spinner />
                <span>Screening checks in progress · {checks.length} finished</span>
              </div>
              <ul className="space-y-2">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5 rounded-lg p-1.5 hover:bg-canvas transition-colors animate-in fade-in">
                    <ResultPill result={check.result} />
                    <span className="min-w-0 flex-1 text-[12px] leading-snug font-medium text-ink-soft">
                      {check.citation}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : record?.verdict ? (
            <>
              <div
                className={cn(
                  'rounded-2xl border-2 p-5 text-center shadow-xs transition-all duration-300',
                  record.verdict === 'clear' && 'border-clear-border bg-clear-bg',
                  record.verdict === 'reject' && 'border-reject-border bg-reject-bg',
                  record.verdict === 'refer' && 'border-refer-border bg-refer-bg',
                )}
              >
                <p
                  className={cn(
                    'text-[28px] font-black tracking-tight',
                    record.verdict === 'clear' && 'text-clear-dark',
                    record.verdict === 'reject' && 'text-reject-dark',
                    record.verdict === 'refer' && 'text-refer-dark',
                  )}
                >
                  {record.verdict.toUpperCase()}
                </p>
                <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-ink-soft">{record.reason}</p>
              </div>

              <p className="label mt-4">Security Rules Checked</p>
              <ul className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5 rounded-lg p-1.5 hover:bg-canvas transition-colors">
                    <ResultPill result={check.result} />
                    <div className="min-w-0 flex-1">
                      <span className="block font-mono text-[10.5px] text-ink-muted">{check.check_id}</span>
                      <span className="block text-[12px] font-medium text-ink-soft">{check.citation}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3.5">
                <Button size="sm" onClick={() => navigate(`/cases/${record.id}`)}>
                  Full Case Dossier →
                </Button>
                <Button size="sm" variant="secondary" onClick={reset}>
                  New Scan
                </Button>
              </div>
            </>
          ) : (
            <Note tone="warn">
              <IconInfo className="h-4 w-4 shrink-0" />
              <span>
                Screening did not reach decisive verdict: {record?.error ?? 'Service timeout'}.
              </span>
            </Note>
          )}
        </Card>
      </div>

      {record?.verdict ? (
        <div className="flex items-center gap-2 rounded-xl bg-white p-3.5 border border-line text-[12.5px] text-ink-muted shadow-xs">
          <VerdictPill verdict={record.verdict} />
          <span>Complete court-admissible evidence dossier is linked to this case file.</span>
        </div>
      ) : null}
    </div>
  )
}
