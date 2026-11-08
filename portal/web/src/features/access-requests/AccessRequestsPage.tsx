import { Check, CircleAlert, Inbox, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { AccessRequest } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorAlert, ListSkeleton } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, timeAgo } from '@/lib/format'
import { DEFAULT_DEVICE_LIMIT, fullName } from '@/lib/person'
import { DeviceLimitPicker } from '../wifi-users/DeviceLimitPicker'
import { ExpiryPicker } from '../wifi-users/ExpiryPicker'
import { UserAvatar } from '../wifi-users/UserAvatar'
import { useAccessRequests, useApproveAccessRequest, useRejectAccessRequest } from './api'

export function AccessRequestsPage() {
  const requests = useAccessRequests()
  const [approving, setApproving] = useState<AccessRequest | null>(null)
  const [rejecting, setRejecting] = useState<AccessRequest | null>(null)
  const reject = useRejectAccessRequest()

  const confirmReject = () => {
    if (!rejecting) return
    reject.mutate(rejecting.id, {
      onSuccess: () => toast.success(`Rejected the request from ${fullName(rejecting) || rejecting.username}.`),
      onError: (err) => toast.error(errorMessage(err)),
      onSettled: () => setRejecting(null),
    })
  }

  return (
    <>
      <PageHeader
        title="Access requests"
        description="People who asked for Wi-Fi access from the sign-in page. Approving creates their account with the password they chose."
      />

      <Card className="gap-0 overflow-hidden py-0">
        {requests.isPending ? (
          <div className="p-4"><ListSkeleton /></div>
        ) : requests.isError ? (
          <div className="p-4"><ErrorAlert message={errorMessage(requests.error)} onRetry={() => requests.refetch()} /></div>
        ) : requests.data.length === 0 ? (
          <EmptyState icon={<Inbox />} title="No requests waiting">
            People can ask from the sign-in page with <span className="font-medium">Request Wi-Fi access</span>.
          </EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Requested</TableHead>
                <TableHead className="pr-4 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar username={r.username} firstName={r.first_name} lastName={r.last_name} />
                      <div className="grid min-w-0">
                        <span className="truncate font-medium">{fullName(r)}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">{r.username}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">{r.email}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell" title={formatDateTime(r.created_at)}>
                    {timeAgo(r.created_at)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => setApproving(r)} aria-label={`Approve ${r.username}`}>
                        <Check /> <span className="hidden sm:inline">Approve</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejecting(r)} aria-label={`Reject ${r.username}`}>
                        <X /> <span className="hidden sm:inline">Reject</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ApproveDialog request={approving} onClose={() => setApproving(null)} />
      <ConfirmDialog
        open={rejecting !== null}
        title="Reject this request?"
        description={rejecting && <>
          {fullName(rejecting)} (<span className="font-mono">{rejecting.username}</span>) won’t get Wi-Fi access. They can
          send a new request.
        </>}
        confirmLabel="Reject"
        destructive
        busy={reject.isPending}
        onConfirm={confirmReject}
        onOpenChange={(open) => !open && setRejecting(null)}
      />
    </>
  )
}

function ApproveDialog({ request, onClose }: { request: AccessRequest | null; onClose: () => void }) {
  const approve = useApproveAccessRequest()
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [deviceLimit, setDeviceLimit] = useState<number | null>(DEFAULT_DEVICE_LIMIT)

  const close = () => {
    setExpiresAt(null)
    setDeviceLimit(DEFAULT_DEVICE_LIMIT)
    approve.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!request) return
    approve.mutate({ id: request.id, expires_at: expiresAt, device_limit: deviceLimit }, {
      onSuccess: () => {
        toast.success(`${fullName(request) || request.username} can now join the Wi-Fi with the password they chose.`)
        close()
      },
    })
  }

  return (
    <Dialog open={request !== null} onOpenChange={(next) => !next && !approve.isPending && close()}>
      <DialogContent className="sm:max-w-lg">
        {/* key: a fresh picker for each request */}
        <form key={request?.id} onSubmit={submit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>Approve {request ? fullName(request) : ''}</DialogTitle>
            <DialogDescription>
              Creates the Wi-Fi account <span className="font-mono">{request?.username}</span> with the password they chose.
              Nobody else sees it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            {approve.isError && (
              <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(approve.error)}</AlertDescription></Alert>
            )}
            <FormField label="Access expires" hint="After this the Wi-Fi refuses the login.">
              <ExpiryPicker value={expiresAt} onChange={setExpiresAt} />
            </FormField>
            <FormField label="Device limit" hint="Phones and laptops that may use this account.">
              <DeviceLimitPicker value={deviceLimit} onChange={setDeviceLimit} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={approve.isPending}>Cancel</Button>
            <Button type="submit" disabled={approve.isPending}>{approve.isPending ? 'Approving…' : 'Approve'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
