import { Activity, KeyRound, LayoutDashboard, LogOut, Menu, Server, ShieldCheck, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router'
import { useLogout } from '../../features/auth/api'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/wifi-users', label: 'Wi-Fi users', icon: Users, end: false },
  { to: '/admins', label: 'Admins', icon: ShieldCheck, end: false },
  { to: '/activity', label: 'Activity', icon: Activity, end: false },
  { to: '/server', label: 'Server', icon: Server, end: false },
]

export function AppShell() {
  const admin = useOutletContext<string>()
  const logout = useLogout()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  const signOut = () => logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })

  return (
    <div className={`shell${menuOpen ? ' menu-open' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>Wi-Fi Portal</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="sidebar"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <aside id="sidebar" className="sidebar">
        <div className="brand sidebar-brand">
          <Logo />
          <span>Wi-Fi Portal</span>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link" onClick={closeMenu}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <NavLink to="/account" className="nav-link" onClick={closeMenu}>
            <KeyRound size={18} aria-hidden />
            <span className="truncate">{admin}</span>
          </NavLink>
          <button type="button" className="nav-link nav-button" onClick={signOut} disabled={logout.isPending}>
            <LogOut size={18} aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={closeMenu} aria-hidden />

      <main className="main">
        <div className="container">
          <Outlet context={admin} />
        </div>
      </main>
    </div>
  )
}
