/**
 * Marks drawn rather than sourced.
 *
 * The State Emblem is a protected symbol and this is a prototype, so the
 * sidebar carries an Ashoka Chakra motif instead — recognisably of the right
 * world without claiming to be the official emblem.
 */

export function Chakra({ className = 'h-7 w-7' }: { className?: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => (i * 360) / 24)
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="3.4" fill="currentColor" />
      {spokes.map((angle) => (
        <line
          key={angle}
          x1="24"
          y1="24"
          x2={24 + 19 * Math.cos((angle * Math.PI) / 180)}
          y2={24 + 19 * Math.sin((angle * Math.PI) / 180)}
          stroke="currentColor"
          strokeWidth="1.1"
        />
      ))}
    </svg>
  )
}

export function PratyayMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M24 3 8 9v14c0 9.6 6.6 17.4 16 20 9.4-2.6 16-10.4 16-20V9z"
        fill="url(#sg)"
        stroke="#0B1F4B"
        strokeWidth="1.6"
      />
      <path d="m16.5 24.5 5 5 10.5-11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="sg" x1="8" y1="3" x2="40" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#245098" />
          <stop offset="1" stopColor="#0B1F4B" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function DigitalIndiaMark({ className = 'h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 34" className={className} aria-hidden="true">
      <circle cx="15" cy="17" r="11" fill="none" stroke="#FF9933" strokeWidth="3" strokeDasharray="34 12" />
      <circle cx="15" cy="17" r="4.5" fill="#138808" />
      <text x="33" y="15" fontSize="11" fontWeight="700" fill="currentColor">Digital India</text>
      <text x="33" y="27" fontSize="8" fill="currentColor" opacity="0.7">Power To Empower</text>
    </svg>
  )
}
