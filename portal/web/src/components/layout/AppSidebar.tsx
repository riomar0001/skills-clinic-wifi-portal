import { Link, NavLink, useLocation } from 'react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAccessRequests } from '@/features/access-requests/api'
import { Logo } from './Logo'
import { NAV_GROUPS } from './nav'
import { NavUser } from './NavUser'

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

export function AppSidebar({ admin }: { admin: string }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const waiting = useAccessRequests().data?.length ?? 0
  const badges: Record<string, number> = { '/access-requests': waiting }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" onClick={() => setOpenMobile(false)}>
                <Logo />
                <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">CCE Skills Clinic</span>
                  <span className="truncate text-xs text-muted-foreground">Wifi Admin Portal</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={isActive(pathname, to)} tooltip={label}>
                      <NavLink to={to} end={to === '/'} onClick={() => setOpenMobile(false)}>
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {badges[to] > 0 && (
                      <SidebarMenuBadge aria-label={`${badges[to]} waiting`}>{badges[to]}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser admin={admin} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
