import { Outlet, NavLink, useNavigate, useMatches } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

type RouteHandle = { title?: string; parent?: string }

const baseNavItems = [
  { to: '/', label: 'Tableau de bord' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  chef: 'Chef',
  verificateur: 'Vérificateur',
  prospecteur: 'Prospecteur',
  validation_finale: 'Validation finale',
}

function initiales(nom?: string, prenom?: string) {
  const a = prenom?.trim()?.[0] ?? ''
  const b = nom?.trim()?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export function Layout() {
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()
  const matches = useMatches()
  const handle = matches[matches.length - 1]?.handle as RouteHandle | undefined
  const title = handle?.title ?? ''

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_name')
    localStorage.removeItem('user_email')
    localStorage.removeItem('user_id')
    navigate('/login')
  }

  const role = currentUser?.role || localStorage.getItem('user_role')

  const navItems = [
    ...baseNavItems,
    ...(role === 'admin' || role === 'chef'
      ? [
          { to: '/campagnes', label: 'Campagnes' },
          { to: '/prospections', label: 'Prospections' },
          { to: '/carte', label: 'Carte des infestations' },
          { to: '/syntheses', label: 'Synthèses & export' },
          { to: '/administration', label: 'Administration' },
          { to: '/referentiels', label: 'Référentiels' },
        ]
      : []),
    ...(role === 'verificateur' || role === 'prospecteur'
      ? [
          { to: '/prospections', label: 'Prospections' },
          { to: '/carte', label: 'Carte des infestations' },
        ]
      : []),
    ...(role === 'validation_finale'
      ? [
          { to: '/validation-finale', label: 'Validation finale' },
          { to: '/carte', label: 'Carte des infestations' },
        ]
      : []),
    ...(role === 'admin' || role === 'chef' || role === 'verificateur'
      ? [{ to: '/traitements', label: 'Traitements' }]
      : []),
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-[236px] shrink-0 bg-[#235a36] text-white flex flex-col">
        <div className="px-4 py-4 flex items-center gap-2.5">
          <div className="h-[38px] w-[38px] shrink-0 rounded-[10px] bg-white flex items-center justify-center text-[#235a36] font-extrabold text-xs">
            IFVM
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-sm leading-tight truncate">IFVM · Supervision</p>
            <p className="text-[10.5px] font-medium text-white/62 leading-tight truncate">
              Lutte antiacridienne
            </p>
          </div>
        </div>
        <nav className="flex-1 py-2 space-y-1 px-2.5">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-[8px] px-[11px] py-[9px] text-sm ${
                  isActive
                    ? 'bg-white/[.14] font-bold text-white'
                    : 'font-medium text-white/72 hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`h-[5px] w-[5px] shrink-0 rounded-full ${isActive ? 'bg-white' : 'bg-white/40'}`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="m-3 flex items-center gap-2.5 border-t border-white/15 pt-3">
          <div className="h-[26px] w-[26px] shrink-0 rounded-full bg-white/15 flex items-center justify-center text-[11px] font-bold">
            {initiales(currentUser?.nom, currentUser?.prenom)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">
              {currentUser ? `${currentUser.prenom} ${currentUser.nom}` : '—'}
            </p>
            <p className="text-[10.5px] text-white/62 truncate">
              {role ? ROLE_LABELS[role] ?? role : '—'}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-[10.5px] font-semibold text-white/72 hover:text-white shrink-0"
          >
            Quitter
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-[66px] shrink-0 flex items-center px-6 bg-[#fffdf8] border-b border-[#e7e0cd]">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold text-gray-500 truncate">
              {handle?.parent ? `${handle.parent} / ${title}` : title || 'IFVM'}
            </p>
            <p className="text-base font-bold text-gray-900 truncate">{title}</p>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}