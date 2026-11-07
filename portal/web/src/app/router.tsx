import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AccountPage } from '@/features/account/AccountPage'
import { ActivityPage } from '@/features/activity/ActivityPage'
import { AdminsPage } from '@/features/admins/AdminsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { SetupPage } from '@/features/auth/SetupPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ServerPage } from '@/features/server/ServerPage'
import { WifiUserDetailPage } from '@/features/wifi-users/WifiUserDetailPage'
import { WifiUsersPage } from '@/features/wifi-users/WifiUsersPage'
import { NotFoundPage } from './NotFoundPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/setup', element: <SetupPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'wifi-users', element: <WifiUsersPage /> },
          { path: 'wifi-users/:username', element: <WifiUserDetailPage /> },
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
