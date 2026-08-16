import { Outlet, NavLink, useNavigate, useMatches } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { api } from '../api/client'

type RouteHandle = { title?: string; parent?: string; crumb?: string }

type Campagne = { id: string; name: string; start_date: string; end_date: string | null }

const baseNavItems = [
  { to: '/', label: 'Tableau de bord' },
]

// Nombre d'entités du référentiel admin — fixe (types d'entités), pas un total
// d'enregistrements côté API. 7 comme la maquette (README §11, « 7 référentiels ») :
// campagne y figure aussi, la carte renvoyant vers /campagnes pour son CRUD complet.
const NB_REFERENTIELS = 7

// Campagne n'a pas de champ `active` côté backend (#121) : dérivée par date tant
// que le backend n'expose pas ce concept. En cas de chevauchement, la plus récente gagne.
function campagneActive(campagnes: Campagne[]): Campagne | undefined {
  const today = new Date().toISOString().slice(0, 10)
  return campagnes
    .filter((c) => c.start_date <= today && (!c.end_date || c.end_date >= today))
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0]
}

function useCount(
  key: (string | undefined)[],
  url: string,
  params: Record<string, string> | undefined,
  enabled: boolean,
) {
  const { data = [] } = useQuery<unknown[]>({
    queryKey: key,
    queryFn: () => api.get(url, { params }).then((r) => r.data),
    enabled,
  })
  return data.length
}

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

  const canAdminChef = role === 'admin' || role === 'chef'
  const canProspections = canAdminChef || role === 'verificateur' || role === 'prospecteur'
  const canTraitements = canAdminChef || role === 'verificateur'
  const canValidationFinale = role === 'validation_finale'

  const { data: campagnes = [] } = useQuery<Campagne[]>({
    queryKey: ['campagnes'],
    queryFn: () => api.get('/campagnes').then((r) => r.data),
    enabled: canAdminChef,
  })
  const nbProspections = useCount(['prospections', 'intensive'], '/prospections', { type: 'intensive' }, canProspections)
  const nbVerifiees = useCount(['prospections', 'verifiee'], '/prospections', { statut: 'verifiee' }, canValidationFinale)
  const nbEnAttente = useCount(['prospections', 'en_attente'], '/prospections', { statut: 'en_attente' }, !!role)
  const nbTraitements = useCount(['traitements'], '/traitements', undefined, canTraitements)
  const nbUsers = useCount(['users'], '/users/', undefined, role === 'admin')

  const campagne = campagneActive(campagnes)

  const navItems: { to: string; label: string; count?: number }[] = [
    ...baseNavItems,
    ...(canAdminChef
      ? [
          { to: '/campagnes', label: 'Campagnes', count: campagnes.length },
          { to: '/prospections', label: 'Prospections', count: nbProspections },
          { to: '/carte', label: 'Carte des infestations' },
          { to: '/syntheses', label: 'Synthèses & export' },
          { to: '/administration', label: 'Utilisateurs & stations', count: role === 'admin' ? nbUsers : undefined },
          { to: '/referentiels', label: 'Référentiels', count: NB_REFERENTIELS },
        ]
      : []),
    ...(role === 'verificateur' || role === 'prospecteur'
      ? [
          { to: '/prospections', label: 'Prospections', count: nbProspections },
          { to: '/carte', label: 'Carte des infestations' },
        ]
      : []),
    ...(role === 'validation_finale'
      ? [
          { to: '/validation-finale', label: 'Validation finale', count: nbVerifiees },
          { to: '/carte', label: 'Carte des infestations' },
        ]
      : []),
    ...(canTraitements
      ? [{ to: '/traitements', label: 'Traitements', count: nbTraitements }]
      : []),
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-[236px] shrink-0 bg-[#235a36] text-white flex flex-col">
        <div className="px-[18px] py-5 flex items-center gap-2.5 border-b border-white/[.14]">
          <div className="h-[38px] w-[38px] shrink-0 rounded-[10px] bg-white flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="IFVM" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="font-extrabold text-sm leading-tight truncate">IFVM · Supervision</p>
            <p className="text-[10.5px] font-medium text-white/62 leading-tight truncate">
              Lutte antiacridienne
            </p>
          </div>
        </div>
        <nav className="flex-1 py-3 space-y-[3px] px-2.5">
          {navItems.map(({ to, label, count }) => (
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
                  <span className="flex-1 truncate">{label}</span>
                  {count !== undefined && (
                    <span className="font-mono text-[10px] font-semibold text-white/72">
                      {count}
                    </span>
                  )}
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
        <header className="h-[66px] shrink-0 flex items-center justify-between gap-[18px] px-[28px] bg-[#fffdf8] border-b border-[#e7e0cd]">
          <div className="min-w-0">
            <p className="text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak truncate">
              {handle?.crumb ?? (handle?.parent ? `${handle.parent} / ${title}` : title || 'IFVM')}
            </p>
            <p className="text-[19px] leading-[1.2] font-extrabold tracking-[-.3px] text-[#16201a] truncate">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {campagne && (
              <span className="rounded-[20px] bg-ifvm-green-bg border border-ifvm-green-border px-[9px] py-[3px] text-[10.5px] font-semibold text-ifvm-green-text truncate max-w-[220px]">
                {campagne.name}
              </span>
            )}
            {nbEnAttente > 0 && (
              <span className="flex items-center gap-1.5 rounded-[20px] bg-ifvm-amber-bg border border-ifvm-amber-border px-[9px] py-[3px] text-[10.5px] font-semibold text-ifvm-amber-text">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ifvm-amber" />
                {nbEnAttente} fiches en attente
              </span>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}