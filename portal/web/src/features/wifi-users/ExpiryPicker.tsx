import { useState } from 'react'
import { Combobox, type ComboboxGroup } from '@/components/common/Combobox'
import { Input } from '@/components/ui/input'
import { EXPIRY_PRESET_GROUPS, expiryFromNow, fromLocalInput, toLocalInput } from '@/lib/expiry'
import { formatDateTime } from '@/lib/format'

const NEVER = 'never'
const CUSTOM = 'custom'
const DEFAULT_CUSTOM_SECONDS = 7 * 86_400

/** Short forms people type: "6h", "2d", "1w". */
function shortForms(seconds: number): string[] {
  const hours = seconds / 3600
  const days = hours / 24
  const forms = hours < 24 ? [`${hours}h`, `${hours} hr`] : [`${days}d`]
  if (days >= 7 && days % 7 === 0) forms.push(`${days / 7}w`)
  return forms
}

const GROUPS: ComboboxGroup[] = [
  { options: [{ value: NEVER, label: 'Never', keywords: ['no expiry', 'forever'] }] },
  ...EXPIRY_PRESET_GROUPS.map((g) => ({
    heading: g.label,
    options: g.presets.map((p) => ({ value: String(p.seconds), label: p.label, keywords: shortForms(p.seconds) })),
  })),
  { options: [{ value: CUSTOM, label: 'Exact date and time…', keywords: ['custom', 'date', 'calendar'] }] },
]

interface ExpiryPickerProps {
  /** Unix seconds, or null for "never expires". */
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  'aria-describedby'?: string
}

/** Access length from 1 hour to 90 days, "Never", or an exact date and time. */
export function ExpiryPicker({ value, onChange, ...field }: ExpiryPickerProps) {
  const [choice, setChoice] = useState(value === null ? NEVER : CUSTOM)

  const pick = (next: string) => {
    setChoice(next)
    if (next === NEVER) onChange(null)
    else if (next === CUSTOM) onChange(value ?? expiryFromNow(DEFAULT_CUSTOM_SECONDS))
    else onChange(expiryFromNow(Number(next)))
  }

  return (
    <div className="grid gap-2">
      <Combobox {...field} groups={GROUPS} value={choice} onChange={pick}
        searchPlaceholder="Search, e.g. 6h or 30 days…" emptyText="No matching length." />
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
