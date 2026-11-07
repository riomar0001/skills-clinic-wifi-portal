import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../api/client'
import type { Admin } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { InputField } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Badge, Card, ErrorNotice, PageHeader, Spinner } from '../../components/ui/misc'
import { useToast } from '../../components/ui/toast-context'
import { formatDate } from '../../lib/format'
import { USERNAME_HINT, USERNAME_PATTERN } from '../../lib/password'
import { useCurrentAdmin } from '../auth/useCurrentAdmin'
import { useAdmins, useCreateAdmin, useDeleteAdmin } from './api'

export function AdminsPage() {
  const me = useCurrentAdmin()
  const admins = useAdmins()
  const remove = useDeleteAdmin()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [toDelete, setToDelete] = useState<Admin | null>(null)

  const onlyOne = (admins.data?.length ?? 0) <= 1

  return (
    <>
      <PageHeader
        title="Admins"
        description="People who can sign in to this portal and manage Wi-Fi users."
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add admin</Button>}
      />
      <Card>
        {admins.isPending ? (
          <Spinner />
        ) : admins.isError ? (
          <ErrorNotice message={errorMessage(admins.error)} onRetry={() => admins.refetch()} />
        ) : (
          <ul className="list">
            {admins.data.map((a) => (
              <li key={a.username} className="list-row list-row-static">
                <span className="avatar avatar-admin" aria-hidden><ShieldCheck size={16} /></span>
                <span className="list-main">
                  <span className="list-title">
                    {a.username} {a.username === me && <Badge tone="info">You</Badge>}
                  </span>
                  <span className="list-sub">Added {formatDate(a.created_at)}</span>
                </span>
                {a.username !== me && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={15} />}
                    onClick={() => setToDelete(a)}
                    disabled={onlyOne}
                    aria-label={`Remove ${a.username}`}
                  >
                    <span className="hide-sm">Remove</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddAdminDialog open={adding} onClose={() => setAdding(false)} />

      <ConfirmDialog
        open={toDelete !== null}
        title={`Remove admin ${toDelete?.username ?? ''}?`}
        confirmLabel="Remove admin"
        danger
        busy={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.username, {
            onSuccess: () => {
              toast.success(`${toDelete.username} can no longer sign in.`)
              setToDelete(null)
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
      >
        They’ll be signed out and can’t manage the portal anymore. Wi-Fi users aren’t affected.
      </ConfirmDialog>
    </>
  )
}

function AddAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAdmin()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const close = () => {
    setUsername('')
    setPassword('')
    setConfirm('')
    setMismatch(false)
    create.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setMismatch(true)
      return
    }
    const name = username.trim()
    create.mutate({ username: name, password }, {
      onSuccess: () => {
        toast.success(`${name} can now sign in.`)
        close()
      },
    })
  }

  return (
    <Modal
      open={open}
      title="Add admin"
      description="Admins can add, change and remove Wi-Fi users and other admins."
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" form="add-admin" variant="primary" loading={create.isPending}>Add admin</Button>
        </>
      }
    >
      <form id="add-admin" className="stack" onSubmit={submit}>
        {create.isError && <ErrorNotice message={errorMessage(create.error)} />}
        <InputField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          pattern={USERNAME_PATTERN}
          title={USERNAME_HINT}
          hint={USERNAME_HINT}
          required
          autoFocus
        />
        <InputField
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          hint="At least 10 characters. Share it with them privately."
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
      </form>
    </Modal>
  )
}
