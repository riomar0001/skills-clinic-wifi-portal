import { useMutation } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, TriangleAlert, Wifi } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/api/client'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChangeRequest {
  username: string
  current_password: string
  new_password: string
}

const FOOTER = 'Forgot your password? Ask a Skills Clinic admin to reset it.'

/** For Wi-Fi users (not admins): change your own Wi-Fi password. Served on the network-facing port. */
export function ChangeWifiPasswordPage() {
  const [username, setUsername] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const change = useMutation({
    mutationFn: (body: ChangeRequest) => api.post<void>('/api/self-service/password', body),
  })

  // Wi-Fi users shouldn't see "Admin Portal" in their tab.
  useEffect(() => {
    const previous = document.title
    document.title = 'Change Wi-Fi password · CCE Skills Clinic'
    return () => {
      document.title = previous
    }
  }, [])

  const review = (e: FormEvent) => {
    e.preventDefault()
    change.reset()
    if (next !== confirm) return setFormError('The new passwords don’t match.')
    if (next === current) return setFormError('The new password must be different from the current one.')
    setFormError(null)
    setConfirming(true)
  }

  const submit = () =>
    change.mutate(
      { username: username.trim().toLowerCase(), current_password: current, new_password: next },
      {
        onSettled: () => setConfirming(false),
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
        },
      },
    )

  if (change.isSuccess) {
    return (
      <AuthLayout title="Password changed" product="Wifi" footer={FOOTER}>
        <div className="grid gap-5">
          <div className="flex size-11 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden>
            <CircleCheck className="size-6" />
          </div>
          <p className="text-sm">
            Your new Wi-Fi password works now. If this device disconnects, or another device asks for a password:
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Open Wi-Fi settings and choose the clinic Wi-Fi.</li>
            <li>Enter your username <span className="font-medium text-foreground">{username.trim().toLowerCase()}</span> and your <span className="font-medium text-foreground">new password</span>.</li>
            <li>If it doesn’t ask, tap <span className="font-medium text-foreground">Forget network</span> and join again.</li>
          </ol>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Change your Wi-Fi password" description="Use the username and password you join the Wi-Fi with." product="Wifi" footer={FOOTER}>
      <form className="grid gap-5" onSubmit={review}>
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
          <TriangleAlert />
          <AlertTitle>You may get disconnected</AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
            After the change, your devices need the new password the next time they connect, and this one may drop off
            the Wi-Fi. Have the new password ready.
          </AlertDescription>
        </Alert>
        {(formError || change.isError) && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{formError ?? errorMessage(change.error)}</AlertDescription>
          </Alert>
        )}
        <FormField label="Username">
          <Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </FormField>
        <FormField label="Current password">
          <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </FormField>
        <FormField label="New password" hint="8-64 characters, plain keyboard characters only">
          <Input type="password" autoComplete="new-password" minLength={8} maxLength={64} required value={next}
            onChange={(e) => setNext(e.target.value)} />
        </FormField>
        <FormField label="Repeat new password">
          <Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={change.isPending}>
          <Wifi /> Change password
        </Button>
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change your Wi-Fi password now?"
        description="This device may disconnect from the Wi-Fi. Reconnect with your username and the new password. Other devices you use will ask for it too."
        confirmLabel="Yes, change it"
        busy={change.isPending}
        onConfirm={submit}
      />
    </AuthLayout>
  )
}
