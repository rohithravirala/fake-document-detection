import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200',
    secondary: 'border border-line-strong bg-white text-ink hover:bg-canvas disabled:text-ink-faint',
    ghost: 'text-ink-muted hover:bg-canvas hover:text-ink',
    danger: 'border border-reject-border bg-reject-bg text-reject hover:bg-reject hover:text-white',
  }
  const sizes = { sm: 'px-2.5 py-1.5 text-[12.5px]', md: 'px-4 py-2 text-[13px]' }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}

export function Card({
  title,
  step,
  action,
  className,
  bodyClass,
  children,
}: {
  title?: ReactNode
  step?: number
  action?: ReactNode
  className?: string
  bodyClass?: string
  children: ReactNode
}) {
  return (
    <section className={cn('card flex flex-col', className)}>
      {title ? (
        <header className="card-head">
          {step ? <span className="step-num">{step}</span> : null}
          <h2 className="card-title">{title}</h2>
          {action ? <div className="ml-auto">{action}</div> : null}
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

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {detail ? <p className="mx-auto mt-1 max-w-md text-[12.5px] text-ink-muted">{detail}</p> : null}
    </div>
  )
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="field-row">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-ink">{value}</dd>
    </div>
  )
}

/** A short factual note. Used where the system has to state a limit. */
export function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-md border px-3.5 py-2.5 text-[12.5px] leading-relaxed',
        tone === 'info'
          ? 'border-brand-200 bg-brand-50 text-ink-soft'
          : 'border-refer-border bg-refer-bg text-refer-dark',
      )}
    >
      {children}
    </div>
  )
}
