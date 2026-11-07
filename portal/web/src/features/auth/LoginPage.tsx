import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { errorMessage } from '../../api/client'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Button } from '../../components/ui/Button'
import { InputField } from '../../components/ui/Field'
import { ErrorNotice, Spinner } from '../../components/ui/misc'
import { useAuthStatus, useLogin } from './api'

export function LoginPage() {
  const status = useAuthStatus()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (status.isPending) return <div className="page-center"><Spinner /></div>
  if (status.data?.needs_setup) return <Navigate to="/setup" replace />
  if (status.data?.admin) return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ username: username.trim(), password }, { onSuccess: () => navigate(from, { replace: true }) })
  }

  return (
    <AuthLayout title="Sign in" description="Manage who can use the Wi-Fi.">
      <form className="stack" onSubmit={submit}>
        {login.isError && <ErrorNotice message={errorMessage(login.error)} />}
        <InputField
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <InputField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" loading={login.isPending} className="btn-block">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
