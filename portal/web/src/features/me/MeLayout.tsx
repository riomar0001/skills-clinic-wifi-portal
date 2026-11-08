import { LogOut } from 'lucide-react'
import { Outlet, useNavigate, useOutletContext } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { useLogout } from '../auth/api'

/** Simple frame for Wi-Fi users: brand on the left, sign out on the right. No admin navigation. */
export function MeLayout() {
  const username = useOutletContext<string>()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Logo />
            <div className="grid leading-tight">
              <span className="text-sm font-semibold">CCE Skills Clinic</span>
              <span className="text-xs text-muted-foreground">My Wi-Fi</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })}>
            <LogOut /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:py-8">
        <Outlet context={username} />
      </main>
    </div>
  )
}
