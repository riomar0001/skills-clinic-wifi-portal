import { useQuery } from '@tanstack/react-query'
import { Database, Download, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { api, errorMessage } from '@/api/client'
import type { Certificate } from '@/api/types'
import { CopyButton } from '@/components/common/CopyButton'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorAlert } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

export function ServerPage() {
  const cert = useQuery({ queryKey: ['certificate'], queryFn: () => api.get<Certificate>('/api/certificate') })

  return (
    <>
      <PageHeader title="Server" description="Certificate, router settings and backups." />

      <Card>
        <CardHeader>
          <CardTitle>Certificate</CardTitle>
          <CardDescription>
            Phones show this the first time they join. Tell people to check the name before tapping Trust. A different
            name could mean someone is faking the network.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cert.isPending ? (
            <Skeleton className="h-40" />
          ) : cert.isError ? (
            <ErrorAlert message={errorMessage(cert.error)} onRetry={() => cert.refetch()} />
          ) : (
            <dl className="divide-y">
              <Row label="Name"><code className="font-mono">{cert.data.name}</code></Row>
              <Row label="Issued by">{cert.data.issuer}</Row>
              <Row label="Valid until">{formatDate(cert.data.expires_at)}</Row>
              <Row label="SHA-256 fingerprint">
                <div className="flex items-start gap-1">
                  <code className="font-mono text-xs leading-relaxed break-all">{cert.data.sha256}</code>
                  <CopyButton value={cert.data.sha256} label="Copy fingerprint" />
                </div>
              </Row>
            </dl>
          )}
        </CardContent>
        <Separator />
        <CardFooter className="flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            To skip the warning on a device, install the CA certificate first. On Android: Settings → Security → Install a
            certificate → <span className="font-medium text-foreground">Wi-Fi certificate</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/certificate/ca.der" download><Download /> ca.der (Android, Windows)</a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/api/certificate/ca.pem" download><Download /> ca.pem</a>
            </Button>
          </div>
        </CardFooter>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Router settings</CardTitle>
            <CardDescription>TP-Link: Wireless → Wireless Security → WPA/WPA2 - Enterprise.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="Version">WPA2</Row>
              <Row label="Encryption">AES</Row>
              <Row label="RADIUS Server IP">This server’s address on the network</Row>
              <Row label="RADIUS Server Port"><code className="font-mono">1812</code></Row>
              <Row label="RADIUS Password">The <code className="font-mono">secret</code> in <code className="font-mono">data\clients.conf</code></Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup</CardTitle>
            <CardDescription>A copy of the portal database: admins, Wi-Fi users and activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info />
              <AlertTitle>Keep backups private</AlertTitle>
              <AlertDescription>They contain password hashes.</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <a href="/api/backup" download><Database /> Download backup</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}
