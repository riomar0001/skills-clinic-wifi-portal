import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, disabled, children, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner spinner-sm" aria-hidden /> : icon}
      {children && <span>{children}</span>}
    </button>
  )
}

interface ButtonLinkProps {
  to: string
  variant?: Variant
  size?: Size
  icon?: ReactNode
  children: ReactNode
}

export function ButtonLink({ to, variant = 'secondary', size = 'md', icon, children }: ButtonLinkProps) {
  return (
    <Link to={to} className={`btn btn-${variant} btn-${size}`}>
      {icon}
      <span>{children}</span>
    </Link>
  )
}
