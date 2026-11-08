import { ChevronsUpDown } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Extra words that should find this option when typed, e.g. "6h". */
  keywords?: string[]
}

export interface ComboboxGroup {
  heading?: string
  options: ComboboxOption[]
}

interface ComboboxProps {
  groups: ComboboxGroup[]
  value: string
  onChange: (value: string) => void
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  // Passed through by FormField:
  id?: string
  'aria-describedby'?: string
}

/** shadcn Combobox (Popover + Command): a button that opens a searchable, grouped list. */
export function Combobox({ groups, value, onChange, searchPlaceholder = 'Search…', emptyText = 'No match.', className, id, ...aria }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} {...aria} type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn('w-full justify-between font-normal sm:w-64', className)}>
          {selected?.label ?? 'Choose…'}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((group, i) => (
              <Fragment key={group.heading ?? i}>
                {i > 0 && !group.heading && <CommandSeparator />}
                <CommandGroup heading={group.heading}>
                  {group.options.map((o) => (
                    <CommandItem key={o.value} value={o.label} keywords={o.keywords} data-checked={o.value === value}
                      onSelect={() => {
                        setOpen(false)
                        onChange(o.value)
                      }}>
                      {o.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
