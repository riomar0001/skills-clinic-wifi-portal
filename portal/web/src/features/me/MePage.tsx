import { CalendarClock, CircleAlert, CircleCheck, Clock, KeyRound, Smartphone, TriangleAlert, Wifi } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { errorMessage } from '@/api/client'
import type { Me } from '@/api/types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ConnectionTable } from '@/components/common/ConnectionTable'
import { FormField } from '@/components/common/FormField'
import { EmptyState, ErrorAlert, ListSkeleton, PageSkeleton } from '@/components/common/states'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, timeAgo } from '@/lib/format'
import { userStatus } from '@/lib/expiry'
import { EMAIL_DOMAIN, EMAIL_HINT, EMAIL_PATTERN, ID_LABEL } from '@/lib/person'
import { useChangeMyPassword, useMe, useMyConnections, useUpdateMe } from './api'

export function MePage() {
  const me = useMe()
  if (me.isPending) return <PageSkeleton />
  if (me.isError) return <ErrorAlert message={errorMessage(me.error)} onRetry={() => me.refetch()} />
  const m = me.data

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {m.first_name || m.username}</h1>
        <p className="text-sm text-muted-foreground">Your clinic Wi-Fi account.</p>
      </div>

      <AccessCard me={m} />

      <Tabs defaultValue="details" className="gap-4">
        <TabsList>
          <TabsTrigger value="details">My details</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
        </TabsList>
        <TabsContent value="details"><DetailsForm key={m.username} me={m} /></TabsContent>
        <TabsContent value="devices"><MyDevices me={m} /></TabsContent>
        <TabsContent value="history"><History /></TabsContent>
        <TabsContent value="password"><PasswordForm me={m} /></TabsContent>
      </Tabs>
    </>
  )
}

