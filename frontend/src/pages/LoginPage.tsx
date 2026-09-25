import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SvaramMark, DigitalIndiaMark, SihBadge } from '@/components/layout/Brand'
import { PRESET_OFFICERS, useAuth } from '@/lib/auth'
import { IconAlert, IconCheck, IconShield, IconUsers, IconLock } from '@/components/common/Icons'

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
    <div className="min-h-screen bg-canvas flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top national masthead */}
      <header className="border-b border-line bg-white/95 px-4 py-3 sm:px-8 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <SvaramMark className="h-8 w-8 shrink-0 drop-shadow-sm" />
            <div>
              <span className="text-[18px] font-extrabold tracking-[0.16em] text-navy-900">SVARAM</span>
              <span className="hidden sm:inline text-xs text-ink-muted ml-2 font-medium">| सत्यमेव जयते</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SihBadge className="hidden sm:inline-flex" />
            <DigitalIndiaMark className="h-6 text-navy-800" />
          </div>
        </div>
      </header>

      {/* Main Authentication Center */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-lg">
          {/* Header Card */}
          <div className="bg-white rounded-t-2xl border-t border-x border-line p-6 sm:p-8 text-center shadow-card relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 tri-rule" />
            <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 shadow-xs text-brand-600">
              <IconShield className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-950 sm:text-3xl">
              Officer Portal Sign-In
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-muted max-w-md mx-auto">
              Secure authentication for AI Document Screening & Forensic Fraud Verification Console.
            </p>
          </div>

          {/* Form Card Body */}
          <div className="bg-white border border-line p-6 sm:p-8 shadow-card space-y-5">
            {error ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-reject-border bg-reject-bg p-3.5 text-[12.5px] text-reject-dark font-medium animate-in fade-in">
                <IconAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-clear-border bg-clear-bg p-3.5 text-[12.5px] text-clear-dark font-medium animate-in fade-in">
                <IconCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Officer authenticated. Initializing cryptographic environment...</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-bold text-ink uppercase tracking-wider mb-1.5">
                  Officer Full Name <span className="text-reject">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramu Gaddam"
                  className="w-full rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-ink uppercase tracking-wider mb-1.5">
                  Official Email Address <span className="text-reject">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. officer@mha.gov.in"
                  className="w-full rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11.5px] font-bold text-ink uppercase tracking-wider">
                    Password <span className="text-reject">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-brand-600 hover:text-brand-800 font-bold"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter credential password"
                  className="w-full rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-ink uppercase tracking-wider mb-1.5">
                  Designation / Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-line bg-canvas/40 px-3.5 py-2.5 text-[13px] font-medium text-ink focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="Senior Verification Officer">Level 3 · Senior Verification Officer</option>
                  <option value="Lead System Administrator">Level 3 · Lead System Administrator</option>
                  <option value="Forensic Document Examiner">Level 2 · Forensic Document Examiner</option>
                  <option value="Supervisory Inspector">Level 2 · Supervisory Inspector</option>
                  <option value="Field Verification Officer">Level 1 · Field Verification Officer</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-navy-900 to-navy-800 px-4 py-3 text-[14px] font-bold text-white shadow-md transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Authenticating Credentials…</span>
                    </>
                  ) : (
                    <>
                      <IconLock className="h-4 w-4" />
                      <span>Sign In to Verification Console</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick 1-Click Persona Access */}
            <div className="border-t border-line/80 pt-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <IconUsers className="h-3.5 w-3.5 text-brand-600" />
                  Quick Sign-In as Project Officer
                </span>
                <span className="font-mono text-[10.5px] text-brand-700">1-Click Access</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_OFFICERS.map((preset, idx) => (
                  <button
                    key={preset.email}
                    type="button"
                    onClick={() => handleSelectPreset(idx)}
                    className="flex flex-col items-start p-2.5 text-left rounded-xl border border-line bg-canvas/50 hover:border-brand-400 hover:bg-brand-50/60 transition group cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-[11px] font-bold text-brand-800 group-hover:bg-brand-600 group-hover:text-white transition">
                        {preset.name.slice(0, 1)}
                      </span>
                      <span className="text-[12.5px] font-bold text-ink group-hover:text-brand-800 truncate">
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

          {/* Statutory Security Legal Disclaimer */}
          <div className="bg-canvas border-b border-x border-line rounded-b-2xl p-4 text-[11.5px] leading-relaxed text-ink-muted">
            <p className="flex items-start gap-1.5">
              <strong className="text-ink font-bold shrink-0">Legal Proof:</strong>
              <span>
                All verification events are digitally watermarked in compliance with Section 65B of the Indian Evidence Act.
              </span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-white px-4 py-3.5 md:px-8 text-center text-[12px] text-ink-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-ink">SVARAM · National Security Credential Screening</span>
          <span className="flex items-center gap-2">
            <span className="tri-rule h-1 w-10 rounded-full" />
            #SmartIndiaHackathon 2026 · Built for Bharat
          </span>
        </div>
      </footer>
    </div>
  )
}
