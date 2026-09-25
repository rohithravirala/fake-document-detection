import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/** Bytes as a human-readable size, for the upload list. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Guess a document type from a filename, as a starting point only.
 *
 * The officer can always change it, and the backend re-classifies from the
 * image regardless — a filename is a hint, never evidence.
 */
export function guessDocType(filename: string): string {
  const name = filename.toLowerCase()
  if (name.includes('aadhaar') || name.includes('aadhar') || name.includes('uid')) return 'aadhaar'
  if (name.includes('pan')) return 'pan'
  if (name.includes('passport')) return 'passport'
  if (name.includes('visa')) return 'visa'
  if (name.includes('voter') || name.includes('epic') || name.includes('election')) return 'voter_id'
  if (name.includes('driving') || name.includes('licence') || name.includes('license') || name.includes('dl')) return 'driving_licence'
  return 'unknown'
}

/** Check if string is a well-formatted 12-digit Indian Aadhaar number */
export function isValidAadhaar(uid: string): boolean {
  const clean = uid.replace(/[\s-]/g, '')
  return /^[2-9]\d{11}$/.test(clean)
}

/** Check if string is a valid Permanent Account Number (PAN) format */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase())
}

/** Check if string is a valid Voter ID / EPIC card number format */
export function isValidVoterId(epic: string): boolean {
  return /^[A-Z]{3}[0-9]{7}$/.test(epic.trim().toUpperCase())
}

/** Classify risk level based on numerical fraud or anomaly score */
export function getRiskClassification(score: number): {
  level: 'low' | 'medium' | 'high' | 'critical'
  color: string
  label: string
} {
  if (score >= 0.85) return { level: 'critical', color: 'text-red-500', label: 'Severe Anomaly' }
  if (score >= 0.6) return { level: 'high', color: 'text-amber-500', label: 'High Concern' }
  if (score >= 0.3) return { level: 'medium', color: 'text-yellow-500', label: 'Moderate Risk' }
  return { level: 'low', color: 'text-emerald-500', label: 'Clear / Compliant' }
}

/** Safely copy text to clipboard with fallback */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

