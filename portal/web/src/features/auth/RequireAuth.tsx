import { Navigate, Outlet, useLocation } from 'react-router'
import { errorMessage } from '../../api/client'
import { ErrorNotice, Spinner } from '../../components/ui/misc'
import { useAuthStatus } from './api'

/** Gate for signed-in pages: sends people to setup or sign-in when needed. */
export function RequireAuth() {
  const status = useAuthStatus()
  const location = useLocation()

  if (status.isPending) return <div className="page-center"><Spinner /></div>
  if (status.isError) {
    return (
      <div className="page-center">
        <ErrorNotice message={errorMessage(status.error)} onRetry={() => status.refetch()} />
      </div>
    )
  }
  if (status.data.needs_setup) return <Navigate to="/setup" replace />
  if (!status.data.admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet context={status.data.admin} />
}
