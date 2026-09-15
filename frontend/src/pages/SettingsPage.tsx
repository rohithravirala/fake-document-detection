import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { keys, useProfiles, useSettings } from '@/api/hooks'
import { Button, Card, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconAlert, IconCheck, IconInfo, IconShield } from '@/components/common/Icons'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'verification', label: 'Verification profiles' },
  { id: 'modules', label: 'Modules' },
  { id: 'integrity', label: 'Integrity' },
  { id: 'gaps', label: 'Not built' },
] as const

type Tab = (typeof TABS)[number]['id']

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general')
  const { data: settings, isLoading } = useSettings()
  const { data: profiles } = useProfiles()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: ({ docType, profile }: { docType: string; profile: Record<string, unknown> }) =>
      api.updateProfile(docType, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.profiles })
      setEditing(null)
    },
  })

  if (isLoading || !settings) return <Spinner />

  const active = profiles?.find((p) => p.doc_type === editing)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-ink">Settings</h1>
        <p className="text-[13px] text-ink-muted">
          Configuration as it actually is in this deployment.
        </p>
      </div>

      <div className="card flex flex-wrap gap-1 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors',
              tab === t.id ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Organisation">
            <dl>
              <Row label="Organisation" value={settings.organisation.name} />
              <Row label="System" value={settings.organisation.system} />
              <Row label="Problem statement" value={settings.organisation.problem_statement} />
              <Row label="Environment" value={<span className="font-mono">{settings.organisation.environment}</span>} />
            </dl>
          </Card>

          <Card title="Storage and execution">
            <dl>
              <Row label="Database" value={<span className="font-mono">{settings.storage.backend}</span>} />
              <Row label="Screening" value={<span className="font-mono">{settings.storage.execution}</span>} />
              <Row label="Uploads" value={<span className="break-all font-mono text-[11.5px]">{settings.storage.upload_dir}</span>} />
              <Row label="Models" value={<span className="break-all font-mono text-[11.5px]">{settings.storage.model_dir}</span>} />
              <Row label="Max upload" value={`${settings.storage.max_upload_mb} MB`} />
            </dl>
            <div className="mt-3">
              <Note>
                <IconInfo className="h-4 w-4 shrink-0" />
                <span>
                  These come from environment variables, not from this screen. Changing them is a
                  deployment action so that a screening can always be traced to a known
                  configuration.
                </span>
              </Note>
            </div>
          </Card>

          <Card title="Face comparison bands" className="lg:col-span-2">
            <dl className="grid gap-x-8 sm:grid-cols-3">
              <Row label="Match at or above" value={settings.verification.face_match_threshold} />
              <Row label="No match at or below" value={settings.verification.face_no_match_threshold} />
              <Row label="Minimum face size" value={`${settings.verification.face_min_pixels} px`} />
            </dl>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
              The gap between the two thresholds is deliberate: anything inside it is reported as{' '}
              <strong>inconclusive</strong> and sent to a human. Document photographs are small and
              often years old, and forcing a binary answer out of that produces confident errors.
            </p>
            <p className="mt-2 text-[12.5px] text-ink-muted">{settings.verification.note}</p>
          </Card>
        </div>
      ) : null}

      {tab === 'verification' ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-1.5">
            {profiles?.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  setEditing(profile.doc_type)
                  setDraft(JSON.stringify(profile.profile, null, 2))
                  setParseError(null)
                }}
                className={cn(
                  'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
                  editing === profile.doc_type
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-line bg-white hover:border-brand-300',
                )}
              >
                <span className="block text-[13px] font-semibold">
                  {DOC_TYPE_LABELS[profile.doc_type as DocType] ?? profile.doc_type}
                </span>
                <span
                  className={cn(
                    'block text-[11.5px]',
                    editing === profile.doc_type ? 'text-white/70' : 'text-ink-faint',
                  )}
                >
                  version {profile.version} · {formatTimestamp(profile.updated_at)}
                </span>
              </button>
            ))}
          </div>

          <Card title={active ? `${DOC_TYPE_LABELS[active.doc_type as DocType] ?? active.doc_type} · version ${active.version}` : 'Choose a document type'}>
            {!active ? (
              <p className="text-[13px] text-ink-muted">
                Document rules live here as data — quality thresholds, required fields, face bands,
                which checks apply. Adding a document type is an edit on this screen, not a code
                change and not a deployment.
              </p>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setParseError(null) }}
                  spellCheck={false}
                  rows={20}
                  className="w-full rounded-md border border-line-strong p-3 font-mono text-[12px] leading-relaxed"
                />
                {parseError ? <p className="mt-2 text-[12.5px] text-reject">{parseError}</p> : null}
                {save.isError ? (
                  <p className="mt-2 text-[12.5px] text-reject">{(save.error as Error).message}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    disabled={save.isPending}
                    onClick={() => {
                      try {
                        save.mutate({ docType: active.doc_type, profile: JSON.parse(draft) })
                      } catch (cause) {
                        setParseError(`That is not valid JSON: ${(cause as Error).message}`)
                      }
                    }}
                  >
                    Publish new version
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                  <span className="text-[11.5px] text-ink-faint">
                    The previous version is deactivated, never overwritten — a past screening can
                    always be traced to the rules in force when it ran.
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'modules' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Verification modules">
            <ul className="space-y-2">
              {Object.entries(settings.modules).map(([name, ok]) => (
                <li key={name} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
                  {ok ? <IconCheck className="h-4 w-4 text-clear" /> : <IconInfo className="h-4 w-4 text-ink-faint" />}
                  <span className="flex-1 capitalize text-[13px]">{name}</span>
                  <span className="text-[12px] text-ink-muted">{ok ? 'available' : 'not installed'}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Note>
                <IconShield className="h-4 w-4 shrink-0" />
                <span>
                  A module that cannot run reports <strong>could not run</strong>, which sends the
                  case to an examiner. It never becomes a rejection — a missing model is not a
                  forgery.
                </span>
              </Note>
            </div>
          </Card>

          <Card title="Text recognition and certificates">
            <ul className="space-y-2">
              {Object.entries(settings.ocr_engines).map(([name, ok]) => (
                <li key={name} className="flex items-center gap-2.5 border-b border-line py-2">
                  {ok ? <IconCheck className="h-4 w-4 text-clear" /> : <IconInfo className="h-4 w-4 text-ink-faint" />}
                  <span className="flex-1 capitalize text-[13px]">{name}</span>
                  <span className="text-[12px] text-ink-muted">{ok ? 'installed' : 'not installed'}</span>
                </li>
              ))}
              <li className="flex items-center gap-2.5 py-2">
                {settings.aadhaar_certificate ? (
                  <IconCheck className="h-4 w-4 text-clear" />
                ) : (
                  <IconAlert className="h-4 w-4 text-refer" />
                )}
                <span className="flex-1 text-[13px]">UIDAI certificate</span>
                <span className="text-[12px] text-ink-muted">
                  {settings.aadhaar_certificate ? 'provisioned' : 'missing'}
                </span>
              </li>
            </ul>
            {!settings.aadhaar_certificate ? (
              <div className="mt-3">
                <Note tone="warn">
                  <IconAlert className="h-4 w-4 shrink-0" />
                  <span>
                    Without the UIDAI certificate, Aadhaar signature checks report{' '}
                    <strong>could not run</strong> — never <strong>failed</strong>. Place it in{' '}
                    <code className="font-mono">modules/aadhaar/certs/</code>.
                  </span>
                </Note>
              </div>
            ) : null}
            <dl className="mt-3 border-t border-line pt-3">
              <Row
                label="Offline"
                value={settings.offline_capable ? 'decisive checks need no network' : 'no'}
              />
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === 'integrity' ? (
        <Card title="Audit chain">
          <div
            className={cn(
              'rounded-md border-2 px-4 py-3',
              settings.audit.intact ? 'border-clear-border bg-clear-bg' : 'border-reject-border bg-reject-bg',
            )}
          >
            <p className={cn('text-[14px] font-semibold', settings.audit.intact ? 'text-clear' : 'text-reject')}>
              {settings.audit.intact ? 'Chain intact' : 'Chain broken'}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-soft">
              {settings.audit.records} records verify against one another.
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-ink-faint">
              head {settings.audit.head_hash}
            </p>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
            Each record hashes its own payload together with the previous record&apos;s hash. Altering
            any past record breaks every link after it, which the check above detects and names.
          </p>
          <div className="mt-3">
            <Note>
              <IconInfo className="h-4 w-4 shrink-0" />
              <span>
                A hash chain does not give <em>distributed</em> trust: an administrator with write
                access to the whole table could recompute it. Closing that needs an external anchor
                — publishing the head hash somewhere append-only — which is a deployment decision.
              </span>
            </Note>
          </div>
        </Card>
      ) : null}

      {tab === 'gaps' ? (
        <Card title="In the design, not in the build">
          <p className="text-[13px] text-ink-muted">
            A settings screen whose toggles do nothing is worse than one that is missing them: it
            tells an operator a control exists. These are listed rather than rendered.
          </p>
          <ul className="mt-4 space-y-2">
            {settings.not_implemented.map((item) => (
              <li key={item} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
                <IconInfo className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="flex-1 text-[13px] capitalize text-ink-soft">{item}</span>
                <span className="rounded bg-refer-bg px-1.5 py-[1px] text-[11px] font-medium text-refer">
                  not built
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
            The screening logic was the project, and these were the trade. Each is a bounded piece
            of work rather than an architectural change — the audit log already carries an officer
            id, and profiles are already versioned.
          </p>
        </Card>
      ) : null}
    </div>
  )
}
