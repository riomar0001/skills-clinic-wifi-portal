import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarX, CircleCheck, CircleX, Plus, UserCheck, UserX, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage } from '@/api/client'
import type { Dashboard } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert, PageSkeleton } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ActivityList } from '../activity/ActivityList'

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/api/dashboard'),
    refetchInterval: 30_000,
  })
}

function StatCard({ label, value, icon: Icon, to }: { label: string; value: number; icon: LucideIcon; to: string }) {
  return (
    <Link to={to} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:bg-muted/40">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="font-mono text-3xl font-semibold tabular-nums">{value}</CardTitle>
          <CardAction>
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
              <Icon className="size-4" />
            </span>
          </CardAction>
        </CardHeader>
      </Card>
    </Link>
  )
}

const SOON_MS = 30 * 86_400_000

export function DashboardPage() {
  const dashboard = useDashboard()
  const [loadedAt] = useState(() => Date.now()) // "expiring soon" needs a stable "now" per visit

  if (dashboard.isPending) return <PageSkeleton />
  if (dashboard.isError) return <ErrorAlert message={errorMessage(dashboard.error)} onRetry={() => dashboard.refetch()} />
  const d = dashboard.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of Wi-Fi access."
        actions={<Button asChild><Link to="/wifi-users?new=1"><Plus /> Add Wi-Fi user</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wi-Fi users" value={d.wifi_total} icon={Users} to="/wifi-users" />
        <StatCard label="Active" value={d.wifi_active} icon={UserCheck} to="/wifi-users?status=active" />
        <StatCard label="Expired" value={d.wifi_expired} icon={CalendarX} to="/wifi-users?status=expired" />
        <StatCard label="Disabled" value={d.wifi_disabled} icon={UserX} to="/wifi-users?status=disabled" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="grid content-start gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Login server</CardTitle>
              <CardDescription>Checks Wi-Fi usernames and passwords for the router.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={cn('flex items-start gap-3 rounded-lg border p-3', d.radius.ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
                {d.radius.ok
                  ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  : <CircleX className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />}
                <div className="grid gap-0.5">
                  <span className="font-medium">{d.radius.ok ? 'Running' : 'Not responding'}</span>
                  <span className="text-sm text-muted-foreground">{d.radius.detail}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Certificate</CardTitle>
              <CardDescription>What phones see when they first join.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild><Link to="/server">Details <ArrowRight /></Link></Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {d.certificate ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="truncate font-mono">{d.certificate.name}</dd>
                  <dt className="text-muted-foreground">Valid until</dt>
                  <dd className="flex items-center gap-2">
                    {formatDate(d.certificate.expires_at)}
                    {d.certificate.expires_at * 1000 - loadedAt < SOON_MS &&<Badge variant="destructive">Expiring soon</Badge>}
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">The certificate couldn’t be read. Run setup.ps1 on the server.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest changes by admins and users.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild><Link to="/activity">View all <ArrowRight /></Link></Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {d.recent_activity.length === 0
              ? <p className="text-sm text-muted-foreground">Nothing yet.</p>
              : <ActivityList entries={d.recent_activity} />}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
