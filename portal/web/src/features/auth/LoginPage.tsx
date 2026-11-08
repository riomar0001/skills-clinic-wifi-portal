import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { HOME_FOR, useAuthStatus, useLogin } from './api'

export function LoginPage() {
  const status = useAuthStatus()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (status.isPending) return <AuthLayout title="Sign in"><Skeleton className="h-48" /></AuthLayout>
  if (status.data?.needs_setup) return <Navigate to="/setup" replace />
  if (status.data?.role) return <Navigate to={HOME_FOR[status.data.role]} replace />

  const from = (location.state as { from?: string } | null)?.from

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username: username.trim(), password }, {
      // Admins go back where they were; Wi-Fi users always land on their own page.
      onSuccess: (s) => navigate(s.role === 'admin' ? from ?? HOME_FOR.admin : HOME_FOR.wifi, { replace: true }),
    })
  }

  return (
    <AuthLayout
      title="Sign in"
      product="Wifi Portal"
      description="Students and faculty: use your ID and Wi-Fi password. Admins: use your admin account."
      footer="Your Wi-Fi password is the one you use to join the clinic Wi-Fi."
    >
      <form className="grid gap-5" onSubmit={submit}>
        {login.isError && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{errorMessage(login.error)}</AlertDescription>
          </Alert>
        )}
        <FormField label="Student/Faculty ID or admin username">
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
        <div className="grid gap-2 border-t pt-5 text-center">
          <span className="text-sm text-muted-foreground">No Wi-Fi account yet?</span>
          <Button variant="outline" size="lg" className="w-full" asChild>
            <Link to="/request-access">Request Wi-Fi access</Link>
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
