import { ArrowLeft, CalendarClock, CircleAlert, KeyRound, Trash2, UserX } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError, errorMessage } from '@/api/client'
import type { WifiUser } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { ConnectionTable } from '@/components/common/ConnectionTable'
import { EmptyState, ErrorAlert, ListSkeleton, PageSkeleton } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { describeExpiry, userStatus } from '@/lib/expiry'
import { formatDateTime } from '@/lib/format'
import { generatePassword } from '@/lib/password'
import { EMAIL_DOMAIN, EMAIL_HINT, EMAIL_PATTERN, ID_LABEL, fullName } from '@/lib/person'
import { cn } from '@/lib/utils'
import { useDeleteWifiUser, useSetWifiPassword, useUpdateWifiUser, useWifiUser, useWifiUserConnections } from './api'
import { CredentialsDialog, type Credentials } from './CredentialsDialog'
import { ExpiryPicker } from './ExpiryPicker'
import { WifiPasswordInput } from './PasswordInput'
import { UserAvatar } from './UserAvatar'

export function WifiUserDetailPage() {
  const { username = '' } = useParams()
  const user = useWifiUser(username)

  if (user.isPending) return <PageSkeleton />
  if (user.isError) {
    if (user.error instanceof ApiError && user.error.status === 404) {
      return (
        <EmptyState icon={<UserX />} title="User not found"
          action={<Button variant="outline" asChild><Link to="/wifi-users">Back to Wi-Fi users</Link></Button>}>
          “{username}” doesn’t exist. It may have been deleted.
        </EmptyState>
      )
    }
    return <ErrorAlert message={errorMessage(user.error)} onRetry={() => user.refetch()} />
  }
  // Keyed by username so the form starts from the saved values.
  return <WifiUserDetail key={user.data.username} user={user.data} />
}

function RecentConnections({ username }: { username: string }) {
  const connections = useWifiUserConnections(username)
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Recent connections</CardTitle>
        <CardDescription>The last 20 Wi-Fi login attempts with this ID, from the login server.</CardDescription>
      </CardHeader>
      {connections.isPending ? (
        <ListSkeleton rows={3} />
      ) : connections.isError ? (
        <div className="p-4"><ErrorAlert message={errorMessage(connections.error)} onRetry={() => connections.refetch()} /></div>
      ) : (
        <ConnectionTable connections={connections.data} />
      )}
    </Card>
  )
}

