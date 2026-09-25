import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}) {
  const variants = {
    primary:
      'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300 disabled:text-white/80',
    secondary:
      'border border-line-strong bg-white text-ink shadow-xs hover:bg-canvas hover:border-brand-300 disabled:text-ink-faint disabled:bg-canvas',
    ghost: 'text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-50',
    danger:
      'border border-reject-border bg-reject-bg text-reject-dark hover:bg-reject hover:text-white disabled:opacity-50',
    success:
      'border border-clear-border bg-clear-bg text-clear-dark hover:bg-clear hover:text-white disabled:opacity-50',
  }
  const sizes = {
    sm: 'px-2.5 py-1.5 text-[12px] rounded-md gap-1.5',
    md: 'px-4 py-2 text-[13px] rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-[14px] rounded-lg gap-2.5 font-semibold',
  }

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5 border-current border-t-transparent" /> : null}
      {children}
    </button>
  )
}

export function Card({
  title,
  subtitle,
  step,
  action,
  tricolourAccent = false,
  className,
  bodyClass,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  step?: number
  action?: ReactNode
  tricolourAccent?: boolean
  className?: string
  bodyClass?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'card relative flex flex-col overflow-hidden',
        tricolourAccent ? 'border-t-2 border-t-saffron' : '',
        className,
      )}
    >
      {title ? (
        <header className="card-head">
          <div className="flex items-center gap-2.5">
            {step ? <span className="step-num">{step}</span> : null}
            <div>
              <h2 className="card-title">{title}</h2>
              {subtitle ? <p className="text-[12px] text-ink-muted mt-0.5">{subtitle}</p> : null}
            </div>
          </div>
          {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('min-w-0 flex-1 p-5', bodyClass)}>{children}</div>
    </section>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-brand-600',
        className,
      )}
    />
  )
}

export function EmptyState({
  title,
  detail,
  icon,
  action,
}: {
  title: string
  detail?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong/80 bg-canvas/30 px-6 py-12 text-center transition-all hover:bg-canvas/50">
      {icon ? (
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          {icon}
        </div>
      ) : null}
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {detail ? <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-ink-muted">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="field-row">
      <dt className="text-ink-muted font-medium text-[12px]">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-ink text-[12.5px]">{value}</dd>
    </div>
  )
}

export function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'success'
  children: ReactNode
}) {
  const tones = {
    info: 'border-brand-200 bg-brand-50/80 text-ink-soft',
    warn: 'border-refer-border bg-refer-bg text-refer-dark',
    success: 'border-clear-border bg-clear-bg text-clear-dark',
  }
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed shadow-xs',
        tones[tone],
      )}
    >
      {children}
    </div>
  )
}

export function SearchInput({
  className,
  shortcut = '⌘K',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { shortcut?: string }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        className="w-full rounded-lg border border-line bg-white py-1.5 pl-9 pr-12 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        {...props}
      />
      {shortcut ? (
        <span className="pointer-events-none absolute right-2.5 kbd-key text-[10px]">
          {shortcut}
        </span>
      ) : null}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; count?: number }>
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-line pb-px overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const isSelected = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'group relative flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-medium transition-all whitespace-nowrap',
              isSelected
                ? 'text-brand-600 font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-canvas rounded-t-md',
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 font-mono text-[10.5px]',
                  isSelected ? 'bg-brand-100 text-brand-700' : 'bg-canvas text-ink-muted',
                )}
              >
                {tab.count}
              </span>
            ) : null}
            {isSelected ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 rounded-t" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
