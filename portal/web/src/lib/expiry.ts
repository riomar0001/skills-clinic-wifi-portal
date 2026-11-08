import { timeAgo } from './format'

const HOUR = 3_600
const DAY = 24 * HOUR

/** Access lengths offered in the expiry dropdown, from 1 hour to 90 days. */
export const EXPIRY_PRESET_GROUPS: { label: string; presets: { label: string; seconds: number }[] }[] = [
  {
    label: 'Hours',
    presets: [1, 2, 3, 4, 6, 8, 12].map((h) => ({ label: h === 1 ? '1 hour' : `${h} hours`, seconds: h * HOUR })),
  },
  {
    label: 'Days',
    presets: [
      { label: '1 day', seconds: DAY },
      { label: '2 days', seconds: 2 * DAY },
      { label: '3 days', seconds: 3 * DAY },
      { label: '1 week', seconds: 7 * DAY },
      { label: '2 weeks', seconds: 14 * DAY },
      { label: '30 days', seconds: 30 * DAY },
      { label: '60 days', seconds: 60 * DAY },
      { label: '90 days', seconds: 90 * DAY },
    ],
  },
]

/** Unix seconds `seconds` from now, rounded up to the next whole minute. */
export function expiryFromNow(seconds: number, nowMs = Date.now()): number {
  return Math.ceil(nowMs / 60_000) * 60 + seconds
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