function ExpiryEditor({ user }: { user: WifiUser }) {
  const update = useUpdateWifiUser(user.username)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number | null>(user.expires_at)

  const save = (value: number | null) =>
    update.mutate({ expires_at: value }, {
      onSuccess: () => {
        setEditing(false)
        toast.success(value === null ? 'Expiry removed' : `Access now ends ${formatDateTime(value)}`)
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  if (!editing) {
    return (
      <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-1">
          <span className="flex items-center gap-1.5 font-medium"><CalendarClock className="size-4 text-muted-foreground" /> Expires</span>
          <span className={cn('text-xs', user.expired ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
            {user.expires_at === null
              ? 'Never'
              : `${user.expired ? 'Expired' : 'Ends'} ${formatDateTime(user.expires_at)} (${describeExpiry(user.expires_at)})`}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setDraft(user.expires_at); setEditing(true) }}>
          {user.expires_at === null ? 'Set' : 'Change'}
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-3 grid gap-3 rounded-lg border p-3">
      <FormField label="Access expires" hint="The Wi-Fi refuses the login after this moment.">
        <ExpiryPicker value={draft} onChange={setDraft} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={update.isPending}>Cancel</Button>
        <Button size="sm" onClick={() => save(draft)} disabled={update.isPending || draft === user.expires_at}>Save</Button>
      </div>
    </div>
  )
}

function WifiUserDetail({ user }: { user: WifiUser }) {
  const navigate = useNavigate()
  const update = useUpdateWifiUser(user.username)
  const setPassword = useSetWifiPassword(user.username)
  const remove = useDeleteWifiUser()

  const [firstName, setFirstName] = useState(user.first_name)
  const [lastName, setLastName] = useState(user.last_name)
  const [email, setEmail] = useState(user.email ?? '')
  const [note, setNote] = useState(user.note)
  const [resetOpen, setResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const dirty = firstName.trim() !== user.first_name || lastName.trim() !== user.last_name
    || email.trim().toLowerCase() !== (user.email ?? '') || note.trim() !== user.note
  const discard = () => {
    setFirstName(user.first_name)
    setLastName(user.last_name)
    setEmail(user.email ?? '')
    setNote(user.note)
  }

  const saveDetails = (e: FormEvent) => {
    e.preventDefault()
    update.mutate({ first_name: firstName, last_name: lastName, note, ...(email.trim() ? { email: email.trim() } : {}) }, {
      onSuccess: () => toast.success('Details saved'),
      onError: (err) => toast.error(errorMessage(err)),
    })
  }

  const setEnabled = (enabled: boolean) =>
    update.mutate({ enabled }, {
      onSuccess: () => {
        setConfirmDisable(false)
        toast.success(enabled ? `${user.username} can join the Wi-Fi again` : `${user.username} is disabled`)
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  const resetPassword = (e: FormEvent) => {
    e.preventDefault()
    setPassword.mutate(newPassword, {
      onSuccess: () => {
        setResetOpen(false)
        setCredentials({ username: user.username, password: newPassword })
      },
    })
  }

  const deleteUser = () =>
    remove.mutate(user.username, {
      onSuccess: () => {
        toast.success(`${user.username} was deleted`)
        navigate('/wifi-users', { replace: true })
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
        <Link to="/wifi-users"><ArrowLeft /> Wi-Fi users</Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar username={user.username} firstName={user.first_name} lastName={user.last_name} className="size-14 text-base" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{fullName(user) || 'No name'}</h1>
              <StatusBadge status={userStatus(user)} />
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{user.username}</span> · {user.email ?? 'no email'} · added {formatDateTime(user.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={saveDetails} className="contents">
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>The ID can’t be changed: it’s their Wi-Fi username. The note is only for admins.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <FormField label={ID_LABEL}>
                <Input value={user.username} readOnly disabled className="font-mono" />
              </FormField>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="First name">
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required />
                </FormField>
                <FormField label="Last name">
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required />
                </FormField>
              </div>
              <FormField label="UMindanao email" hint={user.email ? EMAIL_HINT : `Not set yet. ${EMAIL_HINT}`}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none"
                  spellCheck={false} pattern={EMAIL_PATTERN} placeholder={`name@${EMAIL_DOMAIN}`} />
              </FormField>
              <FormField label="Note" hint="e.g. role, department or device">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={4} />
              </FormField>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              {dirty && (
                <Button type="button" variant="ghost" onClick={discard}>
                  Discard
                </Button>
              )}
              <Button type="submit" disabled={!dirty || update.isPending}>Save changes</Button>
            </CardFooter>
          </form>
        </Card>

        <div className="grid content-start gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Wi-Fi access</CardTitle>
              <CardDescription>Block or time-limit the account without deleting it.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label htmlFor="access-switch" className="grid gap-1 font-normal">
                  <span className="font-medium">{user.enabled ? 'Enabled' : 'Disabled'}</span>
                  <span className="text-xs text-muted-foreground">Turn off to block the account right away.</span>
                </Label>
                <Switch
                  id="access-switch"
                  checked={user.enabled}
                  disabled={update.isPending}
                  onCheckedChange={(checked) => (checked ? setEnabled(true) : setConfirmDisable(true))}
                />
              </div>
              <ExpiryEditor user={user} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Set a new one if it was forgotten or shared.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" onClick={() => { setNewPassword(generatePassword()); setPassword.reset(); setResetOpen(true) }}>
                <KeyRound /> Reset password
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle>Delete user</CardTitle>
              <CardDescription>Removes the account and its login for good.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete user</Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <RecentConnections username={user.username} />

      <Dialog open={resetOpen} onOpenChange={(open) => !setPassword.isPending && setResetOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={resetPassword} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>New password for {user.username}</DialogTitle>
              <DialogDescription>Their devices will need the new password the next time they connect.</DialogDescription>
            </DialogHeader>
            {setPassword.isError && (
              <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(setPassword.error)}</AlertDescription></Alert>
            )}
            <FormField label="New password" hint="8-64 characters">
              <WifiPasswordInput value={newPassword} onChange={setNewPassword} autoFocus />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={setPassword.isPending}>Cancel</Button>
              <Button type="submit" disabled={setPassword.isPending}>{setPassword.isPending ? 'Saving…' : 'Set password'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={`Disable ${user.username}?`}
        description="They won’t be able to join the Wi-Fi. A device that’s already connected stays on until it reconnects."
        confirmLabel="Disable access"
        busy={update.isPending}
        onConfirm={() => setEnabled(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${user.username}?`}
        description="This can’t be undone. To pause their access instead, turn off Wi-Fi access."
        confirmLabel="Delete user"
        destructive
        busy={remove.isPending}
        onConfirm={deleteUser}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  )
}
