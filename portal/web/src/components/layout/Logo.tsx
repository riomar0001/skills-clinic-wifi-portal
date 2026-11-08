import logoUrl from '@/assets/logo.png'
import { cn } from '@/lib/utils'

/**
 * CCE Skills Clinic logo (src/assets/logo.png, from logo-original.png).
 * In dark mode it sits on a light tile so its charcoal half stays visible.
 * Wrapped in a span because sidebar buttons resize their direct children as icons.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg dark:bg-white dark:p-0.5', className)} aria-hidden>
      <img src={logoUrl} alt="" className="size-full object-contain" draggable={false} />
    </span>
  )
}
