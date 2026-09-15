import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DropZone } from '@/components/upload/DropZone'
import { CameraCapture } from '@/components/upload/CameraCapture'
import { DocumentPreview } from '@/components/upload/DocumentPreview'
import { Button, Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { ResultPill, VerdictPill } from '@/components/common/Badge'
import { IconCamera, IconCheck, IconInfo, IconQr, IconUpload } from '@/components/common/Icons'
import { useCase, useScreeningStream, useSubmit, useSubmitManual } from '@/api/hooks'
import { DOC_TYPES, DOC_TYPE_LABELS, type Check, type DocType, type StreamEvent } from '@/api/types'
import { fieldLabel, formatDuration } from '@/lib/format'
import { guessDocType, humanSize } from '@/lib/utils'
import { DEMO_CASES } from '@/mocks/demo'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: 'Upload', detail: 'Provide document' },
  { n: 2, label: 'Process', detail: 'Read and classify' },
  { n: 3, label: 'Verify', detail: 'Check against source of truth' },
  { n: 4, label: 'Result', detail: 'Verdict and evidence' },
]

function Stepper({ current }: { current: number }) {
  return (
    <ol className="card flex flex-wrap items-center gap-y-3 px-5 py-4">
      {STEPS.map((step, index) => {
        const state = current > step.n ? 'done' : current === step.n ? 'active' : 'todo'
        return (
          <li key={step.n} className="flex min-w-[140px] flex-1 items-center gap-3">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold',
                state === 'done' && 'bg-clear text-white',
                state === 'active' && 'bg-brand-600 text-white',
                state === 'todo' && 'bg-canvas text-ink-faint ring-1 ring-line-strong',
              )}
            >
              {state === 'done' ? <IconCheck className="h-4 w-4" /> : step.n}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-[13px] font-semibold',
                  state === 'todo' ? 'text-ink-faint' : 'text-ink',
                )}
              >
                {step.label}
              </span>
              <span className="block truncate text-[11.5px] text-ink-muted">{step.detail}</span>
            </span>
            {index < STEPS.length - 1 ? (
              <span
                className={cn(
                  'ml-auto hidden h-[2px] min-w-[24px] flex-1 rounded lg:block',
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
    navigate(`/verify/${created.case_id}`)
  }

  const runDemo = async (index: number) => {
    const created = await submitManual.mutateAsync(DEMO_CASES[index].documents)
    navigate(`/verify/${created.case_id}`)
  }

  const reset = () => {
    setFile(null)
    setPreviewUrl(null)
    navigate('/verify')
  }

  const imageUrl = record?.documents?.[0]?.image_url ?? previewUrl
  const fields = record?.documents?.[0]?.extracted_fields ?? {}

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">Verify Document</h1>
        <p className="text-[13px] text-ink-muted">
          Upload or capture a document to start verification.
        </p>
      </div>

      <Stepper current={step} />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 1 — upload */}
        <Card title="Upload document" step={1}>
          <div className="mb-3 flex gap-1 rounded-md bg-canvas p-1">
            {([
              ['file', 'Upload file', IconUpload],
              ['camera', 'Camera', IconCamera],
              ['qr', 'Scan QR', IconQr],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12.5px] font-medium transition-colors',
                  tab === id ? 'bg-white text-brand-700 shadow-card' : 'text-ink-muted hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" />
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
                There is no separate QR scanner. Photograph the whole card instead — the Aadhaar
                Secure QR is decoded from that image, and the printed text beside it is what the
                signed data gets compared against.
              </span>
            </Note>
          ) : null}

          {file ? (
            <p className="mt-2 truncate text-[12px] text-ink-muted">
              {file.name} · {humanSize(file.size)}
            </p>
          ) : null}

          <p className="label mt-4">Document type</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DOC_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                disabled={Boolean(caseId)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-60',
                  docType === type
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-line-strong bg-white text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {DOC_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            {caseId ? (
              <Button variant="secondary" onClick={reset} className="flex-1">
                New verification
              </Button>
            ) : (
              <Button onClick={onSubmit} disabled={!file || busy} className="flex-1">
                {busy ? <Spinner className="border-white/40 border-t-white" /> : null}
                Start verification
              </Button>
            )}
          </div>

          {submit.isError ? (
            <p className="mt-2 text-[12.5px] text-reject">{(submit.error as Error).message}</p>
          ) : null}

          {!caseId ? (
            <div className="mt-4 border-t border-line pt-4">
              <p className="label">Run without an image</p>
              <p className="mt-1 text-[12px] text-ink-muted">
                These drive the real checks with known values and need no OCR engine.
              </p>
              <div className="mt-2 grid gap-1.5">
                {DEMO_CASES.map((demo, index) => (
                  <button
                    key={demo.label}
                    onClick={() => runDemo(index)}
                    disabled={busy}
                    className="rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <span className="block text-[12.5px] font-medium text-ink">{demo.label}</span>
                    <span className="block text-[11.5px] text-ink-muted">{demo.expectation}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {/* 2 — preview + extraction */}
        <Card title="Document preview" step={2}>
          {imageUrl ? (
            <DocumentPreview src={imageUrl} alt="The document being screened" />
          ) : (
            <EmptyState
              title="No image"
              detail="Field-value runs have no image. The checks are identical."
            />
          )}

          <p className="label mt-5">Extracted information</p>
          {Object.keys(fields).length === 0 ? (
            <p className="mt-2 text-[12.5px] text-ink-muted">
              {caseId ? 'Reading the document…' : 'Nothing read yet.'}
            </p>
          ) : (
            <dl className="mt-1">
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
          {Object.keys(fields).length > 0 ? (
            <p className="mt-3 text-[11.5px] text-ink-faint">
              These are the values read off the document. Where a signed source states something
              different, the check below names both.
            </p>
          ) : null}
        </Card>

        {/* 3 — result */}
        <Card
          title="Verification result"
          step={3}
          action={
            record ? (
              <span className="font-mono text-[11px] text-ink-faint">{record.id.slice(0, 12)}…</span>
            ) : null
          }
        >
          {!caseId ? (
            <EmptyState title="Waiting for a document" detail="The verdict appears here." />
          ) : !finished ? (
            <>
              <div className="flex items-center gap-2 text-[13px] text-ink-muted">
                <Spinner /> Screening · {checks.length} check{checks.length === 1 ? '' : 's'} so far
              </div>
              <ul className="mt-3 space-y-1.5">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5">
                    <ResultPill result={check.result} />
                    <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink-soft">
                      {check.citation}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11.5px] text-ink-faint">
                No verdict is shown until every check has finished. A partly screened document has
                no verdict, not a provisional one.
              </p>
            </>
          ) : record?.verdict ? (
            <>
              <div
                className={cn(
                  'rounded-lg border-2 p-4 text-center',
                  record.verdict === 'clear' && 'border-clear-border bg-clear-bg',
                  record.verdict === 'reject' && 'border-reject-border bg-reject-bg',
                  record.verdict === 'refer' && 'border-refer-border bg-refer-bg',
                )}
              >
                <p
                  className={cn(
                    'text-[28px] font-bold leading-none',
                    record.verdict === 'clear' && 'text-clear',
                    record.verdict === 'reject' && 'text-reject',
                    record.verdict === 'refer' && 'text-refer',
                  )}
                >
                  {record.verdict.toUpperCase()}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{record.reason}</p>
              </div>

              <p className="label mt-4">Verification checks</p>
              <ul className="mt-1.5 space-y-1.5">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2.5">
                    <ResultPill result={check.result} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11.5px] text-ink-muted">
                        {check.check_id}
                      </span>
                      <span className="block text-[12.5px] leading-snug text-ink-soft">
                        {check.citation}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button size="sm" onClick={() => navigate(`/cases/${record.id}`)}>
                  View evidence
                </Button>
                <Button size="sm" variant="secondary" onClick={reset}>
                  New verification
                </Button>
                <span className="ml-auto self-center text-[11.5px] text-ink-faint">
                  {formatDuration(record.duration_ms)}
                </span>
              </div>
            </>
          ) : (
            <Note tone="warn">
              <IconInfo className="h-4 w-4 shrink-0" />
              <span>
                The screening did not complete: {record?.error ?? 'unknown error'}. No verdict has
                been produced — do not treat this as either a pass or a rejection.
              </span>
            </Note>
          )}
        </Card>
      </div>

      {record?.verdict ? (
        <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          <VerdictPill verdict={record.verdict} />
          Full evidence, cropped from the document itself, is on the case page.
        </div>
      ) : null}
    </div>
  )
}
