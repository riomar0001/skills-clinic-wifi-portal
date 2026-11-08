import { CircleAlert, CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { USERNAME_HINT, USERNAME_PATTERN } from '@/lib/password'
import { EMAIL_DOMAIN, EMAIL_HINT, EMAIL_PATTERN, ID_LABEL } from '@/lib/person'
import { WIFI_SSID } from '@/lib/wifi'
import { HOME_FOR, useAuthStatus } from '../auth/api'
import { useSubmitAccessRequest } from './api'

/** Public page: someone without an account asks for Wi-Fi access with the password they want. */
export function RequestAccessPage() {
  const status = useAuthStatus()
  const submit = useSubmitAccessRequest()
  const [username, setUsername] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (status.isPending) return <AuthLayout title="Request Wi-Fi access"><Skeleton className="h-96" /></AuthLayout>
  if (status.data?.needs_setup) return <Navigate to="/setup" replace />
  if (status.data?.role) return <Navigate to={HOME_FOR[status.data.role]} replace />

  if (submit.isSuccess) {
    return (
      <AuthLayout title="Request sent" product="Wifi Portal">
        <div className="grid gap-5">
          <Alert className="border-success/30 text-success [&>svg]:text-success">
            <CircleCheck />
            <AlertTitle>An admin will review it</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Once it’s approved, join <span className="font-medium text-foreground">{WIFI_SSID}</span> with
              ID <span className="font-mono font-medium text-foreground">{submit.data.username}</span> and the password you
              chose. You can also sign in here to see your access.
            </AlertDescription>
          </Alert>
          <Button asChild size="lg" className="w-full"><Link to="/login">Back to sign in</Link></Button>
        </div>
      </AuthLayout>
    )
  }

  const send = (e: FormEvent) => {
    e.preventDefault()
    submit.reset()
    if (password !== confirm) return setFormError('The passwords don’t match.')
    setFormError(null)
    submit.mutate({ username: username.trim(), password, first_name: firstName, last_name: lastName, email: email.trim() })
  }

  return (
    <AuthLayout
      title="Request Wi-Fi access"
      product="Wifi Portal"
      description="For CCE Skills Clinic students and faculty. An admin checks each request before access is given."
      footer={<>Already have access? <Link to="/login" className="font-medium text-foreground underline underline-offset-4">Sign in</Link></>}
    >
      <form className="grid gap-5" onSubmit={send}>
        {(formError || submit.isError) && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{formError ?? errorMessage(submit.error)}</AlertDescription>
          </Alert>
        )}
        <FormField label={ID_LABEL} hint="This will be your Wi-Fi username.">
          <Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus
            pattern={USERNAME_PATTERN} title={USERNAME_HINT} maxLength={32} placeholder="e.g. 484470"
            value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
        </FormField>
        <FormField label="First name">
          <Input name="given-name" autoComplete="given-name" maxLength={60} required
            value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </FormField>
        <FormField label="Last name">
          <Input name="family-name" autoComplete="family-name" maxLength={60} required
            value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </FormField>
        <FormField label="UMindanao email" hint={EMAIL_HINT}>
          <Input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required
            pattern={EMAIL_PATTERN} placeholder={`name@${EMAIL_DOMAIN}`}
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Wi-Fi password" hint="8-64 characters: letters, digits and symbols on a normal keyboard.">
          <Input name="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <FormField label="Repeat password">
          <Input name="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={64} required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : 'Send request'}
        </Button>
      </form>
    </AuthLayout>
  )
}
