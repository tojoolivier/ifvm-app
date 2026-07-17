import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

const baseNavItems = [
  { to: '/', label: 'Tableau de bord' },
]

export function Layout() {
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()

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
          { to: '/users', label: 'Utilisateurs' },
          { to: '/stations', label: 'Stations' }, // ✅ Ajout de la page Stations
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
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-green-800 text-white flex flex-col">
        <div className="px-4 py-4 border-b border-green-700 flex justify-center">
          <img src="/logo.png" alt="FVM Logo" className="h-20 w-20 rounded-full" />
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${isActive ? 'bg-green-600 font-semibold' : 'hover:bg-green-700'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          className="m-3 text-sm text-green-200 hover:text-white text-left px-3 py-2"
        >
          Déconnexion
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}