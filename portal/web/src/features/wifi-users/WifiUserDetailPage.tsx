import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, errorMessage } from '../../api/client'
import type { WifiUser } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { InputField, TextAreaField } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, EmptyState, ErrorNotice, Spinner } from '../../components/ui/misc'
import { useToast } from '../../components/ui/toast-context'
import { formatDateTime } from '../../lib/format'
import { generatePassword } from '../../lib/password'
import { useDeleteWifiUser, useSetWifiPassword, useUpdateWifiUser, useWifiUser } from './api'
import { CredentialsDialog, type Credentials } from './CredentialsDialog'
import { WifiPasswordInput } from './PasswordInput'

export function WifiUserDetailPage() {
  const { username = '' } = useParams()
  const user = useWifiUser(username)

  if (user.isPending) return <Spinner />
  if (user.isError) {
    if (user.error instanceof ApiError && user.error.status === 404) {
      return (
        <EmptyState title="User not found" action={<Link to="/wifi-users" className="link">Back to Wi-Fi users</Link>}>
          “{username}” doesn’t exist. It may have been deleted.
        </EmptyState>
      )
    }
    return <ErrorNotice message={errorMessage(user.error)} onRetry={() => user.refetch()} />
  }
  return <WifiUserDetail key={user.data.username} user={user.data} />
}

function WifiUserDetail({ user }: { user: WifiUser }) {
  const toast = useToast()
  const navigate = useNavigate()
  const update = useUpdateWifiUser(user.username)
  const setPassword = useSetWifiPassword(user.username)
  const remove = useDeleteWifiUser()

  // Form starts from the saved values; the parent keys this component by username.
  const [fullName, setFullName] = useState(user.full_name)
  const [note, setNote] = useState(user.note)

  const [resetOpen, setResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const dirty = fullName.trim() !== user.full_name || note.trim() !== user.note

  const saveDetails = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(
      { full_name: fullName, note },
      { onSuccess: () => toast.success('Details saved.'), onError: (err) => toast.error(errorMessage(err)) },
    )
  }

  const setEnabled = (enabled: boolean) =>
    update.mutate(
      { enabled },
      {
        onSuccess: () => {
          setConfirmDisable(false)
          toast.success(enabled ? `${user.username} can join the Wi-Fi again.` : `${user.username} is disabled.`)
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    )

  const resetPassword = (e: FormEvent) => {
    e.preventDefault()
    setPassword.mutate(newPassword, {
      onSuccess: () => {
        setResetOpen(false)
        setCredentials({ username: user.username, password: newPassword })
      },
    })
  }

  const deleteUser = () =>
    remove.mutate(user.username, {
      onSuccess: () => {
        toast.success(`${user.username} was deleted.`)
        navigate('/wifi-users', { replace: true })
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <>
      <Link to="/wifi-users" className="back-link">
        <ArrowLeft size={16} aria-hidden /> Wi-Fi users
      </Link>
      <header className="page-header">
        <div className="row">
          <span className="avatar avatar-lg" aria-hidden>{(user.full_name || user.username).charAt(0).toUpperCase()}</span>
          <div>
            <h1 className="page-title">{user.username}</h1>
            <p className="page-description">
              {user.full_name || 'No name'} · added {formatDateTime(user.created_at)}
            </p>
          </div>
        </div>
        {user.enabled ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Disabled</Badge>}
      </header>

      <div className="grid-2">
        <Card title="Details">
          <form className="stack" onSubmit={saveDetails}>
            <InputField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
            <TextAreaField label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} />
            <div className="row-end">
              <Button type="submit" variant="primary" disabled={!dirty} loading={update.isPending && dirty}>Save changes</Button>
            </div>
          </form>
        </Card>

        <div className="stack">
          <Card title="Wi-Fi access">
            <p className="muted">
              {user.enabled
                ? 'This person can join the Wi-Fi. Disable to block new connections without deleting the account.'
                : 'This person can’t join the Wi-Fi. Enable to let them back in with the same password.'}
            </p>
            <div className="row-end">
              {user.enabled ? (
                <Button onClick={() => setConfirmDisable(true)}>Disable access</Button>
              ) : (
                <Button variant="primary" onClick={() => setEnabled(true)} loading={update.isPending}>Enable access</Button>
              )}
            </div>
          </Card>

          <Card title="Password">
            <p className="muted">Set a new password if it was forgotten or shared.</p>
            <div className="row-end">
              <Button
                icon={<KeyRound size={16} />}
                onClick={() => {
                  setNewPassword(generatePassword())
                  setPassword.reset()
                  setResetOpen(true)
                }}
              >
                Reset password
              </Button>
            </div>
          </Card>

          <Card title="Delete user" className="card-danger">
            <p className="muted">Removes the account and its login for good.</p>
            <div className="row-end">
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>Delete user</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={resetOpen}
        title={`New password for ${user.username}`}
        description="Devices using the old password will need the new one the next time they connect."
        onClose={() => setResetOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button type="submit" form="reset-password" variant="primary" loading={setPassword.isPending}>Set password</Button>
          </>
        }
      >
        <form id="reset-password" className="stack" onSubmit={resetPassword}>
          {setPassword.isError && <ErrorNotice message={errorMessage(setPassword.error)} />}
          <WifiPasswordInput label="New password" value={newPassword} onChange={setNewPassword} autoFocus />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDisable}
        title={`Disable ${user.username}?`}
        confirmLabel="Disable access"
        busy={update.isPending}
        onConfirm={() => setEnabled(false)}
        onClose={() => setConfirmDisable(false)}
      >
        They won’t be able to join the Wi-Fi. A device that is already connected stays on until it reconnects.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${user.username}?`}
        confirmLabel="Delete user"
        danger
        busy={remove.isPending}
        onConfirm={deleteUser}
        onClose={() => setConfirmDelete(false)}
      >
        This can’t be undone. To pause their access instead, disable the account.
      </ConfirmDialog>

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  )
}
