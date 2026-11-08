import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { WIFI_SSID, wifiQrPayload } from '@/lib/wifi'

/** Scan-to-join code for the clinic Wi-Fi with this ID filled in; the phone then asks for the password. */
export function WifiQrCard({ username, description }: { username: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Join with a QR code</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {/* White box in both themes: scanners need dark modules on a light background. */}
        <div className="shrink-0 rounded-lg bg-white p-3">
          <QRCodeSVG
            value={wifiQrPayload(username)}
            size={160}
            level="M"
            role="img"
            aria-label={`QR code to join ${WIFI_SSID} as ${username}`}
          />
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Network</dt>
            <dd className="font-medium">{WIFI_SSID}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Username</dt>
            <dd><code className="font-mono">{username}</code></dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Security</dt>
            <dd>WPA2-Enterprise, PEAP, MSCHAPV2</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
