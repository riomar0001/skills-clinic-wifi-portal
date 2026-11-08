import type { ActivityEntry } from '../../api/types'

const DESCRIPTIONS: Record<string, (target: string) => string> = {
  'wifi.create': (t) => `added Wi-Fi user ${t}`,
  'wifi.update': (t) => `edited Wi-Fi user ${t}`,
  'wifi.enable': (t) => `enabled Wi-Fi user ${t}`,
  'wifi.disable': (t) => `disabled Wi-Fi user ${t}`,
  'wifi.password': (t) => `reset the password of ${t}`,
  'wifi.expiry': (t) => `set an expiry date for ${t}`,
  'wifi.expiry_clear': (t) => `removed the expiry date of ${t}`,
  'wifi.delete': (t) => `deleted Wi-Fi user ${t}`,
  'wifi.import': (t) => `imported ${t} from the old user list`,
  'wifi.self_password': () => 'changed their own Wi-Fi password',
  'admin.setup': () => 'set up the portal',
  'admin.login': () => 'signed in',
  'admin.create': (t) => `added admin ${t}`,
  'admin.delete': (t) => `removed admin ${t}`,
  'admin.password': (t) => `changed the password of admin ${t}`,
  'admin.reveal_secret': () => 'viewed the router secret',
}

export function describeActivity(entry: ActivityEntry): string {
  const describe = DESCRIPTIONS[entry.action]
  return describe ? describe(entry.target) : `${entry.action} ${entry.target}`
}
