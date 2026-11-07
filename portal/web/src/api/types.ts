/** Mirrors app/api/schemas.py in the backend. Times are Unix seconds. */

export interface AuthStatus {
  needs_setup: boolean
  admin: string | null
}

export interface WifiUser {
  username: string
  full_name: string
  note: string
  enabled: boolean
  created_at: number
  updated_at: number
}

export type WifiStatusFilter = 'all' | 'enabled' | 'disabled'

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
  wifi_enabled: number
  wifi_disabled: number
  admins: number
  radius: { ok: boolean; detail: string }
  certificate: Certificate | null
  recent_activity: ActivityEntry[]
}