function AccessCard({ me }: { me: Me }) {
  const status = userStatus(me)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Wi-Fi access <StatusBadge status={status} /></CardTitle>
        <CardDescription>
          {status === 'active' && 'You can join the clinic Wi-Fi.'}
          {status === 'expired' && 'Your access has ended. Ask a Skills Clinic admin to extend it.'}
          {status === 'disabled' && 'Your access is turned off. Ask a Skills Clinic admin.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="grid gap-1">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><Wifi className="size-4" /> Wi-Fi username</dt>
            <dd className="font-mono font-medium">{me.username}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-4" /> Access ends</dt>
            <dd className="font-medium">{me.expires_at === null ? 'No end date' : formatDateTime(me.expires_at)}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="flex items-center gap-1.5 text-muted-foreground"><Clock className="size-4" /> Last connected</dt>
            <dd className="font-medium">{me.last_connected_at === null ? 'Not yet' : timeAgo(me.last_connected_at)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function DetailsForm({ me }: { me: Me }) {
  const update = useUpdateMe()
  const [firstName, setFirstName] = useState(me.first_name)
  const [lastName, setLastName] = useState(me.last_name)
  const [email, setEmail] = useState(me.email ?? '')
  const dirty = firstName.trim() !== me.first_name || lastName.trim() !== me.last_name || email.trim().toLowerCase() !== (me.email ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate({ first_name: firstName, last_name: lastName, email: email.trim() }, {
      onSuccess: () => toast.success('Your details are saved'),
    })
  }

  return (
    <Card>
      <form onSubmit={submit} className="contents">
        <CardHeader>
          <CardTitle>My details</CardTitle>
          <CardDescription>Your ID is your Wi-Fi username and can’t be changed here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {update.isError && (
            <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(update.error)}</AlertDescription></Alert>
          )}
          <FormField label={ID_LABEL}>
            <Input value={me.username} readOnly disabled className="font-mono" />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="First name">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={60} required />
            </FormField>
            <FormField label="Last name">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={60} required />
            </FormField>
          </div>
          <FormField label="UMindanao email" hint={EMAIL_HINT}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none"
              spellCheck={false} pattern={EMAIL_PATTERN} placeholder={`name@${EMAIL_DOMAIN}`} required />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={!dirty || update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function MyDevices({ me }: { me: Me }) {
  const count = me.devices.length
  const limit = me.device_limit
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>My devices</CardTitle>
        <CardDescription>
          {limit === null
            ? 'Phones and laptops that have joined the Wi-Fi with your account.'
            : `You can use up to ${limit} device${limit === 1 ? '' : 's'}; ${count} ${count === 1 ? 'is' : 'are'} registered.`}
          {limit !== null && count >= limit && ' New devices will be refused. Ask a Skills Clinic admin to remove one you no longer use.'}
        </CardDescription>
      </CardHeader>
      {count === 0 ? (
        <EmptyState icon={<Smartphone />} title="No devices yet">Your phone or laptop appears here after it joins the Wi-Fi.</EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Device address</TableHead>
              <TableHead className="hidden sm:table-cell">First seen</TableHead>
              <TableHead className="pr-4">Last used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {me.devices.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="pl-4 font-mono text-xs">{d.mac}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDateTime(d.first_seen_at)}</TableCell>
                <TableCell className="pr-4 text-muted-foreground">{timeAgo(d.last_seen_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

function History() {
  const connections = useMyConnections()
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Connection history</CardTitle>
        <CardDescription>Each time one of your devices tried to join the Wi-Fi (last 90 days).</CardDescription>
      </CardHeader>
      {connections.isPending ? (
        <ListSkeleton rows={4} />
      ) : connections.isError ? (
        <div className="p-4"><ErrorAlert message={errorMessage(connections.error)} onRetry={() => connections.refetch()} /></div>
      ) : (
        <ConnectionTable connections={connections.data} emptyText="Your Wi-Fi logins will show up here." />
      )}
    </Card>
  )
}

function PasswordForm({ me }: { me: Me }) {
  const change = useChangeMyPassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  const review = (e: FormEvent) => {
    e.preventDefault()
    change.reset()
    if (next !== confirm) return setFormError('The new passwords don’t match.')
    if (next === current) return setFormError('The new password must be different from the current one.')
    setFormError(null)
    setConfirming(true)
  }

  const submit = () =>
    change.mutate({ current_password: current, new_password: next }, {
      onSettled: () => setConfirming(false),
      onSuccess: () => {
        setCurrent('')
        setNext('')
        setConfirm('')
        setDone(true)
      },
    })

  if (me.expired) {
    return (
      <Alert>
        <CircleAlert />
        <AlertTitle>Password changes are off</AlertTitle>
        <AlertDescription>Your access has ended, so the password can’t be changed. Ask a Skills Clinic admin.</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <form onSubmit={review} className="contents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> Change Wi-Fi password</CardTitle>
          <CardDescription>Optional. You can keep the password you were given.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {done && (
            <Alert className="border-success/30 text-success [&>svg]:text-success">
              <CircleCheck />
              <AlertTitle>Password changed</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                If a device asks, or disconnects, rejoin the Wi-Fi with <span className="font-mono font-medium text-foreground">{me.username}</span> and
                your new password. If it doesn’t ask, choose “Forget network” and join again.
              </AlertDescription>
            </Alert>
          )}
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
            <TriangleAlert />
            <AlertTitle>You may get disconnected</AlertTitle>
            <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
              Your devices will need the new password the next time they connect, and this one may drop off the Wi-Fi.
            </AlertDescription>
          </Alert>
          {(formError || change.isError) && (
            <Alert variant="destructive"><CircleAlert /><AlertDescription>{formError ?? errorMessage(change.error)}</AlertDescription></Alert>
          )}
          {/* Lets password managers attach the new password to the right account. */}
          <input type="text" name="username" autoComplete="username" value={me.username} readOnly hidden />
          <FormField label="Current password">
            <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="New password" hint="8-64 plain keyboard characters">
              <Input type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={next}
                onChange={(e) => setNext(e.target.value)} />
            </FormField>
            <FormField label="Repeat new password">
              <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </FormField>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={change.isPending}>Change password</Button>
        </CardFooter>
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change your Wi-Fi password now?"
        description="This device may disconnect from the Wi-Fi. Reconnect with your ID and the new password. Your other devices will ask for it too."
        confirmLabel="Yes, change it"
        busy={change.isPending}
        onConfirm={submit}
      />
    </Card>
  )
}
