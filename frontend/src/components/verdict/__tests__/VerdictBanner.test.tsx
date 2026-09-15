import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerdictBanner } from '../VerdictBanner'

describe('VerdictBanner', () => {
  it('shows the verdict and its reason', () => {
    render(
      <VerdictBanner
        verdict="reject"
        reason="The name printed on the card contradicts the signed QR."
        durationMs={2400}
      />,
    )
    expect(screen.getByText('REJECT')).toBeInTheDocument()
    expect(screen.getByText(/contradicts the signed QR/)).toBeInTheDocument()
  })

  it('never renders a confidence percentage', () => {
    // The interface shows a verdict and a sentence. A number an officer cannot
    // defend afterwards is worse than nothing, so none is rendered anywhere.
    const { container } = render(
      <VerdictBanner verdict="clear" reason="The QR carries a valid UIDAI signature." />,
    )
    expect(container.textContent).not.toMatch(/\d+\s*%/)
  })

  it('says a retake is a capture problem, not a finding', () => {
    render(
      <VerdictBanner verdict="refer" reason="Image is out of focus." needsRetake />,
    )
    expect(screen.getByText(/not a finding about the document/i)).toBeInTheDocument()
  })
})
