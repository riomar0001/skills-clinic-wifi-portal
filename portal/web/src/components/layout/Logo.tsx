import { Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground', className)} aria-hidden>
      <Wifi className="size-4" strokeWidth={2.5} />
    </span>
  )
}
