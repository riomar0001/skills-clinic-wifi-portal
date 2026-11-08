import type { ActivityEntry } from '../../api/types'

const DESCRIPTIONS: Record<string, (target: string) => string> = {
  'wifi.create': (t) => `added Wi-Fi user ${t}`,
  'wifi.update': (t) => `edited Wi-Fi user ${t}`,
  'wifi.enable': (t) => `enabled Wi-Fi user ${t}`,
  'wifi.disable': (t) => `disabled Wi-Fi user ${t}`,
  'wifi.password': (t) => `reset the password of ${t}`,
  'wifi.expiry': (t) => `set an expiry date for ${t}`,
  'wifi.rename': (t) => `changed a Wi-Fi user's ID from ${t}`,
  'wifi.device_limit': (t) => `set the device limit of ${t}`,
  'wifi.device_remove': (t) => `removed a device from ${t}`,
  'wifi.expiry_clear': (t) => `removed the expiry date of ${t}`,
  'wifi.delete': (t) => `deleted Wi-Fi user ${t}`,
  'wifi.import': (t) => `imported ${t} from the old user list`,
  'wifi.csv_import': (t) => `added ${t} from a CSV file`,
  'wifi.self_password': () => 'changed their own Wi-Fi password',
  'request.create': () => 'requested Wi-Fi access',
  'request.approve': (t) => `approved the access request of ${t}`,
  'request.reject': (t) => `rejected the access request of ${t}`,
  'admin.setup': () => 'set up the portal',
  'admin.login': () => 'signed in',
  'admin.create': (t) => `added admin ${t}`,
  'admin.promote': (t) => `made Wi-Fi user ${t} an admin`,
  'admin.delete': (t) => `removed admin ${t}`,
  'admin.password': (t) => `changed the password of admin ${t}`,
  'admin.reveal_secret': () => 'viewed the router secret',
}

export function describeActivity(entry: ActivityEntry): string {
  const describe = DESCRIPTIONS[entry.action]
  return describe ? describe(entry.target) : `${entry.action} ${entry.target}`
}
