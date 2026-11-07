import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStatus, useLogin } from './api'

export function LoginPage() {
  const status = useAuthStatus()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (status.isPending) return <AuthLayout title="Sign in"><Skeleton className="h-48" /></AuthLayout>
  if (status.data?.needs_setup) return <Navigate to="/setup" replace />
  if (status.data?.admin) return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username: username.trim(), password }, { onSuccess: () => navigate(from, { replace: true }) })
  }

  return (
    <AuthLayout title="Sign in" description="Manage who can use the Wi-Fi.">
      <form className="grid gap-5" onSubmit={submit}>
        {login.isError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{errorMessage(login.error)}</AlertDescription>
          </Alert>
        )}
        <FormField label="Username">
          <Input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </FormField>
        <FormField label="Password">
          <Input name="password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
