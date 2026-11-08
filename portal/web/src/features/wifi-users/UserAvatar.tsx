import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function initials(username: string, first: string, last: string): string {
  const letters = `${first.trim().charAt(0)}${last.trim().charAt(0)}`
  return (letters || username.slice(0, 2)).toUpperCase()
}

interface UserAvatarProps {
  username: string
  firstName: string
  lastName: string
  className?: string
}

export function UserAvatar({ username, firstName, lastName, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{initials(username, firstName, lastName)}</AvatarFallback>
    </Avatar>
  )
}
