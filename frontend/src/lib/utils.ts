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
  return 'unknown'
}
