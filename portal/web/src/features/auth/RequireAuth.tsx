import { Navigate, Outlet, useLocation } from 'react-router'
import { errorMessage } from '@/api/client'
import type { Role } from '@/api/types'
import { ErrorAlert } from '@/components/common/states'
import { Skeleton } from '@/components/ui/skeleton'
import { HOME_FOR, useAuthStatus } from './api'

/**
 * Gate for signed-in pages of one kind (admin or Wi-Fi user). Sends people to setup, the shared
 * sign-in page, or their own area if they are the other kind. The API enforces this too.
 */
export function RequireAuth({ role }: { role: Role }) {
  const status = useAuthStatus()
  const location = useLocation()

  if (status.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Skeleton className="size-10 rounded-full" />
      </div>
    )
  }
  if (status.isError) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center p-6">
        <ErrorAlert title="Can’t load the portal" message={errorMessage(status.error)} onRetry={() => status.refetch()} />
      </div>
    )
  }
  if (status.data.needs_setup) return <Navigate to="/setup" replace />
  if (!status.data.role) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (status.data.role !== role) return <Navigate to={HOME_FOR[status.data.role]} replace />
  return <Outlet context={status.data.username} />
}
