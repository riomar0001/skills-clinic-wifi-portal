import { Activity } from 'lucide-react'
import { errorMessage } from '../../api/client'
import { Card, EmptyState, ErrorNotice, PageHeader, Spinner } from '../../components/ui/misc'
import { useActivity } from './api'
import { ActivityList } from './ActivityList'

export function ActivityPage() {
  const activity = useActivity()
  return (
    <>
      <PageHeader title="Activity" description="Who changed what, newest first (last 200 events)." />
      <Card>
        {activity.isPending ? (
          <Spinner />
        ) : activity.isError ? (
          <ErrorNotice message={errorMessage(activity.error)} onRetry={() => activity.refetch()} />
        ) : activity.data.length === 0 ? (
          <EmptyState icon={<Activity size={22} />} title="Nothing yet" />
        ) : (
          <ActivityList entries={activity.data} />
        )}
      </Card>
    </>
  )
}
