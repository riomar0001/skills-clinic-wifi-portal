import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EXPIRY_PRESETS, expiryFromNow, fromLocalInput, toLocalInput } from '@/lib/expiry'
import { cn } from '@/lib/utils'

interface ExpiryPickerProps {
  /** Unix seconds, or null for "never expires". */
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  'aria-describedby'?: string
}

/** Quick presets plus an exact date and time for when a Wi-Fi account stops working. */
export function ExpiryPicker({ value, onChange, id, ...aria }: ExpiryPickerProps) {
  const [preset, setPreset] = useState<string>(value === null ? 'Never' : 'Custom')

  const pick = (label: string, days: number | null) => {
    setPreset(label)
    onChange(days === null ? null : expiryFromNow(days))
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Expiry presets">
        {EXPIRY_PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            size="sm"
            variant={preset === p.label ? 'default' : 'outline'}
            aria-pressed={preset === p.label}
            onClick={() => pick(p.label, p.days)}
          >
            {p.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant={preset === 'Custom' ? 'default' : 'outline'} aria-pressed={preset === 'Custom'}
          onClick={() => { setPreset('Custom'); if (value === null) onChange(expiryFromNow(7)) }}>
          Custom
        </Button>
      </div>
      <Input
        id={id}
        {...aria}
        type="datetime-local"
        className={cn(value === null && 'hidden')}
        value={value === null ? '' : toLocalInput(value)}
        min={toLocalInput(expiryFromNow(0))}
        onChange={(e) => {
          setPreset('Custom')
          const next = fromLocalInput(e.target.value)
          if (next !== null) onChange(next)
        }}
      />
    </div>
  )
}
