import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SvaramMark, DigitalIndiaMark } from '@/components/layout/Brand'
import { PRESET_OFFICERS, useAuth } from '@/lib/auth'
import { IconAlert, IconCheck, IconShield, IconUsers } from '@/components/common/Icons'

export function LoginPage() {
  const { login, switchPresetOfficer, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [name, setName] = useState(user?.name || 'Ramu Gaddam')
  const [email, setEmail] = useState(user?.email || 'ramugaddam8899@gmail.com')
  const [password, setPassword] = useState('officerSecurePass2026')
  const [role, setRole] = useState(user?.role || 'Senior Verification Officer')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Please enter the officer name.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid official email address.')
      return
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.')
      return
    }

    setLoading(true)
    try {
      await login({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      })
      setSuccess(true)
      setTimeout(() => {
        navigate(from, { replace: true })
      }, 400)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPreset = async (index: number) => {
    setError(null)
    setLoading(true)
    try {
      await switchPresetOfficer(index)
      const p = PRESET_OFFICERS[index]
      setName(p.name)
      setEmail(p.email)
      setRole(p.role)
      setSuccess(true)
      setTimeout(() => {
        navigate(from, { replace: true })
      }, 400)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not switch officer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-between">
      {/* Top national bar */}
      <header className="border-b border-line bg-white px-4 py-2.5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <SvaramMark className="h-8 w-8 shrink-0" />
            <div>
              <span className="text-[17px] font-bold tracking-[0.16em] text-navy-800">SVARAM</span>
              <span className="hidden sm:inline text-xs text-ink-muted ml-2">| सत्यमेव जयते</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DigitalIndiaMark className="h-6 text-navy-800" />
            <span className="hidden md:inline rounded bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 border border-brand-200">
              #SIH2026 Portal
            </span>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-xl">
          {/* Svaram Header Card */}
          <div className="bg-white rounded-t-card border-t border-x border-line p-6 sm:p-8 text-center shadow-card relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 tri-rule" />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200 shadow-sm text-brand-700">
              <IconShield className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">
              Officer Portal Sign-In
            </h1>
            <p className="mt-1.5 text-[13.5px] text-ink-muted">
              Enter your credentials to access the AI Document Fraud & Identity Screening Console
            </p>
          </div>

          {/* Form Card Body */}
          <div className="bg-white border border-line p-6 sm:p-8 shadow-card">
            {error ? (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-reject-border bg-reject-bg p-3.5 text-[13px] text-reject-dark">
                <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-clear-border bg-clear-bg p-3.5 text-[13px] text-clear-dark">
                <IconCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Credentials verified. Redirecting to verification console...</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Officer Full Name */}
              <div>
                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Officer Full Name <span className="text-reject">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramu Gaddam"
                    className="w-full rounded-md border border-line bg-canvas/40 px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Name will appear on case screening logs, cryptographic audit chain, and case history.
                </p>
              </div>

              {/* Official Email */}
              <div>
                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Official Email Address <span className="text-reject">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. officer@svaram.gov.in"
                  className="w-full rounded-md border border-line bg-canvas/40 px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider">
                    Password <span className="text-reject">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11.5px] text-brand-600 hover:text-brand-800 font-medium"
                  >
                    {showPassword ? 'Hide' : 'Show'} password
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your security password"
                  className="w-full rounded-md border border-line bg-canvas/40 px-3.5 py-2.5 text-[14px] text-ink placeholder-ink-faint transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Designation / Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-[13.5px] text-ink transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="Senior Verification Officer">Senior Verification Officer</option>
                  <option value="Lead System Administrator">Lead System Administrator</option>
                  <option value="Forensic Document Examiner">Forensic Document Examiner</option>
                  <option value="Supervisory Inspector">Supervisory Inspector</option>
                  <option value="Field Verification Officer">Field Verification Officer</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-navy-800 px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-navy-900 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Authenticating Officer...</span>
                    </>
                  ) : (
                    <>
                      <IconShield className="h-4 w-4" />
                      <span>Sign In to Verification Console</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Demo Switcher */}
            <div className="mt-6 border-t border-line pt-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <IconUsers className="h-3.5 w-3.5" />
                  Quick Sign-In as Project Officer
                </span>
                <span className="text-[11px] text-ink-faint">1-Click Access</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_OFFICERS.map((preset, idx) => (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={() => handleSelectPreset(idx)}
                    className="flex flex-col items-start p-2.5 text-left rounded-lg border border-line hover:border-brand-400 hover:bg-brand-50/50 transition group"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-800 group-hover:bg-brand-200">
                        {preset.name.slice(0, 1)}
                      </span>
                      <span className="text-[12.5px] font-semibold text-ink group-hover:text-brand-800 truncate">
                        {preset.name}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-ink-muted truncate w-full mt-1">
                      {preset.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Statutory Security Disclaimer */}
          <div className="bg-canvas border-b border-x border-line rounded-b-card p-4 text-[11px] leading-relaxed text-ink-muted">
            <p className="flex items-start gap-1.5">
              <strong className="text-ink font-semibold shrink-0">Statutory Notice:</strong>
              <span>
                Authorized Government of India & SIH evaluation personnel only. All logins and screening actions are cryptographically chained in compliance with Section 65B of the Indian Evidence Act.
              </span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-white px-4 py-3 md:px-8 text-center text-[12px] text-ink-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <span>SVARAM Document Authentication Platform</span>
          <span className="flex items-center gap-2">
            <span className="tri-rule h-1 w-10 rounded-full" />
            #SmartIndiaHackathon 2026 · Built for Bharat
          </span>
        </div>
      </footer>
    </div>
  )
}
