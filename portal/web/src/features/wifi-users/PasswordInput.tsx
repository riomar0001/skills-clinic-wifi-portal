import { RefreshCw } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { generatePassword } from '@/lib/password'

interface WifiPasswordInputProps {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  // Passed through by FormField:
  id?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/** Shown in plain text: the admin has to pass the password on to the person anyway. */
export function WifiPasswordInput({ value, onChange, autoFocus, ...aria }: WifiPasswordInputProps) {
  return (
    <InputGroup>
      <InputGroupInput
        {...aria}
        className="font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        minLength={8}
        maxLength={64}
        required
        autoFocus={autoFocus}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton onClick={() => onChange(generatePassword())} aria-label="Generate a new password">
          <RefreshCw /> Generate
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
