/**
 * The API contract, in TypeScript.
 *
 * These mirror `backend/app/schemas/` exactly. When one side changes, the other
 * changes with it and `docs/API_CONTRACT.md` records why.
 */

/** The three outcomes an officer is ever shown. There is no fourth, and no percentage. */
export type Verdict = 'clear' | 'reject' | 'refer'

/**
 * What a check's evidence rests on. This is the axis that decides how much a
 * result is allowed to influence the verdict.
 */
export type CheckType =
  | 'cryptographic' // a signature from the issuing authority verified
  | 'structural' // the document contradicts itself by arithmetic
  | 'cross_field' // a trusted source disagrees with the printed text
  | 'biometric' // face comparison — speaks to the bearer, not the document
  | 'forensic' // appearance-based signal, suggestive only
  | 'quality' // capture quality gate
  | 'policy' // validity windows, expiry, entry rules

export type CheckResult =
  | 'pass'
  | 'fail'
  | 'inconclusive'
  | 'unavailable' // the check could not run — never a statement about the document
  | 'retake' // the capture is unusable; ask for another photograph

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type CaseStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Evidence {
  note: string
  region?: BBox | null
  expected?: string | null
  observed?: string | null
  source_field?: string | null
  /** Forensic signals only, 0–1. Never present on a decisive check. */
  strength?: number | null
  extra?: Record<string, unknown>
}

export interface Check {
  id: string
  check_id: string
  check_type: CheckType
  result: CheckResult
  severity: Severity
  /** The sentence shown to the officer. Every check has one. */
  citation: string
  module: string
  sequence: number
  evidence: Evidence[]
  duration_ms?: number | null
}

export interface DocumentRecord {
  id: string
  doc_type: string
  filename?: string | null
  image_hash?: string | null
  image_url?: string | null
  extracted_fields: Record<string, string>
  bboxes: Record<string, BBox>
  checks: Check[]
}

export interface CaseSummary {
  id: string
  created_at: string
  completed_at?: string | null
  officer_id: string
  status: CaseStatus
  verdict?: Verdict | null
  reason?: string | null
  duration_ms?: number | null
  document_count: number
  doc_types: string[]
}

export interface CaseDetail extends CaseSummary {
  error?: string | null
  documents: DocumentRecord[]
}

export interface CaseCreated {
  case_id: string
  status: CaseStatus
  documents: number
  stream_url: string
}

export interface Health {
  status: string
  app: string
  environment: string
  storage: string
  execution: string
  /** Which modules can actually run here. Absence is shown, never hidden. */
  modules: Record<string, boolean>
  ocr_engines: Record<string, boolean>
  aadhaar_certificate: boolean
  offline_capable: boolean
}

export interface Profile {
  id: string
  doc_type: string
  version: number
  is_active: boolean
  profile: Record<string, unknown>
  updated_at: string
  updated_by: string
}

export interface ChainStatus {
  intact: boolean
  records: number
  head_hash: string
  broken_at?: number | null
  detail: string
}

export interface AuditRecord {
  id: string
  sequence: number
  timestamp: string
  officer_id: string
  action: string
  case_id?: string | null
  payload: Record<string, unknown>
  payload_hash: string
  previous_hash: string
  record_hash: string
}

/** Events delivered over the live stream while a screening runs. */
export type StreamEvent =
  | { type: 'case.start'; case_id: string; documents: number }
  | { type: 'document.start'; document_id: string; doc_type: string; modules: string[] }
  | { type: 'module.start'; document_id: string; module: string }
  | {
      type: 'module.complete'
      document_id: string
      module: string
      duration_ms: number
      error?: string | null
    }
  | { type: 'check'; document_id: string; sequence: number; check: Check }
  | { type: 'document.complete'; document_id: string; verdict: Verdict; reason: string }
  | {
      type: 'case.complete'
      case_id: string
      verdict: Verdict
      reason: string
      duration_ms: number
      needs_retake: boolean
    }
  | { type: 'case.failed'; case_id: string; error: string }
  | {
      type: 'case.state'
      case_id: string
      status: CaseStatus
      verdict?: Verdict | null
      reason?: string | null
      duration_ms?: number | null
      error?: string | null
    }
  | { type: 'timeout'; message: string }

export const DOC_TYPES = ['aadhaar', 'pan', 'passport', 'visa', 'unknown'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  passport: 'Passport',
  visa: 'Visa',
  unknown: 'Unidentified',
}

/* ------------------------------------------------------------------ stats */

export interface Totals {
  total: number
  clear: number
  reject: number
  refer: number
  pending: number
  failed: number
  clear_share: number
  reject_share: number
  refer_share: number
}

export interface Overview {
  window_days: number
  period: Totals
  all_time: Totals
  /** `null` when there is no previous period to compare against. */
  change_percent: number | null
  mean_duration_ms: number | null
  unique_identities: number
}

export interface TrendPoint {
  date: string
  clear: number
  reject: number
  refer: number
}

export interface Analytics {
  overview: Overview
  trend: TrendPoint[]
  document_types: Array<{ doc_type: string; count: number; share: number }>
  rejection_reasons: Array<{ reason: string; count: number; share: number }>
  check_outcomes: Partial<Record<CheckResult, number>>
  identity_links: {
    encounters_stored: number
    distinct_document_numbers: number
    flagged: number
  }
  high_risk: Array<{
    case_id: string
    created_at: string | null
    doc_types: string[]
    verdict: Verdict
    reason: string
    severity: Severity
  }>
  /** Deliberately null — no lawful corpus exists to measure against. */
  accuracy: number | null
  accuracy_note: string
  geography: null
  geography_note: string
}

/* ------------------------------------------------------------------ faces */

export interface FaceStatus {
  available: boolean
  requirement: string
  encounters_stored: number
  distinct_document_numbers: number
  note: string
}

export interface FaceMatch {
  encounter_id: string
  case_id: string
  similarity: number
  doc_type: string | null
  doc_number: string | null
  name: string | null
  captured_at: string | null
  verdict: Verdict | null
}

export interface FaceSearchResult {
  face: { bbox: BBox; pixels: number; detection_score: number }
  threshold: number
  matches: FaceMatch[]
  multiple_identity: boolean
  distinct_document_numbers: string[]
  officer_id: string
}

/* ----------------------------------------------------------------- system */

export interface SystemSettings {
  organisation: { name: string; system: string; problem_statement: string; environment: string }
  storage: {
    backend: string
    execution: string
    upload_dir: string
    model_dir: string
    max_upload_mb: number
  }
  verification: {
    face_match_threshold: number
    face_no_match_threshold: number
    face_min_pixels: number
    forensic_report_threshold: number
    note: string
  }
  modules: Record<string, boolean>
  ocr_engines: Record<string, boolean>
  aadhaar_certificate: boolean
  audit: { intact: boolean; records: number; head_hash: string }
  offline_capable: boolean
  /** Present in the design, absent from the build. Shown as such. */
  not_implemented: string[]
}

export interface Officers {
  configured_officer: string
  officers: Array<{
    officer_id: string
    actions: number
    last_action: string | null
    role: string
    source: string
  }>
  authentication: boolean
  note: string
}
