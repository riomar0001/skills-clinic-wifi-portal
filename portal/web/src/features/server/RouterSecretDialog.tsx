import { useMutation } from '@tanstack/react-query'
import { CircleAlert, Eye, EyeOff, ShieldAlert } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from '@/api/client'
import { CopyButton } from '@/components/common/CopyButton'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCurrentAdmin } from '../auth/useCurrentAdmin'

interface RouterSecret {
  secret: string
  clients_conf: string
}

const HIDE_AFTER_SECONDS = 60

/** Asks for the admin's password again, then shows the router secret for a minute. Nothing is cached. */
export function RouterSecretDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useCurrentAdmin()
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState<RouterSecret | null>(null)
  const [showFile, setShowFile] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(HIDE_AFTER_SECONDS)
  const reveal = useMutation({
    mutationFn: (pw: string) => api.post<RouterSecret>('/api/router-secret', { password: pw }),
    gcTime: 0,
  })

  const close = () => {
    setPassword('')
    setRevealed(null)
    setShowFile(false)
    reveal.reset()
    onClose()
  }

  // Count down while the secret is on screen, then hide it.
  useEffect(() => {
    if (!revealed) return
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    const hide = setTimeout(close, HIDE_AFTER_SECONDS * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(hide)
    }
  }, [revealed]) // eslint-disable-line react-hooks/exhaustive-deps -- restart only when a new secret is shown

  const submit = (e: FormEvent) => {
    e.preventDefault()
    reveal.mutate(password, {
      onSuccess: (data) => {
        setPassword('')
        setSecondsLeft(HIDE_AFTER_SECONDS)
        setRevealed(data)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        {revealed ? (
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Router secret</DialogTitle>
              <DialogDescription>
                Paste it into the router as <span className="font-medium text-foreground">RADIUS Server Password</span>.
                Hidden again in {secondsLeft}s.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 py-1.5 pr-1.5 pl-3">
              <code className="font-mono text-base font-semibold break-all">{revealed.secret}</code>
              <CopyButton value={revealed.secret} label="Copy secret" />
            </div>
            <div className="grid gap-2">
              <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setShowFile((v) => !v)}>
                {showFile ? <EyeOff /> : <Eye />} {showFile ? 'Hide' : 'Show'} clients.conf
              </Button>
              {showFile && (
                <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                  {revealed.clients_conf}
                </pre>
              )}
            </div>
            <Alert>
              <ShieldAlert />
              <AlertDescription>Anyone with this secret can impersonate the router to the login server. Don’t share it.</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Confirm it’s you</DialogTitle>
              <DialogDescription>Enter your admin password to see the router secret.</DialogDescription>
            </DialogHeader>
            {reveal.isError && (
              <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(reveal.error)}</AlertDescription></Alert>
            )}
            {/* Lets password managers fill the right account. */}
            <input type="text" name="username" autoComplete="username" value={me} readOnly hidden />
            <FormField label="Your password">
              <Input type="password" autoComplete="current-password" required autoFocus value={password}
                onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={reveal.isPending}>Cancel</Button>
              <Button type="submit" disabled={reveal.isPending || !password}>{reveal.isPending ? 'Checking…' : 'Show secret'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
