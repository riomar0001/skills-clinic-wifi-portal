import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { errorMessage } from '../../api/client'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Button } from '../../components/ui/Button'
import { InputField } from '../../components/ui/Field'
import { ErrorNotice, Spinner } from '../../components/ui/misc'
import { USERNAME_HINT, USERNAME_PATTERN } from '../../lib/password'
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

  if (status.isPending) return <div className="page-center"><Spinner /></div>
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
      description={
        <>
          This is a one-time step. Open <code>data\setup-code.txt</code> in the project folder on the
          server and enter the code below.
        </>
      }
    >
      <form className="stack" onSubmit={submit}>
        {setup.isError && <ErrorNotice message={errorMessage(setup.error)} />}
        <InputField
          label="Setup code"
          placeholder="XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <InputField
          label="Your admin username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          pattern={USERNAME_PATTERN}
          title={USERNAME_HINT}
          hint={USERNAME_HINT}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <InputField
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          hint="At least 10 characters"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <InputField
          label="Repeat password"
          type="password"
          autoComplete="new-password"
          required
          error={mismatch ? 'The passwords don’t match.' : undefined}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setMismatch(false)
          }}
        />
        <Button type="submit" variant="primary" loading={setup.isPending} className="btn-block">
          Create admin and sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
