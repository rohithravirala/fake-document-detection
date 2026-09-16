import { NavLink } from 'react-router-dom'
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
<<<<<<< Updated upstream
=======

      <div className="border-t border-white/10 px-5 py-5">
        {/* A chakra rather than a map: at this size a silhouette of India is
            indistinguishable from a blob, and a badly drawn national outline
            reads worse than no outline. */}
        <div className="flex items-center gap-3">
          <Chakra className="h-9 w-9 shrink-0 text-white/80" />
          <p className="text-[13px] font-semibold leading-tight">
            Secure Borders
            <br />
            Safer India
          </p>
        </div>
        <div className="tri-rule mt-4 h-[3px] w-14 rounded-full" />
      </div>
>>>>>>> Stashed changes
    </div>
  )
}
