import { CircleAlert, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { Admin } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert, ListSkeleton } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate } from '@/lib/format'
import { USERNAME_HINT, USERNAME_PATTERN } from '@/lib/password'
import { useCurrentAdmin } from '../auth/useCurrentAdmin'
import { useAdmins, useCreateAdmin, useDeleteAdmin } from './api'

export function AdminsPage() {
  const me = useCurrentAdmin()
  const admins = useAdmins()
  const remove = useDeleteAdmin()
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState<Admin | null>(null)

  return (
    <>
      <PageHeader
        title="Admins"
        description="People who can sign in here and manage Wi-Fi users."
        actions={<Button onClick={() => setAdding(true)}><Plus /> Add admin</Button>}
      />
      <Card className="gap-0 overflow-hidden py-0">
        {admins.isPending ? (
          <ListSkeleton rows={2} />
        ) : admins.isError ? (
          <div className="p-4"><ErrorAlert message={errorMessage(admins.error)} onRetry={() => admins.refetch()} /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Admin</TableHead>
                <TableHead className="hidden sm:table-cell">Added</TableHead>
                <TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.data.map((a) => (
                <TableRow key={a.username}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9"><AvatarFallback className="text-muted-foreground"><ShieldCheck className="size-4" /></AvatarFallback></Avatar>
                      <span className="font-medium">{a.username}</span>
                      {a.username === me && <Badge variant="secondary">You</Badge>}
                      {a.uses_wifi_password && (
                        <Badge variant="outline" title="Promoted from a Wi-Fi user: signs in with their Wi-Fi password">
                          Wi-Fi password
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(a.created_at)}</TableCell>
                  <TableCell className="pr-4">
                    {a.username !== me && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.username}`} onClick={() => setToDelete(a)}>
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove admin</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <AddAdminDialog open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Remove admin ${toDelete?.username ?? ''}?`}
        description="They’ll be signed out and can’t manage the portal anymore. Wi-Fi users aren’t affected."
        confirmLabel="Remove admin"
        destructive
        busy={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.username, {
            onSuccess: () => {
              toast.success(`${toDelete.username} can no longer sign in`)
              setToDelete(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </>
  )
}

function AddAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAdmin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const close = () => {
    setUsername('')
    setPassword('')
    setConfirm('')
    setMismatch(false)
    create.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMismatch(true)
      return
    }
    const name = username.trim()
    create.mutate({ username: name, password }, {
      onSuccess: () => {
        toast.success(`${name} can now sign in`)
        close()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !create.isPending && close()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Add admin</DialogTitle>
            <DialogDescription>Admins can add, change and remove Wi-Fi users and other admins.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {create.isError && (
              <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(create.error)}</AlertDescription></Alert>
            )}
            <FormField label="Username" hint={USERNAME_HINT}>
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="off"
                autoCapitalize="none" spellCheck={false} pattern={USERNAME_PATTERN} required autoFocus />
            </FormField>
            <FormField label="Password" hint="At least 10 characters. Share it with them privately.">
              <Input type="password" autoComplete="new-password" minLength={10} maxLength={128} required
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <FormField label="Repeat password" error={mismatch ? 'The passwords don’t match.' : undefined}>
              <Input type="password" autoComplete="new-password" required value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setMismatch(false) }} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add admin'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
