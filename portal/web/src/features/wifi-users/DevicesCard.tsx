import { Smartphone, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { Device, WifiUser } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorAlert, ListSkeleton } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useRemoveDevice, useUpdateWifiUser, useWifiUserDevices } from './api'
import { DeviceLimitPicker } from './DeviceLimitPicker'

export function DevicesCard({ user }: { user: WifiUser }) {
  const devices = useWifiUserDevices(user.username)
  const update = useUpdateWifiUser(user.username)
  const remove = useRemoveDevice(user.username)
  const [toRemove, setToRemove] = useState<Device | null>(null)

  const count = devices.data?.length ?? user.device_count
  const limit = user.device_limit
  const full = limit !== null && count >= limit

  const setLimit = (next: number | null) =>
    update.mutate({ device_limit: next }, {
      onSuccess: () => toast.success(next === null ? 'No device limit' : `Device limit set to ${next}`),
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Devices</CardTitle>
        <CardDescription>
          {limit === null
            ? `${count} registered, no limit.`
            : `${count} of ${limit} registered.`}{' '}
          Devices register on their first successful Wi-Fi login.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 border-b py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label htmlFor="device-limit" className="grid gap-1 font-normal">
            <span className="font-medium">Device limit</span>
            <span className="text-xs text-muted-foreground">Once reached, other devices are refused.</span>
          </Label>
          <DeviceLimitPicker id="device-limit" value={limit} onChange={setLimit} />
        </div>
        {limit !== null && count > limit && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
            <TriangleAlert />
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
              {count} devices are registered but the limit is {limit}. All of them still work; remove {count - limit} to
              get back under the limit.
            </AlertDescription>
          </Alert>
        )}
        {full && count === limit && (
          <p className="text-sm text-muted-foreground">
            The limit is reached: new devices are refused until you remove one below.
          </p>
        )}
      </CardContent>

      {devices.isPending ? (
        <ListSkeleton rows={2} />
      ) : devices.isError ? (
        <div className="p-4"><ErrorAlert message={errorMessage(devices.error)} onRetry={() => devices.refetch()} /></div>
      ) : devices.data.length === 0 ? (
        <EmptyState icon={<Smartphone />} title="No devices yet">A device appears here after its first Wi-Fi login.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Device address</TableHead>
              <TableHead className="hidden sm:table-cell">First seen</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.data.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="pl-4 font-mono text-xs">{d.mac}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDateTime(d.first_seen_at)}</TableCell>
                <TableCell className="text-muted-foreground" title={formatDateTime(d.last_seen_at)}>{timeAgo(d.last_seen_at)}</TableCell>
                <TableCell className="pr-4">
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove device ${d.mac}`} onClick={() => setToRemove(d)}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title="Remove this device?"
        description={`${toRemove?.mac ?? ''} frees a slot. If the account is at its limit, this device can't join again unless a slot is free.`}
        confirmLabel="Remove device"
        destructive
        busy={remove.isPending}
        onConfirm={() =>
          toRemove &&
          remove.mutate(toRemove.id, {
            onSuccess: () => {
              toast.success('Device removed')
              setToRemove(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      />
    </Card>
  )
}
