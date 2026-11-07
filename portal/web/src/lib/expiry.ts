import { timeAgo } from './format'

const DAY = 86_400

export const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: 'Never', days: null },
  { label: '1 day', days: 1 },
  { label: '1 week', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

/** Unix seconds `days` from now, rounded up to the end of that minute. */
export function expiryFromNow(days: number, nowMs = Date.now()): number {
  return Math.ceil(nowMs / 60_000) * 60 + days * DAY
}

/** Unix seconds -> value for <input type="datetime-local"> (the browser's local time). */
export function toLocalInput(epoch: number): string {
  const d = new Date(epoch * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value -> Unix seconds, or null when empty or invalid. */
export function fromLocalInput(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

export type UserStatus = 'active' | 'disabled' | 'expired'

export function userStatus(user: { enabled: boolean; expired: boolean }): UserStatus {
  if (!user.enabled) return 'disabled'
  return user.expired ? 'expired' : 'active'
}

export function isExpired(expiresAt: number | null, nowMs = Date.now()): boolean {
  return expiresAt !== null && expiresAt * 1000 <= nowMs
}

/** "Never", "in 6 days", "2 days ago" */
export function describeExpiry(expiresAt: number | null): string {
  return expiresAt === null ? 'Never' : timeAgo(expiresAt)
}
