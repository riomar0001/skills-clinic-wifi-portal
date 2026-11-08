import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Info } from 'lucide-react'
import { api } from '@/api/client'
import type { Certificate } from '@/api/types'
import { CopyButton } from '@/components/common/CopyButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface Credentials {
  username: string
  password: string
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/50 py-1.5 pr-1.5 pl-3">
        <code className="font-mono text-base font-semibold break-all">{value}</code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
    </div>
  )
}

/** Shown once after creating a user or resetting a password; the portal can't show the password again. */
export function CredentialsDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const cert = useQuery({ queryKey: ['certificate'], queryFn: () => api.get<Certificate>('/api/certificate'), enabled: credentials !== null })
  return (
    <Dialog open={credentials !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden>
            <CircleCheck className="size-5" />
          </div>
          <DialogTitle>Share these Wi-Fi details</DialogTitle>
          <DialogDescription>This password won’t be shown again. Copy it now and give it to the person.</DialogDescription>
        </DialogHeader>
        {credentials && (
          <div className="grid gap-4">
            <CredentialRow label="Username (Student/Faculty ID)" value={credentials.username} />
            <CredentialRow label="Password" value={credentials.password} />
            <Alert>
              <Info />
              <AlertTitle>Joining the Wi-Fi</AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  <li><b>iPhone / Mac:</b> enter both, then tap <b>Trust</b>.</li>
                  <li>
                    <b>Android:</b> EAP <b>PEAP</b>, Phase 2 <b>MSCHAPV2</b>,{' '}
                    {cert.data?.trusted
                      ? <>CA certificate <b>Use system certificates</b>, domain <b>{cert.data.name}</b>.</>
                      : <>CA certificate <b>Trust on first use</b>.</>}
                  </li>
                  <li><b>Windows:</b> enter both, then click <b>Connect</b>.</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
