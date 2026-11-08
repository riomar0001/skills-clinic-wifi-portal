import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from './Logo'

interface AuthLayoutProps {
  title: string
  description?: ReactNode
  /** Second line under "CCE Skills Clinic". */
  product?: string
  footer?: ReactNode
  children: ReactNode
}

export function AuthLayout({ title, description, product = 'Wifi Admin Portal', footer, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6 md:p-10">
      <div className="flex items-center gap-3">
        <Logo className="size-11" />
        <div className="grid leading-tight">
          <span className="font-semibold">CCE Skills Clinic</span>
          <span className="text-sm text-muted-foreground">{product}</span>
        </div>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <div className="max-w-sm text-center text-xs text-muted-foreground">
        {footer ?? 'Admin access only. Wi-Fi users don’t sign in here.'}
      </div>
    </main>
  )
}
