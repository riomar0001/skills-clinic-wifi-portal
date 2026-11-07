import { KeyRound, LogIn, Pencil, ShieldCheck, Trash2, UserCheck, UserPlus, UserX, Upload, type LucideIcon } from 'lucide-react'
import type { ActivityEntry } from '@/api/types'
import { formatDateTime, timeAgo } from '@/lib/format'
import { describeActivity } from './describe'

const ICONS: Record<string, LucideIcon> = {
  'wifi.create': UserPlus,
  'wifi.update': Pencil,
  'wifi.enable': UserCheck,
  'wifi.disable': UserX,
  'wifi.password': KeyRound,
  'wifi.delete': Trash2,
  'wifi.import': Upload,
  'wifi.self_password': KeyRound,
  'admin.login': LogIn,
}

export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ol className="grid gap-4">
      {entries.map((e) => {
        const Icon = ICONS[e.action] ?? ShieldCheck
        return (
          <li key={e.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>
              <Icon className="size-3.5" />
            </span>
            <p className="min-w-0 flex-1 text-sm leading-relaxed break-words">
              <span className="font-medium">{e.actor}</span> <span className="text-muted-foreground">{describeActivity(e)}</span>
            </p>
            <time dateTime={new Date(e.at * 1000).toISOString()} title={formatDateTime(e.at)}
              className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
              {timeAgo(e.at)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
