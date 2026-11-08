import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { USERNAME_HINT, USERNAME_PATTERN, generatePassword } from '@/lib/password'
import { DEFAULT_DEVICE_LIMIT, EMAIL_DOMAIN, EMAIL_HINT, EMAIL_PATTERN, ID_HINT, ID_LABEL } from '@/lib/person'
import { useCreateWifiUser } from './api'
import type { Credentials } from './CredentialsDialog'
import { DeviceLimitPicker } from './DeviceLimitPicker'
import { ExpiryPicker } from './ExpiryPicker'
import { WifiPasswordInput } from './PasswordInput'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (credentials: Credentials) => void
}

export function CreateWifiUserDialog({ open, onClose, onCreated }: Props) {
  const create = useCreateWifiUser()
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [deviceLimit, setDeviceLimit] = useState<number | null>(DEFAULT_DEVICE_LIMIT)
  const [pickerKey, setPickerKey] = useState(0)

  const close = () => {
    setUsername('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setNote('')
    setPassword(generatePassword())
    setExpiresAt(null)
    setDeviceLimit(DEFAULT_DEVICE_LIMIT)
    setPickerKey((k) => k + 1) // resets the picker's selected preset
    create.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = username.trim()
    create.mutate(
      { username: name, password, first_name: firstName, last_name: lastName, email: email.trim(), note, expires_at: expiresAt, device_limit: deviceLimit },
      {
        onSuccess: () => {
          close()
          onCreated({ username: name, password })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !create.isPending && close()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Add Wi-Fi user</DialogTitle>
            <DialogDescription>They join the Wi-Fi with their Student ID or Faculty ID and this password.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {create.isError && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{errorMessage(create.error)}</AlertDescription>
              </Alert>
            )}
            <FormField label={ID_LABEL} hint={ID_HINT}>
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="off"
                autoCapitalize="none" spellCheck={false} pattern={USERNAME_PATTERN} title={USERNAME_HINT} maxLength={32}
                inputMode="text" placeholder="e.g. 484470" required autoFocus />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="First name">
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="off" maxLength={60} required />
              </FormField>
              <FormField label="Last name">
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="off" maxLength={60} required />
              </FormField>
            </div>
            <FormField label="UMindanao email" hint={EMAIL_HINT}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off"
                autoCapitalize="none" spellCheck={false} pattern={EMAIL_PATTERN} placeholder={`name@${EMAIL_DOMAIN}`} required />
            </FormField>
            <FormField label="Password" hint="8-64 characters. Generated passwords are easy to type on a phone.">
              <WifiPasswordInput value={password} onChange={setPassword} />
            </FormField>
            <FormField label="Access expires" hint="After this the Wi-Fi refuses the login. Good for guests.">
              <ExpiryPicker key={pickerKey} value={expiresAt} onChange={setExpiresAt} />
            </FormField>
            <FormField label="Device limit" hint="Phones and laptops that may use this account. The first ones to log in are registered.">
              <DeviceLimitPicker value={deviceLimit} onChange={setDeviceLimit} />
            </FormField>
            <FormField label="Note" hint="Optional, e.g. role or device">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add user'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
