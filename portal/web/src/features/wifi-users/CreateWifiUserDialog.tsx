import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { InputField, TextAreaField } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { ErrorNotice } from '../../components/ui/misc'
import { USERNAME_HINT, USERNAME_PATTERN, generatePassword } from '../../lib/password'
import { useCreateWifiUser } from './api'
import type { Credentials } from './CredentialsDialog'
import { WifiPasswordInput } from './PasswordInput'

const FORM_ID = 'create-wifi-user'

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

  const close = () => {
    setUsername('')
    setFullName('')
    setNote('')
    setPassword(generatePassword())
    create.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = username.trim()
    create.mutate(
      { username: name, password, full_name: fullName, note },
      {
        onSuccess: () => {
          const credentials = { username: name, password }
          close()
          onCreated(credentials)
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      title="Add Wi-Fi user"
      description="Each person gets their own username and password for the Wi-Fi."
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" form={FORM_ID} variant="primary" loading={create.isPending}>Add user</Button>
        </>
      }
    >
      <form id={FORM_ID} className="stack" onSubmit={submit}>
        {create.isError && <ErrorNotice message={errorMessage(create.error)} />}
        <InputField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          pattern={USERNAME_PATTERN}
          title={USERNAME_HINT}
          hint={USERNAME_HINT}
          maxLength={32}
          required
          autoFocus
        />
        <InputField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} hint="Optional" />
        <WifiPasswordInput value={password} onChange={setPassword} />
        <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} hint="Optional, e.g. role or device" />
      </form>
    </Modal>
  )
}
