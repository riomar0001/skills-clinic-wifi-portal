import { RefreshCw } from 'lucide-react'
import { InputField } from '../../components/ui/Field'
import { generatePassword } from '../../lib/password'

interface PasswordInputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

/** Wi-Fi passwords are shown in plain text: the admin has to pass them on to the person anyway. */
export function WifiPasswordInput({ label = 'Password', value, onChange, autoFocus }: PasswordInputProps) {
  return (
    <InputField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      minLength={8}
      maxLength={64}
      pattern="[\x20-\x7E]{8,64}"
      title="8-64 plain keyboard characters"
      hint="8-64 characters. Use Generate for an easy-to-type one."
      required
      autoFocus={autoFocus}
      className="mono"
      addon={
        <button type="button" className="input-addon" onClick={() => onChange(generatePassword())}>
          <RefreshCw size={15} aria-hidden />
          <span>Generate</span>
        </button>
      }
    />
  )
}
