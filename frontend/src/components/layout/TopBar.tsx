import { useHealth } from '@/api/hooks'
import { DigitalIndiaMark, SvaramMark } from './Brand'
import { IconAlert } from '@/components/common/Icons'

/**
 * The capability strip under the masthead.
 *
 * It names every module that cannot run in this deployment. A system that
 * quietly omits a check it could not perform is not trustworthy, so the gaps
 * are on screen rather than buried in a log.
 */
function Capabilities() {
  const { data } = useHealth()
  if (!data) return null

  const missing = Object.entries(data.modules)
    .filter(([, available]) => !available)
    .map(([name]) => name)

  const gaps: string[] = []
  if (!data.aadhaar_certificate) gaps.push('no UIDAI certificate — Aadhaar signatures cannot be verified')
  if (missing.length) gaps.push(`unavailable: ${missing.join(', ')}`)

  return (
    <div className="flex min-h-[29px] flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-canvas px-4 py-1 text-[11px] leading-[15px] md:px-6">
      <span className="rounded border border-line bg-white px-1.5 py-px font-mono text-ink-muted">
        {data.storage}
      </span>
      <span className="rounded border border-line bg-white px-1.5 py-px font-mono text-ink-muted">
        {data.execution}
      </span>
      {data.offline_capable ? (
        <span className="rounded border border-clear-border bg-clear-bg px-1.5 py-px font-medium text-clear-dark">
          offline capable
        </span>
      ) : null}
      {gaps.length ? (
        <span className="flex items-center gap-1.5 font-medium text-refer">
          <IconAlert className="h-3.5 w-3.5 shrink-0" />
          {gaps.join(' · ')}
        </span>
      ) : null}
    </div>
  )
}

/*
 * The masthead is pinned to 57px and the strip below it to 29px, because
 * AppShell offsets the sticky sidebar by their sum (86px). Change a height
 * here and that offset has to move with it.
 */
export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { data } = useHealth()

  return (
    <header className="sticky top-0 z-30 bg-white">
      <div className="flex h-[57px] items-center gap-4 border-b border-line px-4 md:px-6">
        <button
          onClick={onMenu}
          className="-ml-1 rounded p-2 text-ink-muted hover:bg-canvas lg:hidden"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        {/* Product */}
        <div className="flex items-center gap-3">
          <SvaramMark className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <p className="text-[19px] font-bold tracking-[0.18em] text-navy-800">SVARAM</p>
            <p className="text-[10.5px] tracking-wide text-ink-muted">Verify Today. Safer Tomorrow.</p>
          </div>
        </div>

        <div className="hidden items-center border-l border-line pl-4 lg:flex">
          <p className="text-[12.5px] leading-tight text-ink-muted">
            AI-Powered Document Verification
          </p>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <DigitalIndiaMark className="hidden h-7 text-navy-800 xl:block" />
          <div className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-800">
              {(data?.app ?? 'O').slice(0, 1)}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-[12.5px] font-semibold text-ink">Officer</p>
              <p className="text-[10.5px] text-ink-muted">demo · no sign-in</p>
            </div>
          </div>
        </div>
      </div>
      <Capabilities />
    </header>
  )
}
