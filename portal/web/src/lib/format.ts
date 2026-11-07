const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export const formatDateTime = (epochSeconds: number) => dateTime.format(epochSeconds * 1000)
export const formatDate = (epochSeconds: number) => dateOnly.format(epochSeconds * 1000)

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

export function timeAgo(epochSeconds: number, nowMs = Date.now()): string {
  const diff = epochSeconds - Math.floor(nowMs / 1000)
  for (const [unit, seconds] of STEPS) {
    if (Math.abs(diff) >= seconds) return relative.format(Math.round(diff / seconds), unit)
  }
  return 'just now'
}
