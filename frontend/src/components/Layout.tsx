import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

const baseNavItems = [
  { to: '/', label: 'Tableau de bord' },
  { to: '/campagnes', label: 'Campagnes' },
  { to: '/prospections', label: 'Prospections' },
]

export function Layout() {
  const navigate = useNavigate()
  const { data: currentUser } = useCurrentUser()

  function logout() {
    localStorage.removeItem('access_token')
    navigate('/login')
  }

  const navItems = [
    ...baseNavItems,
    ...(currentUser?.role === 'admin' ? [{ to: '/users', label: 'Utilisateurs' }] : []),
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
