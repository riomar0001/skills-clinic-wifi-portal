import type { ReactNode } from 'react'
import { Logo } from './Logo'

export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo />
          <span>Wi-Fi Portal</span>
        </div>
        <h1 className="auth-title">{title}</h1>
        {description && <p className="auth-description">{description}</p>}
        {children}
      </div>
    </main>
  )
}
