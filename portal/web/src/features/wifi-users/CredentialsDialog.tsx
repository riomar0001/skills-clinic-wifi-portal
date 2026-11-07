import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { CopyButton } from '../../components/ui/misc'

export interface Credentials {
  username: string
  password: string
}

/** Shown once after creating a user or resetting a password; the portal can't show the password again. */
export function CredentialsDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const both = credentials ? `Username: ${credentials.username}\nPassword: ${credentials.password}` : ''
  return (
    <Modal
      open={credentials !== null}
      title="Share these Wi-Fi details"
      description="This password won’t be shown again. Copy it now and give it to the person."
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}
    >
      {credentials && (
        <div className="stack">
          <dl className="credentials">
            <div>
              <dt>Username</dt>
              <dd><code>{credentials.username}</code><CopyButton value={credentials.username} label="Copy username" /></dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd><code>{credentials.password}</code><CopyButton value={credentials.password} label="Copy password" /></dd>
            </div>
          </dl>
          <div className="row">
            <CopyButton value={both} label="Copy both" />
            <span className="muted small">Copy both</span>
          </div>
          <div className="callout">
            <p className="callout-title">Joining the Wi-Fi</p>
            <ul className="tips">
              <li><b>iPhone / Mac:</b> enter the username and password, then tap <b>Trust</b>.</li>
              <li><b>Android:</b> EAP method <b>PEAP</b>, Phase 2 <b>MSCHAPV2</b>, CA certificate <b>Trust on first use</b>.</li>
              <li><b>Windows:</b> enter the username and password, then click <b>Connect</b>.</li>
              <li>Type the username in lowercase.</li>
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}
