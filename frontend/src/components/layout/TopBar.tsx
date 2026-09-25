import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHealth } from '@/api/hooks'
import { DigitalIndiaMark, SvaramMark, SihBadge } from './Brand'
import { IconAlert, IconCheck, IconShield, IconUsers, IconSearch } from '@/components/common/Icons'
import { useAuth } from '@/lib/auth'

/**
 * The capability strip under the masthead.
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
    <div className="flex min-h-[29px] flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-canvas/70 px-4 py-1 text-[11px] leading-[15px] md:px-6">
      <span className="flex items-center gap-1.5 font-medium text-ink-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-clear" />
        Operational
      </span>
      <span className="text-line-strong">·</span>
      <span className="rounded border border-line bg-white px-1.5 py-px font-mono text-ink-muted">
        {data.storage}
      </span>
      <span className="rounded border border-line bg-white px-1.5 py-px font-mono text-ink-muted">
        {data.execution}
      </span>
      {data.offline_capable ? (
        <span className="rounded border border-clear-border bg-clear-bg px-2 py-px font-medium text-clear-dark">
          offline certified
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

export function TopBar({ onMenu, onQuickSearch }: { onMenu: () => void; onQuickSearch?: () => void }) {
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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md">
      <div className="flex h-[57px] items-center gap-4 border-b border-line px-4 md:px-6">
        <button
          onClick={onMenu}
          className="-ml-1 rounded-lg p-2 text-ink-muted hover:bg-canvas lg:hidden"
          aria-label="Open navigation"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        {/* Product Brand */}
        <Link to="/" className="flex items-center gap-3 transition hover:opacity-95">
          <SvaramMark className="h-9 w-9 shrink-0 drop-shadow-sm" />
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <p className="text-[19px] font-extrabold tracking-[0.16em] text-navy-900">SVARAM</p>
              <span className="hidden rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-brand-700 sm:inline-block border border-brand-200">
                SIH26188
              </span>
            </div>
            <p className="text-[10.5px] font-medium tracking-wide text-ink-muted">
              AI Identity & Document Screening System
            </p>
          </div>
        </Link>

        {/* Quick Search Shortcut Trigger */}
        <button
          onClick={onQuickSearch || (() => navigate('/cases'))}
          className="ml-4 hidden items-center gap-2 rounded-lg border border-line bg-canvas/70 px-3 py-1.5 text-[12px] text-ink-muted hover:border-brand-300 hover:bg-white transition xl:flex"
        >
          <IconSearch className="h-3.5 w-3.5 text-ink-faint" />
          <span>Search cases, documents, Aadhaar...</span>
          <span className="kbd-key ml-2">Ctrl K</span>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <SihBadge className="hidden 2xl:inline-flex" />
          <DigitalIndiaMark className="hidden h-7 text-navy-800 lg:block" />

          {/* Officer Session Profile */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-1.5 shadow-xs transition hover:border-brand-300 hover:bg-canvas cursor-pointer text-left"
              aria-expanded={dropdownOpen}
            >
              <div className="relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-navy-800 text-[12px] font-bold text-white shadow-xs">
                  {initial}
                </div>
                {isAuthenticated ? (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-clear ring-2 ring-white" />
                ) : null}
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-[12.5px] font-semibold text-ink truncate max-w-[130px]">
                  {user?.name || 'Officer On Duty'}
                </p>
                <p className="text-[10px] text-ink-muted truncate max-w-[130px] font-mono">
                  {user ? user.role : 'demo · guest'}
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
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-line bg-white p-3.5 shadow-panel z-50 animate-in fade-in slide-in-from-top-1">
                <div className="border-b border-line pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-800 text-[13px] font-bold text-white shadow-sm">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-ink truncate">{user?.name || 'Officer'}</p>
                      <p className="text-[11px] text-ink-muted truncate">{user?.email || 'officer@mha.gov.in'}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] bg-canvas/80 p-2 rounded-lg border border-line font-mono">
                    <span className="text-ink-muted">Clearance:</span>
                    <span className="font-semibold text-brand-700">LEVEL 3 · ADMISSIBLE</span>
                  </div>
                </div>

                <div className="py-2 space-y-1">
                  <div className="flex items-center justify-between text-[11.5px] py-1 text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <IconCheck className="h-3.5 w-3.5 text-clear" />
                      Session Status
                    </span>
                    <span className="font-semibold text-clear">Active & Encrypted</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] py-1 text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <IconShield className="h-3.5 w-3.5 text-brand-600" />
                      Badge ID
                    </span>
                    <span className="font-mono text-ink">{user?.badgeNumber || 'IN-OFF-7042'}</span>
                  </div>
                </div>

                <div className="border-t border-line pt-2.5 space-y-1">
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      navigate('/officers')
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas transition"
                  >
                    <IconUsers className="h-3.5 w-3.5 text-ink-muted" />
                    <span>Officer Roster</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-reject hover:bg-reject-bg transition"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Sign Out</span>
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
