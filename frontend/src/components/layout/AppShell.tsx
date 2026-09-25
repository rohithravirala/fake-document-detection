import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ToastContainer } from '@/components/common/Toast'
import { cn } from '@/lib/utils'
import {
  IconSearch,
  IconVerify,
  IconHistory,
  IconFace,
  IconChart,
  IconShield,
  IconCross,
} from '@/components/common/Icons'

export function AppShell() {
  const [open, setOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const commandItems = [
    { title: 'New Document Verification', icon: IconVerify, to: '/verify', category: 'Action' },
    { title: 'Screen Aadhaar QR / Offline XML', icon: IconVerify, to: '/verify', category: 'Action' },
    { title: 'Browse All Case Records', icon: IconHistory, to: '/cases', category: 'Navigation' },
    { title: 'Biometric Face Search & Gallery', icon: IconFace, to: '/faces', category: 'Biometrics' },
    { title: 'Forensic System Analytics', icon: IconChart, to: '/analytics', category: 'Intelligence' },
    { title: 'Cryptographic Audit Hash Trail', icon: IconShield, to: '/audit', category: 'Security' },
  ]

  const filteredCommands = commandItems.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSelect = (to: string) => {
    setPaletteOpen(false)
    navigate(to)
  }

  return (
    <div className="min-h-screen bg-canvas selection:bg-brand-500 selection:text-white">
      <TopBar onMenu={() => setOpen(true)} onQuickSearch={() => setPaletteOpen(true)} />

      <div className="flex">
        {/* Desktop rail */}
        <aside className="sticky top-[86px] hidden h-[calc(100vh-86px)] w-[212px] shrink-0 overflow-y-auto lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              className="absolute inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            />
            <aside className="absolute inset-y-0 left-0 w-[240px] overflow-y-auto shadow-panel animate-in slide-in-from-left duration-200">
              <Sidebar onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main className={cn('min-w-0 flex-1 px-4 pb-12 pt-5 md:px-7')}>
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette (Ctrl+K) */}
      {paletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div
            className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm transition-opacity"
            onClick={() => setPaletteOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-white shadow-panel overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <IconSearch className="h-5 w-5 text-ink-muted" />
              <input
                autoFocus
                placeholder="Type a command or search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[14px] font-medium text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                onClick={() => setPaletteOpen(false)}
                className="rounded p-1 text-ink-muted hover:bg-canvas"
              >
                <IconCross className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                Quick Navigation & Actions
              </p>
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.title}
                  onClick={() => handleSelect(cmd.to)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] text-ink hover:bg-brand-50 hover:text-brand-700 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <cmd.icon className="h-4 w-4 text-ink-muted group-hover:text-brand-600" />
                    <span className="font-medium">{cmd.title}</span>
                  </div>
                  <span className="rounded bg-canvas px-1.5 py-0.5 text-[10.5px] text-ink-muted group-hover:bg-brand-100 font-mono">
                    {cmd.category}
                  </span>
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <div className="p-6 text-center text-[13px] text-ink-muted">
                  No actions found for "{searchQuery}"
                </div>
              )}
            </div>
            <div className="border-t border-line bg-canvas/60 px-4 py-2 flex items-center justify-between text-[11px] text-ink-muted">
              <span>Press <span className="kbd-key">ESC</span> to dismiss</span>
              <span className="font-mono">SVARAM Command OS</span>
            </div>
          </div>
        </div>
      ) : null}

      <ToastContainer />

      <footer className="border-t border-line bg-white px-4 py-4 md:px-7">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-muted">
          <span className="font-bold tracking-[0.14em] text-navy-900">SVARAM</span>
          <span className="hidden md:inline">
            AI-Powered Document Verification · National Security & Identity Authenticity
          </span>
          <span className="ml-auto flex items-center gap-3">
            <span className="tri-rule h-[3px] w-14 rounded-full" />
            <span className="font-medium">#SmartIndiaHackathon 2026 · Problem SIH26188</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
