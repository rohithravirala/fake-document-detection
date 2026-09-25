import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/lib/auth'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { VerifyPage } from '@/pages/VerifyPage'
import { CaseHistoryPage } from '@/pages/CaseHistoryPage'
import { CaseDetailPage } from '@/pages/CaseDetailPage'
import { FaceSearchPage } from '@/pages/FaceSearchPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { OfficersPage } from '@/pages/OfficersPage'
import { SettingsPage } from '@/pages/SettingsPage'

import { useEffect, useState } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
})

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="bg-amber-600 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-between text-center sticky top-0 z-50 shadow-md">
      <span>⚠️ Offline Mode Active — Local verification cache in use. Sync will resume automatically upon network reconnection.</span>
      <span className="font-mono text-[10px] bg-amber-700/60 px-2 py-0.5 rounded">STATION CACHE</span>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OfflineBanner />
        <BrowserRouter>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="verify" element={<VerifyPage />} />
              <Route path="verify/:caseId" element={<VerifyPage />} />
              <Route path="cases" element={<CaseHistoryPage />} />
              <Route path="cases/:caseId" element={<CaseDetailPage />} />
              <Route path="faces" element={<FaceSearchPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="officers" element={<OfficersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

