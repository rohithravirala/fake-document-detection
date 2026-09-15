/**
 * The icon set, hand-authored.
 *
 * Twelve glyphs at one weight and one grid — a library would ship hundreds to
 * get these, and every one of them would need the same stroke normalisation
 * anyway. All inherit `currentColor`, so a single class controls colour.
 */

type IconProps = { className?: string }

const base = 'h-[18px] w-[18px]'

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? base}
    >
      {children}
    </svg>
  )
}

export const IconDashboard = (p: IconProps) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></Svg>
)
export const IconVerify = (p: IconProps) => (
  <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m9.5 14 1.8 1.8L15 12" /></Svg>
)
export const IconHistory = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 1.9" /></Svg>
)
export const IconFace = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="9.5" r="3.4" /><path d="M5.5 20a6.8 6.8 0 0 1 13 0" /><path d="M3 7V4.6A1.6 1.6 0 0 1 4.6 3H7M17 3h2.4A1.6 1.6 0 0 1 21 4.6V7" /></Svg>
)
export const IconChart = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></Svg>
)
export const IconShield = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 5 6v6c0 4.4 2.9 7.9 7 9 4.1-1.1 7-4.6 7-9V6z" /><path d="m9.3 12 1.9 1.9 3.6-3.8" /></Svg>
)
export const IconUsers = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6M18 20a6 6 0 0 0-2.2-4.6" /></Svg>
)
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.06-.06A2 2 0 1 1 7.07 4.2l.06.06a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5.91z" /></Svg>
)
export const IconUpload = (p: IconProps) => (
  <Svg {...p}><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></Svg>
)
export const IconCamera = (p: IconProps) => (
  <Svg {...p}><path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.4" /></Svg>
)
export const IconQr = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="3.5" width="6" height="6" rx="1" /><rect x="14.5" y="3.5" width="6" height="6" rx="1" /><rect x="3.5" y="14.5" width="6" height="6" rx="1" /><path d="M14.5 14.5h3v3M20.5 17.5v3h-3" /></Svg>
)
export const IconDownload = (p: IconProps) => (
  <Svg {...p}><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4 19h16" /></Svg>
)
export const IconEye = (p: IconProps) => (
  <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></Svg>
)
export const IconRefresh = (p: IconProps) => (
  <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4.5h-4.5" /></Svg>
)
export const IconSearch = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></Svg>
)
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>
)
export const IconCross = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
)
export const IconClock = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 1.8" /></Svg>
)
export const IconInfo = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.6v.4" /></Svg>
)
export const IconAlert = (p: IconProps) => (
  <Svg {...p}><path d="M12 4.5 2.8 20h18.4z" /><path d="M12 10v4.2" /><path d="M12 17.3v.3" /></Svg>
)
export const IconLink = (p: IconProps) => (
  <Svg {...p}><path d="M9.5 14.5a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.2 1.2" /><path d="M14.5 9.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.2-1.2" /></Svg>
)
export const IconDoc = (p: IconProps) => (
  <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h4.5" /></Svg>
)
