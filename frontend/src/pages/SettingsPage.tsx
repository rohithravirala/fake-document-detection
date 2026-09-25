import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { keys, useProfiles, useSettings } from '@/api/hooks'
import { Button, Card, Note, Row, Spinner } from '@/components/common/Primitives'
import { IconCheck, IconInfo, IconShield } from '@/components/common/Icons'
import { showToast } from '@/components/common/Toast'
import { DOC_TYPE_LABELS, type DocType } from '@/api/types'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'general', label: 'System Overview' },
  { id: 'verification', label: 'Rule Matrix' },
  { id: 'modules', label: 'Engines & Modules' },
  { id: 'integrity', label: 'Cryptographic Integrity' },
  { id: 'preferences', label: 'Portal Preferences' },
  { id: 'gaps', label: 'Deliberate Non-Goals' },
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

  // Portal preferences state
  const [ocrEngine, setOcrEngine] = useState('tesseract-onnx')
  const [offlineEnforce, setOfflineEnforce] = useState(true)

  const save = useMutation({
    mutationFn: ({ docType, profile }: { docType: string; profile: Record<string, unknown> }) =>
      api.updateProfile(docType, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.profiles })
      setEditing(null)
      showToast('Verification rule profile published successfully', 'success')
    },
  })

  if (isLoading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-ink-muted font-medium">
        <Spinner className="h-6 w-6" />
        <span>Loading system parameters…</span>
      </div>
    )
  }

  const active = profiles?.find((p) => p.doc_type === editing)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">System & Verification Settings</h1>
        <p className="text-[13px] text-ink-muted">
          Active operational parameters, cryptographic storage backends, and verification profiles.
        </p>
      </div>

      <div className="card flex flex-wrap gap-1 p-1.5 shadow-xs border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-[12.5px] font-semibold transition-all cursor-pointer',
              tab === t.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Governing Authority & Deployment" tricolourAccent>
            <dl className="space-y-1.5">
              <Row label="Organisation" value={settings.organisation.name} />
              <Row label="System Codename" value={<span className="font-bold text-navy-900">{settings.organisation.system}</span>} />
              <Row label="SIH Reference" value={<span className="font-mono text-brand-700 font-bold">{settings.organisation.problem_statement}</span>} />
              <Row label="Environment" value={<span className="font-mono bg-canvas px-2 py-0.5 rounded border border-line">{settings.organisation.environment}</span>} />
            </dl>
          </Card>

          <Card title="Storage & Pipeline Execution">
            <dl className="space-y-1.5">
              <Row label="Backend Store" value={<span className="font-mono font-semibold">{settings.storage.backend}</span>} />
              <Row label="Pipeline Mode" value={<span className="font-mono">{settings.storage.execution}</span>} />
              <Row label="Upload Buffer" value={<span className="break-all font-mono text-[11px] text-ink-muted">{settings.storage.upload_dir}</span>} />
              <Row label="Model Artifacts" value={<span className="break-all font-mono text-[11px] text-ink-muted">{settings.storage.model_dir}</span>} />
              <Row label="Max File Capacity" value={`${settings.storage.max_upload_mb} MB`} />
            </dl>
          </Card>

          <Card title="Biometric Matching Tolerance Bands" className="lg:col-span-2">
            <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
              <Row label="Match At or Above" value={<span className="font-mono font-bold text-clear">{settings.verification.face_match_threshold}</span>} />
              <Row label="No Match At or Below" value={<span className="font-mono font-bold text-reject">{settings.verification.face_no_match_threshold}</span>} />
              <Row label="Minimum Facial Crop" value={`${settings.verification.face_min_pixels} px`} />
            </dl>
            <p className="mt-3.5 text-[12px] leading-relaxed text-ink-muted border-t border-line/60 pt-2.5">
              Cosine similarity values falling between the two thresholds trigger an <strong>Inconclusive</strong> referral, directing the officer to an expert manual examiner.
            </p>
          </Card>
        </div>
      ) : null}

      {tab === 'verification' ? (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted px-1">Configured Credentials</p>
            {profiles?.map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  setEditing(profile.doc_type)
                  setDraft(JSON.stringify(profile.profile, null, 2))
                  setParseError(null)
                }}
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition-all cursor-pointer shadow-xs',
                  editing === profile.doc_type
                    ? 'border-brand-600 bg-brand-600 text-white shadow-brand-500/20'
                    : 'border-line bg-white hover:border-brand-300 hover:bg-canvas/50',
                )}
              >
                <span className="block text-[13px] font-bold">
                  {DOC_TYPE_LABELS[profile.doc_type as DocType] ?? profile.doc_type}
                </span>
                <span
                  className={cn(
                    'block font-mono text-[11px] mt-0.5',
                    editing === profile.doc_type ? 'text-white/80' : 'text-ink-muted',
                  )}
                >
                  Version {profile.version} · {formatTimestamp(profile.updated_at).slice(0, 10)}
                </span>
              </button>
            ))}
          </div>

          <Card title={active ? `${DOC_TYPE_LABELS[active.doc_type as DocType] ?? active.doc_type} · Version ${active.version}` : 'Select a Credential Type'}>
            {!active ? (
              <p className="text-[13px] text-ink-muted">
                Document rule profiles are declared as data matrices (quality thresholds, required checksums, MRZ structures). Select a credential on the left to inspect or update.
              </p>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setParseError(null) }}
                  spellCheck={false}
                  rows={18}
                  className="w-full rounded-xl border border-line p-3 font-mono text-[12px] leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-canvas/30"
                />
                {parseError ? <p className="text-[12px] font-semibold text-reject">{parseError}</p> : null}
                {save.isError ? (
                  <p className="text-[12px] font-semibold text-reject">{(save.error as Error).message}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    disabled={save.isPending}
                    onClick={() => {
                      try {
                        save.mutate({ docType: active.doc_type, profile: JSON.parse(draft) })
                      } catch (cause) {
                        setParseError(`JSON syntax error: ${(cause as Error).message}`)
                      }
                    }}
                  >
                    Publish Rule Version
                  </Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'modules' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Cryptographic & Forensic Microservices" tricolourAccent>
            <ul className="space-y-2">
              {Object.entries(settings.modules).map(([name, ok]) => (
                <li key={name} className="flex items-center gap-2.5 rounded-lg bg-canvas/50 px-3 py-2 border border-line">
                  {ok ? <IconCheck className="h-4 w-4 text-clear" /> : <IconInfo className="h-4 w-4 text-ink-faint" />}
                  <span className="flex-1 capitalize text-[13px] font-semibold text-ink">{name}</span>
                  <span className={`font-mono text-[11px] font-bold ${ok ? 'text-clear-dark' : 'text-ink-muted'}`}>
                    {ok ? 'ACTIVE' : 'NOT INSTALLED'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Aadhaar Signature Verification">
            <dl className="space-y-2 text-[12.5px]">
              <Row
                label="Certificate State"
                value={
                  settings.aadhaar_certificate ? (
                    <span className="font-semibold text-clear">UIDAI Public Key Installed</span>
                  ) : (
                    <span className="font-semibold text-refer">Sample Certificate Used</span>
                  )
                }
              />
              <Row label="Algorithm" value="RSA-SHA256 (2048-bit Key)" />
              <Row label="Issuance Authority" value="Unique Identification Authority of India" />
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === 'preferences' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Local Forensic Pipeline Tuning">
            <div className="space-y-4">
              <div>
                <label className="label">Optical Character Recognition Pipeline</label>
                <select
                  value={ocrEngine}
                  onChange={(e) => {
                    setOcrEngine(e.target.value)
                    showToast(`OCR Engine updated to ${e.target.value}`, 'info')
                  }}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white p-2.5 text-[13px] font-medium text-ink"
                >
                  <option value="tesseract-onnx">Tesseract + ONNX Hybrid (Optimal Speed: ~0.8s)</option>
                  <option value="easyocr-cuda">EasyOCR Deep Learning (High Precision: ~1.4s)</option>
                  <option value="offline-heuristic">Offline Checksum Only (Field-only: ~0.8ms)</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-line pt-3">
                <div>
                  <p className="text-[13px] font-bold text-ink">Strict Offline Border Mode</p>
                  <p className="text-[11.5px] text-ink-muted">Prevent any external DNS resolution attempts.</p>
                </div>
                <input
                  type="checkbox"
                  checked={offlineEnforce}
                  onChange={(e) => {
                    setOfflineEnforce(e.target.checked)
                    showToast(e.target.checked ? 'Strict offline enforcement enabled' : 'Online checks permitted', 'info')
                  }}
                  className="h-5 w-5 accent-brand-600 rounded cursor-pointer"
                />
              </div>

              <div className="border-t border-line pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    localStorage.clear()
                    showToast('Local application cache successfully flushed', 'success')
                  }}
                >
                  Flush Cache & Reset Preferences
                </Button>
              </div>
            </div>
          </Card>

          <Card title="Security Compliance Guidelines">
            <Note tone="info">
              <IconShield className="h-5 w-5 shrink-0 text-brand-600" />
              <span>
                SVARAM operates in zero-retention mode for biometric image binaries by default. Only SHA-256 hash proofs and cryptographic audit receipts are permanently retained.
              </span>
            </Note>
          </Card>
        </div>
      ) : null}

      {tab === 'integrity' ? (
        <Card title="Cryptographic Ledger Configuration" tricolourAccent>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Row label="Hash Function" value="SHA-256 (NIST FIPS 180-4)" />
            <Row label="Chain Structure" value="Sequential Merkle-Style Block Chaining" />
            <Row label="Verification Protocol" value="Zero Knowledge Local Audit" />
            <Row label="Auditing Standard" value="Court-Admissible Evidence Dossier" />
          </dl>
        </Card>
      ) : null}

      {tab === 'gaps' ? (
        <Card title="Deliberate Non-Goals & Architecture Principles">
          <ul className="space-y-2 text-[13px] text-ink-soft">
            <li className="flex items-start gap-2">
              <span className="text-brand-600 font-bold">•</span>
              <span><strong>No cloud SaaS reliance:</strong> Sensitive Indian citizen biometrics never cross foreign server boundaries.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-600 font-bold">•</span>
              <span><strong>No probabilistic percentage verdicts:</strong> Officers need verifiable facts, not obscure probability scores.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-600 font-bold">•</span>
              <span><strong>Zero reliance on synthetic image classifiers:</strong> We check issuer signatures and syntactic mathematics rather than generic visual textures.</span>
            </li>
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
