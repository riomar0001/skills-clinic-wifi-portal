import { Fragment } from 'react'
import { Link, Outlet, useLocation, useOutletContext } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { SECTION_LABELS } from './nav'

function useCrumbs(): { label: string; to?: string }[] {
  const segments = useLocation().pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const section = segments[0] ?? ''
  const crumbs: { label: string; to?: string }[] = [{ label: SECTION_LABELS[section] ?? 'Not found', to: `/${section}` }]
  if (segments[1]) crumbs.push({ label: segments[1] })
  return crumbs
}

export function AppShell() {
  const admin = useOutletContext<string>()
  const crumbs = useCrumbs()

  return (
    <SidebarProvider>
      <AppSidebar admin={admin} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {i < crumbs.length - 1 && c.to ? (
                      <BreadcrumbLink asChild><Link to={c.to}>{c.label}</Link></BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="max-w-48 truncate">{c.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <Outlet context={admin} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
