import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { cn } from '@/lib/utils'

export function AppShell() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar onMenu={() => setOpen(true)} />

      <div className="flex">
        {/* Desktop rail */}
        <aside className="sticky top-[86px] hidden h-[calc(100vh-86px)] w-[212px] shrink-0 overflow-y-auto lg:block">
          <Sidebar />
        </aside>

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              className="absolute inset-0 bg-ink/40"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            />
            <aside className="absolute inset-y-0 left-0 w-[240px] overflow-y-auto shadow-panel">
              <Sidebar onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main className={cn('min-w-0 flex-1 px-4 pb-10 pt-5 md:px-6')}>
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-line bg-white px-4 py-3.5 md:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink-muted">
          <span className="font-semibold text-ink">PRATYAY</span>
          <span>Ministry of Home Affairs, Government of India</span>
          <span className="hidden md:inline">Authentic Citizens · Secure Borders · A Stronger Nation</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="tri-rule h-[3px] w-14 rounded-full" />
            #SmartIndiaHackathon 2026 · Built for Bharat
          </span>
        </div>
      </footer>
    </div>
  )
}
