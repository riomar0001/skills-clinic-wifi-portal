import { useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EXPIRY_PRESET_GROUPS, expiryFromNow, fromLocalInput, toLocalInput } from '@/lib/expiry'
import { formatDateTime } from '@/lib/format'

const NEVER = 'never'
const CUSTOM = 'custom'
const DEFAULT_CUSTOM_SECONDS = 7 * 86_400

interface ExpiryPickerProps {
  /** Unix seconds, or null for "never expires". */
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  'aria-describedby'?: string
}

/** Dropdown of access lengths (1 hour to 90 days), "Never", or an exact date and time. */
export function ExpiryPicker({ value, onChange, id, ...aria }: ExpiryPickerProps) {
  const [choice, setChoice] = useState(value === null ? NEVER : CUSTOM)

  const pick = (next: string) => {
    setChoice(next)
    if (next === NEVER) onChange(null)
    else if (next === CUSTOM) onChange(value ?? expiryFromNow(DEFAULT_CUSTOM_SECONDS))
    else onChange(expiryFromNow(Number(next)))
  }

  return (
    <div className="grid gap-2">
      <Select value={choice} onValueChange={pick}>
        <SelectTrigger id={id} {...aria} className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NEVER}>Never</SelectItem>
          {EXPIRY_PRESET_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectSeparator />
              <SelectLabel>{group.label}</SelectLabel>
              {group.presets.map((p) => (
                <SelectItem key={p.seconds} value={String(p.seconds)}>{p.label}</SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Exact date and time…</SelectItem>
        </SelectContent>
      </Select>

      {choice === CUSTOM && (
        <Input
          type="datetime-local"
          aria-label="Exact expiry date and time"
          className="sm:w-64"
          value={value === null ? '' : toLocalInput(value)}
          min={toLocalInput(expiryFromNow(0))}
          onChange={(e) => {
            const next = fromLocalInput(e.target.value)
            if (next !== null) onChange(next)
          }}
        />
      )}
      {choice !== NEVER && choice !== CUSTOM && value !== null && (
        <p className="text-xs text-muted-foreground">Ends {formatDateTime(value)}</p>
      )}
    </div>
  )
}
