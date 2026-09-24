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
  { to: '/verify', label: 'Verify Document', Icon: IconVerify },
  { to: '/cases', label: 'Case History', Icon: IconHistory },
  { to: '/faces', label: 'Face Search', Icon: IconFace },
  { to: '/analytics', label: 'Analytics', Icon: IconChart },
  { to: '/audit', label: 'Audit Logs', Icon: IconShield },
  { to: '/officers', label: 'User Management', Icon: IconUsers },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const initial = user?.name ? user.name.trim().slice(0, 1).toUpperCase() : 'O'

  return (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <nav className="flex-1 py-3">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 border-l-[3px] px-5 py-[11px] text-[13.5px] transition-colors',
                isActive
                  ? 'border-l-saffron bg-navy-600 font-semibold text-white'
                  : 'border-l-transparent text-white/70 hover:bg-navy-800 hover:text-white',
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Authenticated Officer Session Card */}
      <div className="border-t border-white/10 p-3">
        <Link
          to="/login"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-lg bg-white/5 p-2.5 hover:bg-white/10 transition group"
          title="Switch Officer / View Login"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white shadow-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate group-hover:text-brand-300">
              {user?.name || 'Officer'}
            </p>
            <p className="text-[10px] text-white/60 truncate font-mono">
              {user?.badgeNumber || 'IN-OFF-7042'}
            </p>
          </div>
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-white/40 group-hover:text-white transition" fill="currentColor">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.5a.75.75 0 000 1.5h9.75A.75.75 0 0019 10z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M15.53 7.47a.75.75 0 010 1.06L13.06 11l2.47 2.47a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
