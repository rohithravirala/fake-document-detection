import React, { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export interface OfficerUser {
  id: string
  name: string
  email: string
  role: string
  badgeNumber: string
  token: string
  loginTime: string
  department?: string
}

export const PRESET_OFFICERS: Array<{
  name: string
  email: string
  role: string
  badgeNumber: string
  dept: string
}> = [
  {
    name: 'Ramu Gaddam',
    email: 'ramugaddam8899@gmail.com',
    role: 'Senior Verification Officer',
    badgeNumber: 'IN-RAM-7042',
    dept: 'Border Control & Document Forensics',
  },
  {
    name: 'Rohith Ravirala',
    email: 'raviralarohith5@gmail.com',
    role: 'Lead System Administrator',
    badgeNumber: 'IN-ROH-1001',
    dept: 'Identity Systems & Integrity Division',
  },
  {
    name: 'Akshay Nedunuri',
    email: 'akshaynedunuri17@gmail.com',
    role: 'Forensic Document Examiner',
    badgeNumber: 'IN-AKS-3210',
    dept: 'Physical & Digital Tamper Analysis',
  },
  {
    name: 'Kadiyam Tejesh',
    email: 'tejeshhhk@gmail.com',
    role: 'Supervisory Inspector',
    badgeNumber: 'IN-TEJ-8954',
    dept: 'Immigration & Intelligence Bureau',
  },
]

interface AuthContextType {
  user: OfficerUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: {
    name: string
    email: string
    password: string
    role?: string
    badgeNumber?: string
  }) => Promise<void>
  logout: () => Promise<void>
  switchPresetOfficer: (index: number) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'svaram_officer_session'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OfficerUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // Fallback
    }
    // Default initial demonstration officer
    const defaultOfficer = PRESET_OFFICERS[0]
    return {
      id: 'off_ramu7042',
      name: defaultOfficer.name,
      email: defaultOfficer.email,
      role: defaultOfficer.role,
      badgeNumber: defaultOfficer.badgeNumber,
      token: 'svaram_tok_demo_active',
      loginTime: new Date().toISOString(),
      department: defaultOfficer.dept,
    }
  })

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      } catch {
        // LocalStorage quota or access error
      }
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = async (credentials: {
    name: string
    email: string
    password: string
    role?: string
    badgeNumber?: string
  }) => {
    setIsLoading(true)
    const nameClean = credentials.name.trim()
    const emailClean = credentials.email.trim().toLowerCase()
    const roleClean = credentials.role || 'Verification Officer'

    try {
      // Try to communicate with backend auth endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameClean,
          email: emailClean,
          password: credentials.password,
          role: roleClean,
          badge_number: credentials.badgeNumber,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newUser: OfficerUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          badgeNumber: data.user.badge_number,
          token: data.user.token,
          loginTime: data.user.login_time,
          department: data.user.department,
        }
        setUser(newUser)
        return
      }
    } catch {
      // If backend network fails, proceed with client-verified fallback session
    } finally {
      setIsLoading(false)
    }

    // Client-side authentication fallback for offline/demo mode
    const initials = nameClean.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'OFF'
    const fallbackUser: OfficerUser = {
      id: `off_${Date.now()}`,
      name: nameClean,
      email: emailClean,
      role: roleClean,
      badgeNumber: credentials.badgeNumber || `IN-${initials}-${Math.floor(1000 + Math.random() * 9000)}`,
      token: `svaram_tok_${Math.random().toString(36).substring(2)}`,
      loginTime: new Date().toISOString(),
      department: 'Immigration & Document Fraud Prevention',
    }
    setUser(fallbackUser)
  }

  const switchPresetOfficer = async (index: number) => {
    const preset = PRESET_OFFICERS[index] || PRESET_OFFICERS[0]
    await login({
      name: preset.name,
      email: preset.email,
      password: 'presetDemoPassword2026',
      role: preset.role,
      badgeNumber: preset.badgeNumber,
    })
  }

  const logout = async () => {
    if (user?.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` },
        })
      } catch {
        // Ignore network errors on logout
      }
    }
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchPresetOfficer,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
