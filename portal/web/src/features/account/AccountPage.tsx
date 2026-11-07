import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { InputField } from '../../components/ui/Field'
import { Card, ErrorNotice, PageHeader } from '../../components/ui/misc'
import { useToast } from '../../components/ui/toast-context'
import { useChangeMyPassword } from '../admins/api'
import { useCurrentAdmin } from '../auth/useCurrentAdmin'

export function AccountPage() {
  const me = useCurrentAdmin()
  const change = useChangeMyPassword()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) {
      setMismatch(true)
      return
    }
    change.mutate({ current_password: current, new_password: next }, {
      onSuccess: () => {
        toast.success('Password changed. Your other browsers were signed out.')
        setCurrent('')
        setNext('')
        setConfirm('')
      },
    })
  }

  return (
    <>
      <PageHeader title="Your account" description={<>Signed in as <b>{me}</b>.</>} />
      <Card title="Change password" className="narrow">
        <form className="stack" onSubmit={submit}>
          {change.isError && <ErrorNotice message={errorMessage(change.error)} />}
          {/* Lets password managers attach the new password to the right account. */}
          <input type="text" name="username" autoComplete="username" value={me} readOnly hidden />
          <InputField label="Current password" type="password" autoComplete="current-password" required
            value={current} onChange={(e) => setCurrent(e.target.value)} />
          <InputField label="New password" type="password" autoComplete="new-password" minLength={10} maxLength={128}
            hint="At least 10 characters" required value={next} onChange={(e) => setNext(e.target.value)} />
          <InputField label="Repeat new password" type="password" autoComplete="new-password" required
            error={mismatch ? 'The passwords don’t match.' : undefined} value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setMismatch(false)
            }} />
          <div className="row-end">
            <Button type="submit" variant="primary" loading={change.isPending}>Change password</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
