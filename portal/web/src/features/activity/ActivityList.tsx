import type { ActivityEntry } from '../../api/types'
import { formatDateTime, timeAgo } from '../../lib/format'
import { describeActivity } from './describe'

export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ol className="timeline">
      {entries.map((e) => (
        <li key={e.id}>
          <span className="timeline-dot" aria-hidden />
          <p>
            <b>{e.actor}</b> {describeActivity(e)}
          </p>
          <time dateTime={new Date(e.at * 1000).toISOString()} title={formatDateTime(e.at)} className="muted small">
            {timeAgo(e.at)}
          </time>
        </li>
      ))}
    </ol>
  )
}
