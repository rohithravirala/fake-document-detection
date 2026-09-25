/**
 * Official SVARAM & Government Branding Marks — Scalable Vector Graphics.
 */

export function SvaramMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="svaramGrad" x1="8" y1="3" x2="40" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="60%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0B1F4B" />
        </linearGradient>
        <filter id="shieldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1D4ED8" floodOpacity="0.3" />
        </filter>
      </defs>
      <path
        d="M24 3 8 9v14c0 9.6 6.6 17.4 16 20 9.4-2.6 16-10.4 16-20V9z"
        fill="url(#svaramGrad)"
        stroke="#1E3A8A"
        strokeWidth="1.5"
        filter="url(#shieldGlow)"
      />
      {/* Tricolour micro accent bar */}
      <path d="M19 14 h10" stroke="#FF9933" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      <path d="m16.5 25.5 5 5 10.5-11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="36" r="2" fill="#138808" />
    </svg>
  )
}

export function DigitalIndiaMark({ className = 'h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 34" className={className} aria-hidden="true">
      <circle cx="16" cy="17" r="11" fill="none" stroke="#FF9933" strokeWidth="2.5" strokeDasharray="36 12" />
      <circle cx="16" cy="17" r="5" fill="#138808" />
      <text x="35" y="15" fontSize="11" fontWeight="800" fill="currentColor" letterSpacing="0.04em">Digital India</text>
      <text x="35" y="27" fontSize="8" fontWeight="500" fill="currentColor" opacity="0.75" letterSpacing="0.02em">Power To Empower</text>
    </svg>
  )
}

export function SihBadge({ className = 'h-6' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-xs backdrop-blur-xs ${className}`}>
      <span className="flex h-2 w-2 rounded-full bg-saffron" />
      <span>SIH 2026</span>
      <span className="text-ink-muted">·</span>
      <span className="font-mono text-brand-700">SIH26188</span>
    </div>
  )
}
