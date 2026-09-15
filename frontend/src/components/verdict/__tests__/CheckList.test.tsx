import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CheckList } from '../CheckList'
import type { Check } from '@/api/types'

function check(overrides: Partial<Check>): Check {
  return {
    id: Math.random().toString(36).slice(2),
    check_id: 'x.y',
    check_type: 'cross_field',
    result: 'pass',
    severity: 'info',
    citation: 'A citation.',
    module: 'test',
    sequence: 1,
    evidence: [],
    ...overrides,
  }
}

describe('CheckList', () => {
  it('shows problems first, because that is what an officer needs', async () => {
    render(
      <CheckList
        checks={[
          check({ result: 'pass', citation: 'The format is valid.' }),
          check({ result: 'fail', severity: 'critical', citation: 'The name does not match.' }),
        ]}
      />,
    )
    expect(screen.getByText('The name does not match.')).toBeInTheDocument()
    expect(screen.queryByText('The format is valid.')).not.toBeInTheDocument()
  })

  it('distinguishes "could not run" from "failed"', async () => {
    render(
      <CheckList
        checks={[
          check({
            result: 'unavailable',
            citation: 'No UIDAI certificate is provisioned.',
          }),
        ]}
      />,
    )
    expect(screen.getByText('Could not run')).toBeInTheDocument()
    expect(screen.queryByText('Fail')).not.toBeInTheDocument()
  })

  it('reveals the expected and observed values behind a failure', async () => {
    const user = userEvent.setup()
    render(
      <CheckList
        checks={[
          check({
            result: 'fail',
            citation: 'The name does not match.',
            evidence: [
              { note: 'printed name contradicts the QR', expected: 'ANITA SHARMA', observed: 'PRIYA VERMA' },
            ],
          }),
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /evidence/i }))
    expect(screen.getByText('ANITA SHARMA')).toBeInTheDocument()
    expect(screen.getByText('PRIYA VERMA')).toBeInTheDocument()
  })

  it('labels a forensic signal as an indication, not proof', async () => {
    render(
      <CheckList
        checks={[
          check({
            check_type: 'forensic',
            result: 'fail',
            severity: 'medium',
            citation: 'A block was copied.',
          }),
        ]}
      />,
    )
    expect(screen.getByText(/never proof either way/i)).toBeInTheDocument()
  })
})
