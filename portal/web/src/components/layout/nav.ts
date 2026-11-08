import { Activity, Inbox, LayoutDashboard, Server, ShieldCheck, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Manage',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/wifi-users', label: 'Wi-Fi users', icon: Users },
      { to: '/access-requests', label: 'Access requests', icon: Inbox },
      { to: '/admins', label: 'Admins', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/activity', label: 'Activity', icon: Activity },
      { to: '/server', label: 'Server', icon: Server },
    ],
  },
]

/** Breadcrumb label for the first path segment. */
export const SECTION_LABELS: Record<string, string> = {
  '': 'Dashboard',
  'wifi-users': 'Wi-Fi users',
  'access-requests': 'Access requests',
  admins: 'Admins',
  activity: 'Activity',
  server: 'Server',
  account: 'Your account',
}
