import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useFaceStatus } from '@/api/hooks'
import { DropZone } from '@/components/upload/DropZone'
import { CameraCapture } from '@/components/upload/CameraCapture'
import { Button, Card, EmptyState, Note, Row, Spinner } from '@/components/common/Primitives'
import { ScoreRing } from '@/components/charts/Charts'
import { VerdictPill } from '@/components/common/Badge'
import { IconAlert, IconLink, IconSearch, IconShield } from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType, type FaceSearchResult } from '@/api/types'
import { formatTimestamp } from '@/lib/format'
import { humanSize } from '@/lib/utils'

export function FaceSearchPage() {
  const { data: status } = useFaceStatus()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [threshold, setThreshold] = useState(0.7)

  const search = useMutation<FaceSearchResult, Error, { file: File; threshold: number }>({
    mutationFn: ({ file: f, threshold: t }) => api.faceSearch(f, t),
  })

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const accept = useCallback((files: File[]) => {
    const next = files[0]
    if (!next) return
    setFile(next)
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(next)
    })
    search.reset()
  }, [search])

  const result = search.data

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">Biometric Face Search & De-Duplication</h1>
        <p className="text-[13px] text-ink-muted">
          Compare 512D face embeddings across previous encounters to intercept multiple identities presented by one subject.
        </p>
      </div>

      <Note>
        <IconShield className="h-4 w-4 shrink-0 text-brand-600" />
        <span>
          Search runs entirely on local, zero-leakage <strong>512-dimensional vector embeddings</strong>. Raw biometric facial images never leave this deployment boundary, complying with DPDP 2023 regulations.
        </span>
      </Note>

      {status && !status.available ? (
        <Note tone="warn">
          <IconAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>Face comparison engine offline:</strong> Requires <code className="font-mono">{status.requirement}</code>. Install dependencies to enable biometric screening.
          </span>
        </Note>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-5">
          <Card title="Query Subject Photograph" step={1} tricolourAccent>
            <DropZone onFiles={accept} disabled={!status?.available} />
            <div className="mt-3">
              <CameraCapture onCapture={(f) => accept([f])} />
            </div>
            {file ? (
              <div className="mt-2.5 rounded-lg bg-canvas p-2.5 text-[12px] border border-line">
                <p className="truncate font-semibold text-ink">👤 {file.name}</p>
                <p className="text-[11px] text-ink-muted font-mono">{humanSize(file.size)}</p>
              </div>
            ) : null}
          </Card>

          <Card title="Embedding Match Sensitivity" step={2}>
            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="label">Similarity Threshold</span>
                <span className="font-mono text-[13px] font-bold text-brand-700">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={0.95}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-2.5 w-full accent-brand-600 cursor-pointer"
              />
            </label>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
              Higher thresholds demand closer biometric matches. Embeddings scoring between 0.60 and 0.85 are marked <strong>Inconclusive</strong> for expert forensic review.
            </p>

            <Button
              className="mt-4 w-full shadow-xs"
              disabled={!file || !status?.available || search.isPending}
              onClick={() => file && search.mutate({ file, threshold })}
            >
              {search.isPending ? <Spinner className="border-white/40 border-t-white" /> : <IconSearch className="h-4 w-4" />}
              <span>Execute Biometric Search</span>
            </Button>
            {search.isError ? (
              <p className="mt-2 rounded-lg bg-reject-bg p-2 text-[12px] font-semibold text-reject-dark">
                {search.error.message}
              </p>
            ) : null}
          </Card>

          <Card title="Biometric Gallery Roster">
            <dl className="space-y-1.5 text-[12.5px]">
              <Row label="Stored Embeddings" value={<span className="font-mono">{status?.encounters_stored ?? '—'}</span>} />
              <Row label="Unique Identities" value={<span className="font-mono">{status?.distinct_document_numbers ?? '—'}</span>} />
            </dl>
          </Card>
        </div>

        <div className="space-y-5">
          {previewUrl ? (
            <Card title="Subject Query Crop">
              <div className="flex flex-wrap gap-5">
                <div className="relative h-44 w-44 overflow-hidden rounded-xl border-2 border-brand-500 shadow-md">
                  <img
                    src={previewUrl}
                    alt="Query facial subject"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 border border-brand-400/40" />
                </div>
                <dl className="min-w-[200px] flex-1 space-y-1.5">
                  <Row label="Source Filename" value={file?.name ?? '—'} />
                  <Row label="Payload Size" value={file ? humanSize(file.size) : '—'} />
                  {result ? (
                    <>
                      <Row label="Segmented Resolution" value={`${result.face.pixels} px`} />
                      <Row label="Confidence" value={<span className="font-mono text-clear font-bold">{result.face.detection_score.toFixed(3)}</span>} />
                    </>
                  ) : null}
                </dl>
              </div>
            </Card>
          ) : null}

          <Card
            title={result ? `Matched Candidate Gallery (${result.matches.length})` : 'Matched Candidate Gallery'}
            step={3}
          >
            {!result ? (
              <EmptyState
                title="Awaiting face query"
                detail="Upload or photograph a subject's face to trigger nearest-neighbour vector matching."
              />
            ) : result.matches.length === 0 ? (
              <EmptyState
                title="No prior biometric matches located"
                detail={`No gallery records matched above cosine similarity ${result.threshold.toFixed(2)}. The person may be presenting for the first time.`}
              />
            ) : (
              <div className="space-y-4">
                {result.multiple_identity ? (
                  <Note tone="warn">
                    <IconLink className="h-5 w-5 shrink-0 text-reject" />
                    <span>
                      <strong>CRITICAL ALERT: Multi-Identity Impersonation Suspected.</strong> This exact facial embedding has been registered under disparate document numbers:{' '}
                      <span className="font-mono font-bold text-reject-dark">{result.distinct_document_numbers.join(', ')}</span>.
                    </span>
                  </Note>
                ) : null}

                <ul className="divide-y divide-line">
                  {result.matches.map((match, index) => (
                    <li key={match.encounter_id} className="flex flex-wrap items-center gap-4 py-3.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-[12.5px] font-bold text-brand-700 border border-brand-200">
                        #{index + 1}
                      </span>
                      <dl className="min-w-[200px] flex-1 space-y-1">
                        <Row label="Associated Name" value={match.name ?? 'Unknown Record'} />
                        <Row
                          label="Credential"
                          value={
                            match.doc_type
                              ? (DOC_TYPE_LABELS[match.doc_type as DocType] ?? match.doc_type)
                              : '—'
                          }
                        />
                        <Row
                          label="ID Number"
                          value={<span className="font-mono text-[12px] font-bold text-ink">{match.doc_number ?? '—'}</span>}
                        />
                        <Row label="Date Encountered" value={formatTimestamp(match.captured_at)} />
                      </dl>
                      <ScoreRing score={match.similarity} label="Cosine Match" />
                      <div className="flex flex-col items-end gap-2">
                        {match.verdict ? <VerdictPill verdict={match.verdict} /> : null}
                        <Link
                          to={`/cases/${match.case_id}`}
                          className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 shadow-xs hover:bg-brand-50 hover:border-brand-300 transition"
                        >
                          View Linked Case →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
