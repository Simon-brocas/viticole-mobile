import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useContext } from 'react'
import { AuthCtx, SalonCtx } from '../App'

const tabs = [
  { to: '/vente',  icon: '🍾', label: 'Vente' },
  { to: '/recap',  icon: '📋', label: 'Récap' },
  { to: '/stocks', icon: '📦', label: 'Stocks' },
  { to: '/caisse', icon: '💰', label: 'Caisse' },
]

export default function Layout() {
  const { logout } = useContext(AuthCtx)
  const { salon, clearSalon } = useContext(SalonCtx)
  const navigate = useNavigate()

  if (!salon) return <Navigate to="/salons" replace />

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      {/* Header — pt étendu pour l'encoche en mode app installée */}
      <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)]"
        style={{ background: 'linear-gradient(135deg, #1e5038 0%, #2f855a 100%)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-lg" aria-hidden="true">🍷</div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">{salon.nom}</div>
              {salon.lieu && <div className="text-xs text-green-200/80">{salon.lieu}</div>}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <HeaderBtn onClick={() => { clearSalon(); navigate('/salons') }}>Changer</HeaderBtn>
            <NavLink to="/admin">
              {({ isActive }) => (
                <span className={`text-xs px-2 py-1.5 rounded-lg transition-colors
                  ${isActive ? 'bg-white/20 text-white font-semibold' : 'text-green-200 hover:text-white'}`}>
                  Admin
                </span>
              )}
            </NavLink>
            <HeaderBtn onClick={logout} ariaLabel="Se déconnecter">Déconnexion</HeaderBtn>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom nav — pb étendu pour la barre de geste iOS/Android */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 flex z-10
                      shadow-[0_-1px_8px_0_rgb(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        {tabs.map(t => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center pt-2 pb-1.5 gap-0.5 transition-colors
               border-t-2 ${isActive ? 'border-forest-500 text-forest-600' : 'border-transparent text-gray-400'}`
            }
          >
            <span className="text-[22px] leading-none" aria-hidden="true">{t.icon}</span>
            <span className="text-[11px] font-semibold tracking-wide">{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function HeaderBtn({ onClick, children, ariaLabel }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel}
      className="text-xs text-green-200 px-2 py-1.5 rounded-lg hover:text-white hover:bg-white/10 transition-colors active:bg-white/20">
      {children}
    </button>
  )
}
