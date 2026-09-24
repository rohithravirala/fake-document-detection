import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHealth } from '@/api/hooks'
import { DigitalIndiaMark, SvaramMark } from './Brand'
import { IconAlert, IconCheck, IconShield, IconUsers } from '@/components/common/Icons'
import { useAuth } from '@/lib/auth'

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
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login')
  }

  const initial = user?.name ? user.name.trim().slice(0, 1).toUpperCase() : (data?.app ?? 'O').slice(0, 1)

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
        <Link to="/" className="flex items-center gap-3 hover:opacity-95 transition">
          <SvaramMark className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <p className="text-[19px] font-bold tracking-[0.18em] text-navy-800">SVARAM</p>
            <p className="text-[10.5px] tracking-wide text-ink-muted">Verify Today. Safer Tomorrow.</p>
          </div>
        </Link>

        <div className="hidden items-center border-l border-line pl-4 lg:flex">
          <p className="text-[12.5px] leading-tight text-ink-muted">
            AI-Powered Document Verification
          </p>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <DigitalIndiaMark className="hidden h-7 text-navy-800 xl:block" />

          {/* Officer Session Profile & Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-1.5 hover:border-brand-300 hover:bg-canvas/50 transition cursor-pointer text-left"
              aria-expanded={dropdownOpen}
            >
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[12px] font-bold text-brand-800 border border-brand-200">
                  {initial}
                </div>
                {isAuthenticated ? (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-clear ring-2 ring-white" />
                ) : null}
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-[12.5px] font-semibold text-ink truncate max-w-[140px]">
                  {user?.name || 'Officer'}
                </p>
                <p className="text-[10.5px] text-ink-muted truncate max-w-[140px]">
                  {user ? user.role : 'demo · no sign-in'}
                </p>
              </div>
              <svg
                viewBox="0 0 20 20"
                className={`h-4 w-4 text-ink-faint transition-transform hidden sm:block ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Officer Dropdown Popup */}
            {dropdownOpen ? (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-line bg-white p-3.5 shadow-panel z-50 animate-in fade-in slide-in-from-top-1">
                <div className="border-b border-line pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-[13px] font-bold text-white shadow-sm">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-ink truncate">{user?.name || 'Officer'}</p>
                      <p className="text-[11px] text-ink-muted truncate">{user?.email || 'No email configured'}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] bg-canvas/60 p-2 rounded border border-line">
                    <span className="text-ink-muted">Badge / ID:</span>
                    <span className="font-mono font-semibold text-brand-700">
                      {user?.badgeNumber || 'IN-OFF-7042'}
                    </span>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  <div className="flex items-center justify-between text-[11.5px] py-1 text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <IconCheck className="h-3.5 w-3.5 text-clear" />
                      Session Status
                    </span>
                    <span className="font-medium text-clear">Active & Verified</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] py-1 text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <IconShield className="h-3.5 w-3.5 text-brand-600" />
                      Designation
                    </span>
                    <span className="font-medium text-ink truncate max-w-[130px]">{user?.role}</span>
                  </div>
                </div>

                <div className="border-t border-line pt-2.5 space-y-1.5">
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      navigate('/login')
                    }}
                    className="w-full flex items-center gap-2 rounded px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas transition"
                  >
                    <IconUsers className="h-3.5 w-3.5 text-ink-muted" />
                    <span>Switch Officer Account</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 rounded px-2.5 py-1.5 text-[12px] font-medium text-reject hover:bg-reject-bg transition"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Sign Out of Portal</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <Capabilities />
    </header>
  )
}
