import { cn } from '@/lib/utils'

/**
 * CCE Skills Clinic mark: two interlocking hooks in a rotated square (same geometry as src/assets/logo.svg).
 * The charcoal hook turns light in dark mode so the mark stays visible on dark backgrounds.
 * Wrapped in a span because sidebar buttons shrink direct <svg> children to icon size.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center', className)} aria-hidden>
      <svg viewBox="-15 -15 130 130" className="size-full">
        <g transform="rotate(45 50 50)" fill="none" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round">
          <path d="M37.1 88.5 H11.5 V11.5 H37.2 V62.8" stroke="#FDDB52" />
          <path d="M62.9 11.5 H88.5 V88.5 H62.8 V37.2" className="stroke-[#33323C] dark:stroke-[#E8E7EC]" />
        </g>
      </svg>
    </span>
  )
}
