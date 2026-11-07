import { Activity } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorAlert, ListSkeleton } from '@/components/common/states'
import { Card, CardContent } from '@/components/ui/card'
import { useActivity } from './api'
import { ActivityList } from './ActivityList'

export function ActivityPage() {
  const activity = useActivity()
  return (
    <>
      <PageHeader title="Activity" description="Who changed what, newest first (last 200 events)." />
      <Card>
        <CardContent>
          {activity.isPending ? (
            <ListSkeleton rows={6} />
          ) : activity.isError ? (
            <ErrorAlert message={errorMessage(activity.error)} onRetry={() => activity.refetch()} />
          ) : activity.data.length === 0 ? (
            <EmptyState icon={<Activity />} title="Nothing yet" />
          ) : (
            <ActivityList entries={activity.data} />
          )}
        </CardContent>
      </Card>
    </>
  )
}
