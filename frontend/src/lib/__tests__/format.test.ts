import { describe, expect, it } from 'vitest'
import { CHECK_TYPE_WEIGHT, fieldLabel, formatDuration } from '../format'
import type { CheckType } from '@/api/types'

describe('check type weighting', () => {
  it('describes every check type', () => {
    const types: CheckType[] = [
      'cryptographic',
      'structural',
      'cross_field',
      'biometric',
      'forensic',
      'quality',
      'policy',
    ]
    types.forEach((type) => expect(CHECK_TYPE_WEIGHT[type]).toBeTruthy())
  })

  it('never describes forensics as decisive', () => {
    expect(CHECK_TYPE_WEIGHT.forensic).not.toMatch(/decisive/i)
    expect(CHECK_TYPE_WEIGHT.forensic).toMatch(/indication/i)
  })

  it('describes signature and structure checks as decisive', () => {
    expect(CHECK_TYPE_WEIGHT.cryptographic).toMatch(/decisive/i)
    expect(CHECK_TYPE_WEIGHT.structural).toMatch(/decisive/i)
  })
})

describe('formatting', () => {
  it('formats durations readably', () => {
    expect(formatDuration(450)).toBe('450 ms')
    expect(formatDuration(2400)).toBe('2.4 s')
    expect(formatDuration(null)).toBe('—')
  })

  it('expands abbreviations officers would not read as words', () => {
    expect(fieldLabel('pan_number')).toBe('PAN Number')
    expect(fieldLabel('mrz')).toBe('MRZ')
    expect(fieldLabel('date_of_birth')).toBe('Date Of Birth')
  })
})
