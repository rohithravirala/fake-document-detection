/**
 * The HTTP client.
 *
 * Requests are same-origin: Vite proxies `/api` in development and the built
 * assets are served beside the API in production, so there is no base URL to
 * configure and no CORS to get wrong at a demonstration.
 */

import type {
  Analytics,
  AuditRecord,
  CaseCreated,
  CaseDetail,
  CaseSummary,
  ChainStatus,
  FaceSearchResult,
  FaceStatus,
  Health,
  Officers,
  Overview,
  Profile,
  SystemSettings,
} from './types'

const BASE = '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: init?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!response.ok) {
    let detail: unknown
    let message = `${response.status} ${response.statusText}`
    try {
      detail = await response.json()
      const parsed = detail as { detail?: unknown }
      if (typeof parsed.detail === 'string') message = parsed.detail
    } catch {
      // A non-JSON error body is still an error; keep the status line.
    }
    throw new ApiError(message, response.status, detail)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  health: () => request<Health>('/health'),

  /** Submit document images. Returns immediately; the screening runs behind it. */
  submit: (files: File[], docTypes: string[]) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    docTypes.forEach((type) => form.append('doc_types', type))
    return request<CaseCreated>('/cases', { method: 'POST', body: form })
  },

  /**
   * Submit field values with no image.
   *
   * Used by the demonstration and the evaluation harness to drive known inputs
   * through the real checks on a machine with no OCR engine installed.
   */
  submitManual: (documents: Array<{ doc_type: string; fields: Record<string, string> }>) =>
    request<CaseCreated>('/cases/manual', {
      method: 'POST',
      body: JSON.stringify({ documents }),
    }),

  listCases: (params: { limit?: number; offset?: number; verdict?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))
    if (params.verdict) query.set('verdict', params.verdict)
    const suffix = query.toString() ? `?${query}` : ''
    return request<CaseSummary[]>(`/cases${suffix}`)
  },

  getCase: (caseId: string) => request<CaseDetail>(`/cases/${caseId}`),

  listProfiles: () => request<Profile[]>('/profiles'),
  getProfile: (docType: string) => request<Profile>(`/profiles/${docType}`),
  updateProfile: (docType: string, profile: Record<string, unknown>) =>
    request<Profile>(`/profiles/${docType}`, {
      method: 'PUT',
      body: JSON.stringify({ profile }),
    }),

  verifyChain: () => request<ChainStatus>('/audit/verify'),
  listAudit: (limit = 100) => request<AuditRecord[]>(`/audit?limit=${limit}`),

  streamUrl: (caseId: string) => `${BASE}/cases/${caseId}/stream`,

  stats: () => request<Overview>('/stats'),
  analytics: (days = 15) => request<Analytics>(`/analytics?days=${days}`),

  faceStatus: () => request<FaceStatus>('/faces/status'),
  /** Search stored encounters for a similar face. Embeddings only — no image
   *  of a face is ever stored or returned. */
  faceSearch: (file: File, threshold: number) => {
    const form = new FormData()
    form.append('file', file)
    form.append('threshold', String(threshold))
    return request<FaceSearchResult>('/faces/search', { method: 'POST', body: form })
  },

  settings: () => request<SystemSettings>('/settings'),
  officers: () => request<Officers>('/officers'),
}
