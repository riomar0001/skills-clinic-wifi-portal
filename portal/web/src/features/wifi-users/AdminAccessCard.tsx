import { CircleAlert, CircleCheck, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { errorMessage } from '@/api/client'
import type { WifiUser } from '@/api/types'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { generatePassword } from '@/lib/password'
import { fullName } from '@/lib/person'
import { useAdmins, useCreateAdmin } from '../admins/api'
import { CredentialRow } from './CredentialsDialog'
import { WifiPasswordInput } from './PasswordInput'

/** Promote a Wi-Fi user to admin: an admin account with the same ID and its own password. */
export function AdminAccessCard({ user }: { user: WifiUser }) {
  const admins = useAdmins()
  const [open, setOpen] = useState(false)
  const isAdmin = admins.data?.some((a) => a.username === user.username) ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin access</CardTitle>
        <CardDescription>
          {isAdmin
            ? 'This person can manage the portal. Remove it on the Admins page.'
            : 'Let this person manage the portal with a separate admin password. Their Wi-Fi password stays the same.'}
        </CardDescription>
        {isAdmin && <CardAction><Badge variant="secondary"><ShieldCheck /> Admin</Badge></CardAction>}
      </CardHeader>
      <CardFooter>
        {admins.isPending ? (
          <Skeleton className="h-9 w-32" />
        ) : admins.isError ? (
          <span className="text-sm text-destructive">{errorMessage(admins.error)}</span>
        ) : isAdmin ? (
          <Button variant="outline" asChild><Link to="/admins"><ShieldCheck /> Manage admins</Link></Button>
        ) : (
          <Button variant="outline" onClick={() => setOpen(true)}><ShieldCheck /> Make admin</Button>
        )}
      </CardFooter>
      <PromoteDialog user={user} open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}

function PromoteDialog({ user, open, onClose }: { user: WifiUser; open: boolean; onClose: () => void }) {
  const create = useCreateAdmin()
  const [password, setPassword] = useState(generatePassword)
  const [created, setCreated] = useState<string | null>(null)

  const close = () => {
    setPassword(generatePassword())
    setCreated(null)
    create.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate({ username: user.username, password }, { onSuccess: () => setCreated(password) })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !create.isPending && close()}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden>
                <CircleCheck className="size-5" />
              </div>
              <DialogTitle>{fullName(user) || user.username} is now an admin</DialogTitle>
              <DialogDescription>
                This admin password won’t be shown again. Give it to them; they sign in with their ID and this
                password to reach the admin portal.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <CredentialRow label="Admin username" value={user.username} />
              <CredentialRow label="Admin password" value={created} />
            </div>
            <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>Make {fullName(user) || user.username} an admin?</DialogTitle>
              <DialogDescription>
                They can add, change and delete Wi-Fi users and admins, and see the router secret. They get an admin
                account named <span className="font-mono">{user.username}</span> with the password below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5">
              {create.isError && (
                <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(create.error)}</AlertDescription></Alert>
              )}
              <FormField label="Admin password" hint="At least 10 characters. Their Wi-Fi password doesn’t change.">
                <WifiPasswordInput value={password} onChange={setPassword} />
              </FormField>
              <Alert>
                <ShieldCheck />
                <AlertDescription>
                  Signing in with the admin password opens the admin portal; the Wi-Fi password still opens My Wi-Fi. If
                  they later change their admin password, their Wi-Fi password changes to match.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={create.isPending}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Make admin'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
