import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthCtx, SalonCtx } from '../App'
import Logo from './Logo'
import { DropdownMenu, MenuItem, MenuSeparator } from './Menu'
import {
  IconTag, IconClipboard, IconArchive, IconCoins,
  IconChevronDown, IconSwap, IconPower, IconSettings,
} from './Icons'

const tabs = [
  { to: '/vente',  Icon: IconTag,       label: 'Vente' },
  { to: '/recap',  Icon: IconClipboard, label: 'Récap' },
  { to: '/stocks', Icon: IconArchive,   label: 'Stocks' },
  { to: '/caisse', Icon: IconCoins,     label: 'Caisse' },
]

export default function Layout() {
  const { logout } = useContext(AuthCtx)
  const { salon, clearSalon } = useContext(SalonCtx)
  const navigate = useNavigate()

  if (!salon) return <Navigate to="/salons" replace />

  const changeSalon = () => { clearSalon(); navigate('/salons') }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      {/* Header — pt étendu pour l'encoche en mode app installée */}
      <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)]"
        style={{ background: 'linear-gradient(135deg, #1e5038 0%, #2f855a 100%)' }}>
        <div className="px-3 py-2.5 flex items-center justify-between gap-2">
          {/* Sélecteur de salon */}
          <DropdownMenu className="min-w-0 flex-1" trigger={({ open, toggle, ref }) => (
            <button ref={ref} onClick={toggle}
              aria-haspopup="menu" aria-expanded={open}
              className="w-full flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-2xl min-w-0
                         hover:bg-white/10 active:bg-white/15 transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
              <Logo size={36} variant="glass" className="shrink-0" />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="font-bold text-white text-sm leading-tight truncate">
                    {salon.nom}
                  </span>
                  <IconChevronDown size={15}
                    className={`shrink-0 text-green-200/90 transition-transform duration-150
                                ${open ? 'rotate-180' : ''}`} />
                </div>
                {salon.lieu && (
                  <div className="text-xs text-green-200/80 truncate leading-tight">{salon.lieu}</div>
                )}
              </div>
            </button>
          )}>
            <MenuItem icon={<IconSwap size={17} />} onClick={changeSalon}>
              Changer de salon
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<IconPower size={17} />} onClick={logout} danger>
              Déconnexion
            </MenuItem>
          </DropdownMenu>

          {/* Administration */}
          <NavLink to="/admin" aria-label="Administration" title="Administration"
            className={({ isActive }) =>
              `btn-header w-9 h-9 shrink-0 ${isActive ? 'bg-white/25 text-white border-white/25' : ''}`
            }>
            <IconSettings size={18} />
          </NavLink>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom nav — pb étendu pour la barre de geste iOS/Android */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white/95 backdrop-blur
                      border-t border-gray-100 flex z-20
                      shadow-[0_-1px_8px_0_rgb(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center pt-2 pb-1.5 gap-1 transition-colors
               border-t-2 ${isActive ? 'border-forest-500 text-forest-600' : 'border-transparent text-gray-400'}`
            }>
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2.1 : 1.75} />
                <span className="text-[11px] font-semibold tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
