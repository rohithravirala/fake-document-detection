/** Presentation helpers shared across screens. */

import { format, formatDistanceToNowStrict } from 'date-fns'
import type { CheckResult, CheckType, Severity, Verdict } from '@/api/types'

export const VERDICT_LABEL: Record<Verdict, string> = {
  clear: 'CLEAR',
  reject: 'REJECT',
  refer: 'REFER',
}

export const VERDICT_MEANING: Record<Verdict, string> = {
  clear: 'Verified against the issuing authority. Proceed.',
  reject: 'The document contradicts itself or its issuer. Do not accept.',
  refer: 'The evidence does not reach a conclusion. Send to an examiner.',
}

export const CHECK_TYPE_LABEL: Record<CheckType, string> = {
  cryptographic: 'Signature',
  structural: 'Structure',
  cross_field: 'Cross-check',
  biometric: 'Face',
  forensic: 'Tampering',
  quality: 'Capture',
  policy: 'Validity',
}

/**
 * How much weight a check's evidence carries.
 *
 * Shown in the interface because it is the difference between "the issuing
 * authority's signature verified" and "this region looks unusual", and an
 * officer acting on the result needs to know which they are reading.
 */
export const CHECK_TYPE_WEIGHT: Record<CheckType, string> = {
  cryptographic: 'Decisive — verified against the issuing authority',
  structural: "Decisive — the document's own arithmetic",
  cross_field: 'Decisive — two parts of the document compared',
  biometric: 'Identifies the bearer, not the document',
  forensic: 'Indication only — never proof either way',
  quality: 'Governs whether analysis is meaningful',
  policy: 'Validity rules, not authenticity',
}

export const RESULT_LABEL: Record<CheckResult, string> = {
  pass: 'Pass',
  fail: 'Fail',
  inconclusive: 'Inconclusive',
  unavailable: 'Could not run',
  retake: 'Retake needed',
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'd MMM yyyy, HH:mm:ss')
  } catch {
    return value
  }
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return `${formatDistanceToNowStrict(new Date(value))} ago`
  } catch {
    return '—'
  }
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function fieldLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bQr\b/, 'QR')
    .replace(/\bMrz\b/, 'MRZ')
    .replace(/\bPan\b/, 'PAN')
    .replace(/\bDob\b/, 'Date of Birth')
}
