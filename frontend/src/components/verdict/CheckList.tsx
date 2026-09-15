import { useMemo, useState } from 'react'
import type { Check } from '@/api/types'
import { CheckRow } from './CheckRow'
import { SEVERITY_ORDER } from '@/lib/format'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'problems' | 'decisive'

const FILTERS: Array<{ id: Filter; label: string; hint: string }> = [
  { id: 'problems', label: 'Problems', hint: 'Anything that failed or could not be resolved' },
  { id: 'decisive', label: 'Decisive', hint: 'Signature, structure and cross-field checks only' },
  { id: 'all', label: 'All checks', hint: 'Everything that ran' },
]

const DECISIVE = new Set(['cryptographic', 'structural', 'cross_field'])

export function CheckList({ checks, imageUrl }: { checks: Check[]; imageUrl?: string | null }) {
  const [filter, setFilter] = useState<Filter>('problems')

  const visible = useMemo(() => {
    const filtered = checks.filter((check) => {
      if (filter === 'all') return true
      if (filter === 'decisive') return DECISIVE.has(check.check_type)
      return check.result !== 'pass'
    })
    return [...filtered].sort((a, b) => {
      const byResult = Number(b.result === 'fail') - Number(a.result === 'fail')
      if (byResult !== 0) return byResult
      const bySeverity = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]
      if (bySeverity !== 0) return bySeverity
      return a.sequence - b.sequence
    })
  }, [checks, filter])

  const counts = useMemo(
    () => ({
      all: checks.length,
      problems: checks.filter((check) => check.result !== 'pass').length,
      decisive: checks.filter((check) => DECISIVE.has(check.check_type)).length,
    }),
    [checks],
  )

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 py-2">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            onClick={() => setFilter(option.id)}
            title={option.hint}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              filter === option.id
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )}
          >
            {option.label}
            <span className="ml-1.5 opacity-60">{counts[option.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
          {filter === 'problems'
            ? 'Nothing failed and nothing was left unresolved.'
            : 'No checks of this kind ran on this document.'}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((check) => (
            <CheckRow key={check.id} check={check} imageUrl={imageUrl} />
          ))}
        </ul>
      )}
    </div>
  )
}
