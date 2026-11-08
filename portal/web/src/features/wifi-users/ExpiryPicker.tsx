import { ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EXPIRY_PRESET_GROUPS, expiryFromNow, fromLocalInput, toLocalInput } from '@/lib/expiry'
import { formatDateTime } from '@/lib/format'

const NEVER = 'never'
const CUSTOM = 'custom'
const DEFAULT_CUSTOM_SECONDS = 7 * 86_400
const PRESET_LABELS = new Map(EXPIRY_PRESET_GROUPS.flatMap((g) => g.presets.map((p) => [String(p.seconds), p.label])))

/** Short forms people type: "6h", "2d", "1w". */
function shortForms(seconds: number): string[] {
  const hours = seconds / 3600
  const days = hours / 24
  const forms = hours < 24 ? [`${hours}h`, `${hours} hr`] : [`${days}d`]
  if (days >= 7 && days % 7 === 0) forms.push(`${days / 7}w`)
  return forms
}

interface ExpiryPickerProps {
  /** Unix seconds, or null for "never expires". */
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  'aria-describedby'?: string
}

/** Searchable list (shadcn Combobox) of access lengths from 1 hour to 90 days, "Never", or an exact date and time. */
export function ExpiryPicker({ value, onChange, id, ...aria }: ExpiryPickerProps) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState(value === null ? NEVER : CUSTOM)

  const pick = (next: string) => {
    setChoice(next)
    setOpen(false)
    if (next === NEVER) onChange(null)
    else if (next === CUSTOM) onChange(value ?? expiryFromNow(DEFAULT_CUSTOM_SECONDS))
    else onChange(expiryFromNow(Number(next)))
  }

  const label = choice === NEVER ? 'Never' : choice === CUSTOM ? 'Exact date and time' : PRESET_LABELS.get(choice)

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} {...aria} type="button" variant="outline" role="combobox" aria-expanded={open}
            className="w-full justify-between font-normal sm:w-64">
            {label}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search, e.g. 6h or 30 days…" />
            <CommandList>
              <CommandEmpty>No matching length.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="Never" keywords={['no expiry', 'forever']} data-checked={choice === NEVER}
                  onSelect={() => pick(NEVER)}>
                  Never
                </CommandItem>
              </CommandGroup>
              {EXPIRY_PRESET_GROUPS.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.presets.map((p) => (
                    <CommandItem key={p.seconds} value={p.label} keywords={shortForms(p.seconds)}
                      data-checked={choice === String(p.seconds)} onSelect={() => pick(String(p.seconds))}>
                      {p.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="Exact date and time" keywords={['custom', 'date', 'calendar']}
                  data-checked={choice === CUSTOM} onSelect={() => pick(CUSTOM)}>
                  Exact date and time…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
