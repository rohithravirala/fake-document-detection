import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { LoginPage } from '@/pages/LoginPage'

describe('LoginPage', () => {
  it('renders official sign-in portal with all required fields', () => {
    render(
      <AuthProvider>
        <BrowserRouter>
          <LoginPage />
        </BrowserRouter>
      </AuthProvider>,
    )

    // Heading
    expect(screen.getByRole('heading', { name: /Officer Portal Sign-In/i })).toBeInTheDocument()

    // Officer Full Name field ("user should in name")
    expect(screen.getByText(/Officer Full Name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. Ramu Gaddam/i)).toBeInTheDocument()

    // Official Email Address field ("with mail")
    expect(screen.getByText(/Official Email Address/i)).toBeInTheDocument()

    // Password field ("and passs")
    expect(screen.getByText(/^Password/i)).toBeInTheDocument()

    // Designation / Role selection
    expect(screen.getByText(/Designation \/ Role/i)).toBeInTheDocument()

    // Sign in button
    expect(screen.getByRole('button', { name: /Sign In to Verification Console/i })).toBeInTheDocument()

    // Quick sign in presets for contributors
    expect(screen.getByText(/Quick Sign-In as Project Officer/i)).toBeInTheDocument()
    expect(screen.getByText('Ramu Gaddam')).toBeInTheDocument()
  })
})
