import { Combobox, type ComboboxGroup } from '@/components/common/Combobox'

const NONE = 'none'

const GROUPS: ComboboxGroup[] = [
  { options: [{ value: NONE, label: 'No limit', keywords: ['unlimited', 'any'] }] },
  {
    heading: 'Devices',
    options: [1, 2, 3, 4, 5, 10].map((n) => ({ value: String(n), label: n === 1 ? '1 device' : `${n} devices` })),
  },
]

interface DeviceLimitPickerProps {
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  'aria-describedby'?: string
}

/** How many devices may use an account: none, or 1 to 10. */
export function DeviceLimitPicker({ value, onChange, ...field }: DeviceLimitPickerProps) {
  return (
    <Combobox {...field} groups={GROUPS} value={value === null ? NONE : String(value)}
      onChange={(v) => onChange(v === NONE ? null : Number(v))} searchPlaceholder="Search, e.g. 2" />
  )
}
