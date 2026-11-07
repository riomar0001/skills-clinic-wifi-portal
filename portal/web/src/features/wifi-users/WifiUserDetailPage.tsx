import { ArrowLeft, CircleAlert, KeyRound, Trash2, UserX } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { ApiError, errorMessage } from '@/api/client'
import type { WifiUser } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { EmptyState, ErrorAlert, PageSkeleton } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/format'
import { generatePassword } from '@/lib/password'
import { useDeleteWifiUser, useSetWifiPassword, useUpdateWifiUser, useWifiUser } from './api'
import { CredentialsDialog, type Credentials } from './CredentialsDialog'
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

function WifiUserDetail({ user }: { user: WifiUser }) {
  const navigate = useNavigate()
  const update = useUpdateWifiUser(user.username)
  const setPassword = useSetWifiPassword(user.username)
  const remove = useDeleteWifiUser()

  const [fullName, setFullName] = useState(user.full_name)
  const [note, setNote] = useState(user.note)
  const [resetOpen, setResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const dirty = fullName.trim() !== user.full_name || note.trim() !== user.note

  const saveDetails = (e: FormEvent) => {
    e.preventDefault()
    update.mutate({ full_name: fullName, note }, {
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
          <UserAvatar username={user.username} fullName={user.full_name} className="size-14 text-base" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-2xl font-semibold tracking-tight">{user.username}</h1>
              <StatusBadge enabled={user.enabled} />
            </div>
            <p className="text-sm text-muted-foreground">
              {user.full_name || 'No name'} · added {formatDateTime(user.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={saveDetails} className="contents">
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Only admins see these.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <FormField label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
              </FormField>
              <FormField label="Note" hint="e.g. role, department or device">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={4} />
              </FormField>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              {dirty && (
                <Button type="button" variant="ghost" onClick={() => { setFullName(user.full_name); setNote(user.note) }}>
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
              <CardDescription>Block new connections without deleting the account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label htmlFor="access-switch" className="grid gap-1 font-normal">
                  <span className="font-medium">{user.enabled ? 'Can join the Wi-Fi' : 'Blocked'}</span>
                  <span className="text-xs text-muted-foreground">Last changed {formatDateTime(user.updated_at)}</span>
                </Label>
                <Switch
                  id="access-switch"
                  checked={user.enabled}
                  disabled={update.isPending}
                  onCheckedChange={(checked) => (checked ? setEnabled(true) : setConfirmDisable(true))}
                />
              </div>
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
