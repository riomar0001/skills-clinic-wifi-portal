import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function initials(username: string, fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  return (words[0] ?? username).slice(0, 2).toUpperCase()
}

export function UserAvatar({ username, fullName, className }: { username: string; fullName: string; className?: string }) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initials(username, fullName)}</AvatarFallback>
    </Avatar>
  )
}
