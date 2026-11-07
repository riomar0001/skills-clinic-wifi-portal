import { Badge } from '@/components/ui/badge'
import type { UserStatus as Status } from '@/lib/expiry'
import { cn } from '@/lib/utils'

const STYLES: Record<Status, { label: string; badge: string; dot: string }> = {
  active: { label: 'Active', badge: 'border-success/30 text-success', dot: 'bg-success' },
  expired: { label: 'Expired', badge: 'border-amber-500/30 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  disabled: { label: 'Disabled', badge: 'border-transparent bg-secondary text-muted-foreground', dot: 'bg-muted-foreground/60' },
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STYLES[status]
  return (
    <Badge variant="outline" className={cn('gap-1.5', s.badge)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </Badge>
  )
}
