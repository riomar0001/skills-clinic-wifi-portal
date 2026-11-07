import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useChangeMyPassword } from '../admins/api'
import { useCurrentAdmin } from '../auth/useCurrentAdmin'

export function AccountPage() {
  const me = useCurrentAdmin()
  const change = useChangeMyPassword()
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
      <PageHeader title="Your account" description={<>Signed in as <span className="font-medium text-foreground">{me}</span>.</>} />
      <Card className="max-w-xl">
        <form onSubmit={submit} className="contents">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Your other signed-in browsers will be signed out.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {change.isError && (
              <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(change.error)}</AlertDescription></Alert>
            )}
            {/* Lets password managers attach the new password to the right account. */}
            <input type="text" name="username" autoComplete="username" value={me} readOnly hidden />
            <FormField label="Current password">
              <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </FormField>
            <FormField label="New password" hint="At least 10 characters">
              <Input type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={next} onChange={(e) => setNext(e.target.value)} />
            </FormField>
            <FormField label="Repeat new password" error={mismatch ? 'The passwords don’t match.' : undefined}>
              <Input type="password" autoComplete="new-password" required value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setMismatch(false) }} />
            </FormField>
          </CardContent>
          <CardFooter className="justify-end border-t">
            <Button type="submit" disabled={change.isPending}>{change.isPending ? 'Saving…' : 'Change password'}</Button>
          </CardFooter>
        </form>
      </Card>
    </>
  )
}
