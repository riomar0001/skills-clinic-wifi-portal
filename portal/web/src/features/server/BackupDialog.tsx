import { useMutation } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/api/client'
import { FormField } from '@/components/common/FormField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCurrentAdmin } from '../auth/useCurrentAdmin'

/** Saves a file the browser already holds, under the given name. */
function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The backup holds every password hash, so the admin types their password again, as for the router secret. */
export function BackupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useCurrentAdmin()
  const [password, setPassword] = useState('')
  const download = useMutation({
    mutationFn: (pw: string) => api.postForFile('/api/backup', { password: pw }),
    gcTime: 0,
  })

  const close = () => {
    setPassword('')
    download.reset()
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    download.mutate(password, {
      onSuccess: ({ blob, filename }) => {
        saveFile(blob, filename)
        toast.success(`Backup saved as ${filename}. Keep it private: it holds password hashes.`)
        close()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !download.isPending && close()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Confirm it’s you</DialogTitle>
            <DialogDescription>Enter your admin password to download a backup of the portal database.</DialogDescription>
          </DialogHeader>
          {download.isError && (
            <Alert variant="destructive"><CircleAlert /><AlertDescription>{errorMessage(download.error)}</AlertDescription></Alert>
          )}
          {/* Lets password managers fill the right account. */}
          <input type="text" name="username" autoComplete="username" value={me} readOnly hidden />
          <FormField label="Your password">
            <Input type="password" autoComplete="current-password" required autoFocus value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={download.isPending}>Cancel</Button>
            <Button type="submit" disabled={download.isPending || !password}>
              {download.isPending ? 'Preparing…' : 'Download backup'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
