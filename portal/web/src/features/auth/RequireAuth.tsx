import { Navigate, Outlet, useLocation } from 'react-router'
import { errorMessage } from '@/api/client'
import { ErrorAlert } from '@/components/common/states'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStatus } from './api'

/** Gate for signed-in pages: sends people to setup or sign-in when needed. */
export function RequireAuth() {
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
  if (!status.data.admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet context={status.data.admin} />
}
