import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, CircleX, Plus, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '../../api/client'
import type { Dashboard } from '../../api/types'
import { ButtonLink } from '../../components/ui/Button'
import { Card, ErrorNotice, PageHeader, Spinner } from '../../components/ui/misc'
import { formatDate } from '../../lib/format'
import { ActivityList } from '../activity/ActivityList'

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/api/dashboard'),
    refetchInterval: 30_000,
  })
}

function Stat({ label, value, icon, to }: { label: string; value: number; icon: ReactNode; to: string }) {
  return (
    <Link to={to} className="stat">
      <span className="stat-icon" aria-hidden>{icon}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  )
}

export function DashboardPage() {
  const dashboard = useDashboard()

  return (
    <>
      <PageHeader
        title="Dashboard"
        actions={<ButtonLink to="/wifi-users?new=1" variant="primary" icon={<Plus size={16} />}>Add Wi-Fi user</ButtonLink>}
      />
      {dashboard.isPending ? (
        <Spinner />
      ) : dashboard.isError ? (
        <ErrorNotice message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
      ) : (
        <div className="stack-lg">
          <div className="stats">
            <Stat label="Wi-Fi users" value={dashboard.data.wifi_total} icon={<Users size={18} />} to="/wifi-users" />
            <Stat label="Active" value={dashboard.data.wifi_enabled} icon={<UserCheck size={18} />} to="/wifi-users?status=enabled" />
            <Stat label="Disabled" value={dashboard.data.wifi_disabled} icon={<UserX size={18} />} to="/wifi-users?status=disabled" />
            <Stat label="Admins" value={dashboard.data.admins} icon={<ShieldCheck size={18} />} to="/admins" />
          </div>

          <div className="grid-2">
            <div className="stack">
              <Card title="Login server">
                <div className={`status ${dashboard.data.radius.ok ? 'status-ok' : 'status-bad'}`}>
                  {dashboard.data.radius.ok ? <CircleCheck size={22} aria-hidden /> : <CircleX size={22} aria-hidden />}
                  <div>
                    <p className="status-title">{dashboard.data.radius.ok ? 'Running' : 'Not responding'}</p>
                    <p className="muted small">{dashboard.data.radius.detail}</p>
                  </div>
                </div>
              </Card>
              <Card title="Certificate" actions={<Link to="/server" className="link small">Details</Link>}>
                {dashboard.data.certificate ? (
                  <dl className="kv">
                    <dt>Name</dt>
                    <dd><code>{dashboard.data.certificate.name}</code></dd>
                    <dt>Valid until</dt>
                    <dd>{formatDate(dashboard.data.certificate.expires_at)}</dd>
                  </dl>
                ) : (
                  <p className="muted">The certificate couldn’t be read. Run setup.ps1 on the server.</p>
                )}
              </Card>
            </div>

            <Card
              title="Recent activity"
              actions={<Link to="/activity" className="link small">View all <ArrowRight size={14} aria-hidden /></Link>}
            >
              {dashboard.data.recent_activity.length === 0 ? (
                <p className="muted">Nothing yet.</p>
              ) : (
                <ActivityList entries={dashboard.data.recent_activity} />
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
