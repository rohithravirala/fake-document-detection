import { useMemo, useState } from 'react'
import type { Check } from '@/api/types'
import { CheckRow } from './CheckRow'
import { SEVERITY_ORDER } from '@/lib/format'
import { cn } from '@/lib/utils'
import { IconSearch } from '@/components/common/Icons'

type Filter = 'all' | 'problems' | 'decisive'

const FILTERS: Array<{ id: Filter; label: string; hint: string }> = [
  { id: 'problems', label: 'Problems', hint: 'Anything that failed or could not be resolved' },
  { id: 'decisive', label: 'Decisive', hint: 'Signature, structure and cross-field checks only' },
  { id: 'all', label: 'All checks', hint: 'Everything that ran' },
]

const DECISIVE = new Set(['cryptographic', 'structural', 'cross_field'])

export function CheckList({ checks, imageUrl }: { checks: Check[]; imageUrl?: string | null }) {
  const [filter, setFilter] = useState<Filter>('problems')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const filtered = checks.filter((check) => {
      if (query.trim()) {
        const q = query.toLowerCase()
        const matchesQuery =
          check.check_id.toLowerCase().includes(q) ||
          check.citation.toLowerCase().includes(q) ||
          check.check_type.toLowerCase().includes(q)
        if (!matchesQuery) return false
      }
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
  }, [checks, filter, query])

  const counts = useMemo(
    () => ({
      all: checks.length,
      problems: checks.filter((check) => check.result !== 'pass').length,
      decisive: checks.filter((check) => DECISIVE.has(check.check_type)).length,
      passed: checks.filter((check) => check.result === 'pass').length,
      failed: checks.filter((check) => check.result === 'fail').length,
    }),
    [checks],
  )

  return (
    <div className="card overflow-hidden">
      {/* Header bar with filters and search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilter(option.id)}
              title={option.hint}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer',
                filter === option.id
                  ? 'bg-brand-600 text-white shadow-brand-500/20'
                  : 'bg-white border border-line text-ink-muted hover:border-brand-300 hover:text-ink',
              )}
            >
              {option.label}
              <span
                className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0.2 font-mono text-[10.5px]',
                  filter === option.id ? 'bg-brand-700 text-white' : 'bg-canvas text-ink-muted',
                )}
              >
                {counts[option.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Live Filter Search */}
        <div className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Filter checks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-line bg-white py-1 pl-8 pr-2.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[13px] font-medium text-ink-muted">
            {filter === 'problems'
              ? 'Nothing failed and nothing was left unresolved.'
              : 'No checks of this kind ran on this document.'}
          </p>
        </div>
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
