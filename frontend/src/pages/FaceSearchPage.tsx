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
import { IconAlert, IconInfo, IconLink, IconSearch } from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType, type FaceSearchResult } from '@/api/types'
import { formatTimestamp } from '@/lib/format'
import { humanSize } from '@/lib/utils'

/**
 * Searching prior screenings for the same face.
 *
 * This is the check document verification cannot reach on its own: a genuine
 * card in the hands of someone already screened under a different number.
 */
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
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">Face Search</h1>
        <p className="text-[13px] text-ink-muted">
          Search stored screenings for a matching face, to detect one person presenting several
          identities.
        </p>
      </div>

      <Note>
        <IconInfo className="h-4 w-4 shrink-0" />
        <span>
          The search runs over <strong>512-dimensional embeddings</strong>, never photographs. No
          face image is stored, the model runs on this machine, and nothing biometric leaves the
          deployment boundary — so a result names the case it came from, not a face.
        </span>
      </Note>

      {status && !status.available ? (
        <Note tone="warn">
          <IconAlert className="h-4 w-4 shrink-0" />
          <span>
            <strong>Face search is not available in this deployment.</strong> It needs{' '}
            <code className="font-mono">{status.requirement}</code>. Until it is installed this
            page cannot search — and the absence of results must not be read as the absence of a
            match.
          </span>
        </Note>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <Card title="Upload or capture a face" step={1}>
            <DropZone onFiles={accept} disabled={!status?.available} />
            <div className="mt-3">
              <CameraCapture onCapture={(f) => accept([f])} />
            </div>
            {file ? (
              <p className="mt-2 truncate text-[12px] text-ink-muted">
                {file.name} · {humanSize(file.size)}
              </p>
            ) : null}
          </Card>

          <Card title="Search configuration" step={2}>
            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="label">Match threshold</span>
                <span className="tnum font-mono text-[13px] text-ink">{threshold.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0.4}
                max={0.95}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="mt-2 w-full accent-brand-600"
              />
            </label>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              A higher threshold returns fewer, stronger matches. Screening itself treats anything
              between 0.60 and 0.85 as <strong>inconclusive</strong> rather than forcing a yes or
              no — document photographs are small and often old, and a confident wrong answer about
              identity is the worst output this system could give.
            </p>

            <Button
              className="mt-4 w-full"
              disabled={!file || !status?.available || search.isPending}
              onClick={() => file && search.mutate({ file, threshold })}
            >
              {search.isPending ? <Spinner className="border-white/40 border-t-white" /> : <IconSearch className="h-4 w-4" />}
              Search faces
            </Button>
            {search.isError ? (
              <p className="mt-2 text-[12.5px] text-reject">{search.error.message}</p>
            ) : null}
          </Card>

          <Card title="Stored encounters">
            <dl>
              <Row label="Embeddings" value={status?.encounters_stored ?? '—'} />
              <Row label="Distinct numbers" value={status?.distinct_document_numbers ?? '—'} />
            </dl>
          </Card>
        </div>

        <div className="space-y-4">
          {previewUrl ? (
            <Card title="Search preview">
              <div className="flex flex-wrap gap-5">
                <img
                  src={previewUrl}
                  alt="The face being searched for"
                  className="h-40 w-40 rounded-md border border-line object-cover"
                />
                <dl className="min-w-[180px] flex-1">
                  <Row label="File" value={file?.name ?? '—'} />
                  <Row label="Size" value={file ? humanSize(file.size) : '—'} />
                  {result ? (
                    <>
                      <Row label="Face size" value={`${result.face.pixels} px`} />
                      <Row label="Detection" value={result.face.detection_score.toFixed(3)} />
                    </>
                  ) : null}
                </dl>
              </div>
            </Card>
          ) : null}

          <Card
            title={result ? `Search results (${result.matches.length})` : 'Search results'}
            step={3}
          >
            {!result ? (
              <EmptyState
                title="No search run yet"
                detail="Upload a face and search to compare it against every prior screening."
              />
            ) : result.matches.length === 0 ? (
              <EmptyState
                title="No prior screening matched"
                detail={`Nothing above a similarity of ${result.threshold.toFixed(2)}. That is not proof this person has not been screened before — only that no stored embedding is that close.`}
              />
            ) : (
              <>
                {result.multiple_identity ? (
                  <div className="mb-4">
                    <Note tone="warn">
                      <IconLink className="h-4 w-4 shrink-0" />
                      <span>
                        <strong>This face appears under more than one document number:</strong>{' '}
                        {result.distinct_document_numbers.join(', ')}. Document verification cannot
                        find this — only comparing across screenings can.
                      </span>
                    </Note>
                  </div>
                ) : null}

                <ul className="divide-y divide-line">
                  {result.matches.map((match, index) => (
                    <li key={match.encounter_id} className="flex flex-wrap items-center gap-4 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-[12px] font-semibold text-ink-muted">
                        {index + 1}
                      </span>
                      <dl className="min-w-[180px] flex-1">
                        <Row label="Name" value={match.name ?? '—'} />
                        <Row
                          label="Document"
                          value={
                            match.doc_type
                              ? (DOC_TYPE_LABELS[match.doc_type as DocType] ?? match.doc_type)
                              : '—'
                          }
                        />
                        <Row
                          label="Number"
                          value={<span className="font-mono text-[12px]">{match.doc_number ?? '—'}</span>}
                        />
                        <Row label="Screened" value={formatTimestamp(match.captured_at)} />
                      </dl>
                      <ScoreRing score={match.similarity} label="similarity" />
                      <div className="flex flex-col items-end gap-2">
                        {match.verdict ? <VerdictPill verdict={match.verdict} /> : null}
                        <Link
                          to={`/cases/${match.case_id}`}
                          className="text-[12.5px] font-medium text-brand-700 hover:underline"
                        >
                          View case
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
