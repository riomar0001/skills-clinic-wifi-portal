import { Navigate, createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AccessRequestsPage } from '@/features/access-requests/AccessRequestsPage'
import { RequestAccessPage } from '@/features/access-requests/RequestAccessPage'
import { AccountPage } from '@/features/account/AccountPage'
import { ActivityPage } from '@/features/activity/ActivityPage'
import { AdminsPage } from '@/features/admins/AdminsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { SetupPage } from '@/features/auth/SetupPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { MeLayout } from '@/features/me/MeLayout'
import { MePage } from '@/features/me/MePage'
import { ServerPage } from '@/features/server/ServerPage'
import { WifiUserDetailPage } from '@/features/wifi-users/WifiUserDetailPage'
import { WifiUsersPage } from '@/features/wifi-users/WifiUsersPage'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  // One sign-in page for admins and Wi-Fi users; it sends each to their own area.
  { path: '/login', element: <LoginPage /> },
  { path: '/setup', element: <SetupPage /> },
  { path: '/request-access', element: <RequestAccessPage /> },
  // Old address of the Wi-Fi password page; links shared earlier still work.
  { path: '/change-password', element: <Navigate to="/me" replace /> },
  {
    path: '/me',
    element: <RequireAuth role="wifi" />,
    children: [{ element: <MeLayout />, children: [{ index: true, element: <MePage /> }] }],
  },
  {
    element: <RequireAuth role="admin" />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'wifi-users', element: <WifiUsersPage /> },
          { path: 'wifi-users/:username', element: <WifiUserDetailPage /> },
          { path: 'access-requests', element: <AccessRequestsPage /> },
          { path: 'admins', element: <AdminsPage /> },
          { path: 'activity', element: <ActivityPage /> },
          { path: 'server', element: <ServerPage /> },
          { path: 'account', element: <AccountPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
