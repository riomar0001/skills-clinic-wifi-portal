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
import { useCreateWifiUser } from './api'
import type { Credentials } from './CredentialsDialog'
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
  const [fullName, setFullName] = useState('')
  const [note, setNote] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [pickerKey, setPickerKey] = useState(0)

  const close = () => {
    setUsername('')
    setFullName('')
    setNote('')
    setPassword(generatePassword())
    setExpiresAt(null)
    setPickerKey((k) => k + 1) // resets the picker's selected preset
    create.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = username.trim()
    create.mutate(
      { username: name, password, full_name: fullName, note, expires_at: expiresAt },
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
            <DialogDescription>Each person gets their own username and password for the Wi-Fi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {create.isError && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{errorMessage(create.error)}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Username" hint={USERNAME_HINT}>
                <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="off"
                  autoCapitalize="none" spellCheck={false} pattern={USERNAME_PATTERN} maxLength={32} required autoFocus />
              </FormField>
              <FormField label="Full name" hint="Optional">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
              </FormField>
            </div>
            <FormField label="Password" hint="8-64 characters. Generated passwords are easy to type on a phone.">
              <WifiPasswordInput value={password} onChange={setPassword} />
            </FormField>
            <FormField label="Access expires" hint="After this the Wi-Fi refuses the login. Good for guests.">
              <ExpiryPicker key={pickerKey} value={expiresAt} onChange={setExpiresAt} />
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
