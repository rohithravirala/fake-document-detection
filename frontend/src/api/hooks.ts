/**
 * Server state, through TanStack Query.
 *
 * The screening lifecycle is the reason this library is here: submit returns a
 * case id, the result arrives seconds later over a stream, and the case must
 * then be re-read. Query owns the caching, retries and invalidation so none of
 * that is hand-written across four screens.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CaseSummary, StreamEvent } from './types'
import { useEffect, useRef, useState } from 'react'

export const keys = {
  health: ['health'] as const,
  cases: (verdict?: string) => ['cases', verdict ?? 'all'] as const,
  case: (id: string) => ['case', id] as const,
  profiles: ['profiles'] as const,
  chain: ['audit', 'chain'] as const,
  audit: ['audit', 'records'] as const,
  stats: ['stats'] as const,
  analytics: (days: number) => ['analytics', days] as const,
  faceStatus: ['faces', 'status'] as const,
  settings: ['settings'] as const,
  officers: ['officers'] as const,
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: api.stats, refetchInterval: 15_000 })
}

export function useAnalytics(days = 15) {
  return useQuery({ queryKey: keys.analytics(days), queryFn: () => api.analytics(days) })
}

export function useFaceStatus() {
  return useQuery({ queryKey: keys.faceStatus, queryFn: api.faceStatus })
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.settings })
}

export function useOfficers() {
  return useQuery({ queryKey: keys.officers, queryFn: api.officers })
}

export function useHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: api.health,
    staleTime: 60_000,
  })
}

export function useCases(verdict?: string) {
  return useQuery({
    queryKey: keys.cases(verdict),
    queryFn: () => api.listCases({ limit: 100, verdict }),
  })
}

export function useCase(caseId: string | undefined, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: keys.case(caseId ?? ''),
    queryFn: () => api.getCase(caseId as string),
    enabled: Boolean(caseId),
    // Polling is the safety net behind the event stream, not the primary
    // mechanism: if the stream drops, the case still resolves.
    refetchInterval: (query) => {
      if (!options.poll) return false
      const status = query.state.data?.status
      return status === 'complete' || status === 'failed' ? false : 1500
    },
  })
}

export function useSubmit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ files, docTypes }: { files: File[]; docTypes: string[] }) =>
      api.submit(files, docTypes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useSubmitManual() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documents: Array<{ doc_type: string; fields: Record<string, string> }>) =>
      api.submitManual(documents),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

export function useProfiles() {
  return useQuery({ queryKey: keys.profiles, queryFn: api.listProfiles })
}

export function useChainStatus() {
  return useQuery({ queryKey: keys.chain, queryFn: api.verifyChain })
}

export function useAuditRecords() {
  return useQuery({ queryKey: keys.audit, queryFn: () => api.listAudit(100) })
}

/**
 * Subscribe to a screening's live check stream.
 *
 * Returns every event received so far. The caller renders from these while the
 * screening runs, then reads the completed case from the API — the stream is a
 * view of progress, the database is the record.
 */
export function useScreeningStream(caseId: string | undefined) {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [done, setDone] = useState(false)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!caseId) return
    setEvents([])
    setDone(false)

    const source = new EventSource(api.streamUrl(caseId))
    sourceRef.current = source

    source.onopen = () => setConnected(true)

    const handle = (raw: MessageEvent) => {
      try {
        const event = JSON.parse(raw.data) as StreamEvent
        setEvents((previous) => [...previous, event])
        if (
          event.type === 'case.complete' ||
          event.type === 'case.failed' ||
          (event.type === 'case.state' &&
            (event.status === 'complete' || event.status === 'failed'))
        ) {
          setDone(true)
          source.close()
          setConnected(false)
        }
      } catch {
        // A malformed frame is dropped; the poll fallback still resolves the case.
      }
    }

    // The server names each event, so every type is registered explicitly as
    // well as the default `message` handler.
    const named = [
      'case.start',
      'document.start',
      'module.start',
      'module.complete',
      'check',
      'document.complete',
      'case.complete',
      'case.failed',
      'case.state',
      'timeout',
    ]
    named.forEach((name) => source.addEventListener(name, handle as EventListener))
    source.onmessage = handle

    source.onerror = () => {
      setConnected(false)
      // EventSource reconnects on its own; the poll in useCase covers the gap.
    }

    return () => {
      named.forEach((name) => source.removeEventListener(name, handle as EventListener))
      source.close()
      sourceRef.current = null
    }
  }, [caseId])

  return { events, connected, done }
}

export function groupByVerdict(cases: CaseSummary[]) {
  return cases.reduce<Record<string, number>>((totals, item) => {
    const key = item.verdict ?? item.status
    totals[key] = (totals[key] ?? 0) + 1
    return totals
  }, {})
}
