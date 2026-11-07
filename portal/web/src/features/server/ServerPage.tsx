import { useQuery } from '@tanstack/react-query'
import { Database, Download } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import type { Certificate } from '../../api/types'
import { Card, CopyButton, ErrorNotice, PageHeader, Spinner } from '../../components/ui/misc'
import { formatDate } from '../../lib/format'

export function ServerPage() {
  const cert = useQuery({ queryKey: ['certificate'], queryFn: () => api.get<Certificate>('/api/certificate') })

  return (
    <>
      <PageHeader title="Server" description="Certificate, router settings and backups." />
      <div className="grid-2">
        <Card title="Certificate">
          {cert.isPending ? (
            <Spinner />
          ) : cert.isError ? (
            <ErrorNotice message={errorMessage(cert.error)} onRetry={() => cert.refetch()} />
          ) : (
            <div className="stack">
              <p className="muted">
                Phones show this certificate the first time they join. Tell people to check the name before
                tapping <b>Trust</b>. If a phone shows a different name, someone may be faking the network.
              </p>
              <dl className="kv">
                <dt>Name</dt>
                <dd><code>{cert.data.name}</code></dd>
                <dt>Issued by</dt>
                <dd>{cert.data.issuer}</dd>
                <dt>Valid until</dt>
                <dd>{formatDate(cert.data.expires_at)}</dd>
                <dt>SHA-256</dt>
                <dd className="fingerprint">
                  <code>{cert.data.sha256}</code>
                  <CopyButton value={cert.data.sha256} label="Copy fingerprint" />
                </dd>
              </dl>
              <div className="callout">
                <p className="callout-title">Skip the warning on a device</p>
                <p className="muted small">
                  Install the CA certificate before joining. On Android: Settings → Security → Install a
                  certificate → <b>Wi-Fi certificate</b>, then pick it as the CA certificate.
                </p>
                <div className="row">
                  <a className="btn btn-secondary btn-sm" href="/api/certificate/ca.der" download>
                    <Download size={15} aria-hidden /> <span>ca.der (Android, Windows)</span>
                  </a>
                  <a className="btn btn-ghost btn-sm" href="/api/certificate/ca.pem" download>
                    <Download size={15} aria-hidden /> <span>ca.pem</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="stack">
          <Card title="Router settings">
            <p className="muted">In the TP-Link router: Wireless → Wireless Security → WPA/WPA2 - Enterprise.</p>
            <dl className="kv">
              <dt>Version</dt>
              <dd>WPA2</dd>
              <dt>Encryption</dt>
              <dd>AES</dd>
              <dt>RADIUS Server IP</dt>
              <dd>This server’s address on the network</dd>
              <dt>RADIUS Server Port</dt>
              <dd><code>1812</code></dd>
              <dt>RADIUS Password</dt>
              <dd>The <code>secret</code> in <code>data\clients.conf</code></dd>
            </dl>
          </Card>

          <Card title="Backup">
            <p className="muted">
              Download a copy of the portal database: admins, Wi-Fi users and activity. Keep it private, since
              it holds password hashes.
            </p>
            <div className="row-end">
              <a className="btn btn-secondary btn-md" href="/api/backup" download>
                <Database size={16} aria-hidden /> <span>Download backup</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
