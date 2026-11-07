import { Badge } from '@/components/ui/badge'

export function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge variant="outline" className="gap-1.5 border-success/30 text-success">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      Active
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1.5 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
      Disabled
    </Badge>
  )
}
