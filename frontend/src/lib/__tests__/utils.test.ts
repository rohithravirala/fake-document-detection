import { describe, expect, it } from 'vitest'
import {
  cn,
  getRiskClassification,
  guessDocType,
  humanSize,
  isValidAadhaar,
  isValidPAN,
  isValidVoterId,
} from '../utils'

describe('utils', () => {
  it('combines class names with cn', () => {
    expect(cn('base-class', false && 'hidden', 'active')).toBe('base-class active')
  })

  it('formats byte sizes cleanly', () => {
    expect(humanSize(500)).toBe('500 B')
    expect(humanSize(2048)).toBe('2 KB')
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('guesses document types accurately from file name keywords', () => {
    expect(guessDocType('my_aadhaar_front.jpg')).toBe('aadhaar')
    expect(guessDocType('pan_card_scan.png')).toBe('pan')
    expect(guessDocType('passport_bio_page.pdf')).toBe('passport')
    expect(guessDocType('voter_id_card.png')).toBe('voter_id')
    expect(guessDocType('dl_front.webp')).toBe('driving_licence')
    expect(guessDocType('unknown_doc.dat')).toBe('unknown')
  })

  it('validates 12-digit Indian Aadhaar numbers', () => {
    expect(isValidAadhaar('234567890123')).toBe(true)
    expect(isValidAadhaar('2345 6789 0123')).toBe(true)
    expect(isValidAadhaar('012345678901')).toBe(false) // cannot start with 0
    expect(isValidAadhaar('123456789012')).toBe(false) // cannot start with 1
    expect(isValidAadhaar('12345')).toBe(false)
  })

  it('validates Indian PAN card format (5 letters, 4 numbers, 1 letter)', () => {
    expect(isValidPAN('ABCDE1234F')).toBe(true)
    expect(isValidPAN('abcde1234f')).toBe(true)
    expect(isValidPAN('ABCD12345F')).toBe(false)
    expect(isValidPAN('ABCDEF1234')).toBe(false)
  })

  it('validates Voter ID EPIC numbers (3 letters, 7 numbers)', () => {
    expect(isValidVoterId('ABC1234567')).toBe(true)
    expect(isValidVoterId('XYZ9876543')).toBe(true)
    expect(isValidVoterId('AB12345678')).toBe(false)
  })

  it('classifies risk levels properly', () => {
    expect(getRiskClassification(0.95).level).toBe('critical')
    expect(getRiskClassification(0.7).level).toBe('high')
    expect(getRiskClassification(0.4).level).toBe('medium')
    expect(getRiskClassification(0.1).level).toBe('low')
  })
})
