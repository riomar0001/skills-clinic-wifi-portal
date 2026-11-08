/** Mirrors app/api/schemas.py in the backend. Times are Unix seconds. */

export interface AuthStatus {
  needs_setup: boolean
  admin: string | null
}

export interface WifiUser {
  /** Student ID / Faculty ID; also the Wi-Fi username. */
  username: string
  first_name: string
  last_name: string
  /** UMindanao email; null for accounts imported before emails were collected. */
  email: string | null
  note: string
  enabled: boolean
  /** Unix seconds; null = never expires. */
  expires_at: number | null
  expired: boolean
  created_at: number
  updated_at: number
}

export type WifiStatusFilter = 'all' | 'active' | 'expired' | 'disabled'

export interface Admin {
  username: string
  created_at: number
}

export interface ActivityEntry {
  id: number
  at: number
  actor: string
  action: string
  target: string
}

export interface Certificate {
  name: string
  issuer: string
  expires_at: number
  sha256: string
}

export interface Dashboard {
  wifi_total: number
  wifi_active: number
  wifi_disabled: number
  wifi_expired: number
  admins: number
  radius: { ok: boolean; detail: string }
  certificate: Certificate | null
  recent_activity: ActivityEntry[]
}
