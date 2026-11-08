/** Mirrors app/api/schemas.py in the backend. Times are Unix seconds. */

export type Role = 'admin' | 'wifi'

export interface AuthStatus {
  needs_setup: boolean
  /** Who is signed in: an admin or a Wi-Fi user; null when nobody is. */
  role: Role | null
  username: string | null
  name: string | null
}

export const SIGNED_OUT: AuthStatus = { needs_setup: false, role: null, username: null, name: null }

/** A Wi-Fi user's own account, as they see it. */
export interface Me {
  username: string
  first_name: string
  last_name: string
  email: string | null
  enabled: boolean
  expires_at: number | null
  expired: boolean
  device_limit: number | null
  devices: Device[]
  created_at: number
  last_connected_at: number | null
}

/** One Wi-Fi login attempt recorded by the login server. */
export interface Connection {
  at: number
  accepted: boolean
  device: string
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
  /** How many devices may use the account; null = no limit. */
  device_limit: number | null
  device_count: number
  created_at: number
  updated_at: number
}

/** A phone or laptop registered to a Wi-Fi account on its first successful login. */
export interface Device {
  id: number
  mac: string
  first_seen_at: number
  last_seen_at: number
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
  /** Let's Encrypt: devices check it against their built-in list (Android: "Use system certificates"). */
  trusted: boolean
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

/** One CSV row as the server read it; password is only set after a real import (shown once). */
export interface ImportRow {
  line: number
  username: string
  first_name: string
  last_name: string
  email: string
  errors: string[]
  password: string | null
}

export interface ImportResult {
  rows: ImportRow[]
  error_count: number
  added: number
}
