import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { USERNAME_HINT, USERNAME_PATTERN } from '@/lib/password'
import { useAuthStatus, useSetup } from './api'

export function SetupPage() {
  const status = useAuthStatus()
  const setup = useSetup()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)

  if (status.isPending) return <AuthLayout title="Set up"><Skeleton className="h-72" /></AuthLayout>
  if (status.data && !status.data.needs_setup) return <Navigate to="/login" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMismatch(true)
      return
    }
    setup.mutate(
      { setup_code: code.trim(), username: username.trim(), password },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  return (
    <AuthLayout
      title="Create the first admin"
      description={<>One-time step. Open <code className="font-mono text-foreground">data\setup-code.txt</code> on the server and enter the code.</>}
    >
      <form className="grid gap-5" onSubmit={submit}>
        {setup.isError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{errorMessage(setup.error)}</AlertDescription>
          </Alert>
        )}
        <FormField label="Setup code">
          <Input className="font-mono uppercase" placeholder="XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} required autoFocus
            value={code} onChange={(e) => setCode(e.target.value)} />
        </FormField>
        <FormField label="Admin username" hint={USERNAME_HINT}>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} pattern={USERNAME_PATTERN} required
            value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
        </FormField>
        <FormField label="Password" hint="At least 10 characters">
          <Input type="password" autoComplete="new-password" minLength={10} maxLength={128} required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <FormField label="Repeat password" error={mismatch ? 'The passwords don’t match.' : undefined}>
          <Input type="password" autoComplete="new-password" required value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setMismatch(false) }} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={setup.isPending}>
          {setup.isPending ? 'Creating…' : 'Create admin and sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
