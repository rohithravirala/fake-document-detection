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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
