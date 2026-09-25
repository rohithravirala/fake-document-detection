import { NavLink, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  IconChart,
  IconDashboard,
  IconFace,
  IconHistory,
  IconSettings,
  IconShield,
  IconUsers,
  IconVerify,
} from '@/components/common/Icons'
import { useAuth } from '@/lib/auth'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/verify', label: 'Verify Document', Icon: IconVerify, badge: 'Live' },
  { to: '/cases', label: 'Case History', Icon: IconHistory },
  { to: '/faces', label: 'Face Search', Icon: IconFace },
  { to: '/analytics', label: 'Analytics', Icon: IconChart },
  { to: '/audit', label: 'Audit Logs', Icon: IconShield, badge: 'Chain' },
  { to: '/officers', label: 'User Roster', Icon: IconUsers },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const initial = user?.name ? user.name.trim().slice(0, 1).toUpperCase() : 'O'

  return (
    <div className="flex h-full flex-col bg-navy-950 text-white select-none">
      {/* Quick Launch CTA */}
      <div className="p-3.5 pb-2">
        <Link
          to="/verify"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-2.5 px-3 text-[13px] font-semibold text-white shadow-glow transition-all hover:opacity-95 hover:shadow-lg active:scale-[0.99]"
        >
          <IconVerify className="h-4 w-4" />
          <span>New Verification</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV.map(({ to, label, Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                isActive
                  ? 'bg-navy-800 font-semibold text-white shadow-xs'
                  : 'text-white/70 hover:bg-navy-900 hover:text-white',
              )
            }
          >
            <div className="flex items-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
              <span>{label}</span>
            </div>
            {badge ? (
              <span className="rounded bg-brand-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-brand-300 border border-brand-400/30">
                {badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      {/* Authenticated Officer Session Card */}
      <div className="border-t border-white/10 p-3">
        <Link
          to="/login"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5 hover:bg-white/10 transition group border border-white/5"
          title="Switch Officer / View Login"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold text-white shadow-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate group-hover:text-brand-300">
              {user?.name || 'Counter Officer'}
            </p>
            <p className="text-[10px] text-white/50 truncate font-mono">
              {user?.badgeNumber || 'IN-OFF-7042'}
            </p>
          </div>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-white/30 group-hover:text-white transition" fill="currentColor">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
