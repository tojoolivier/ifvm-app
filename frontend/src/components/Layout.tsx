import { useEffect, useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate, useMatches } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { api } from '../api/client'
import { campagneActive, type CampagneDatee } from '../lib/campagne-active'

type RouteHandle = { title?: string; parent?: string; crumb?: string }

type Campagne = CampagneDatee

const baseNavItems = [
  { to: '/', label: 'Tableau de bord' },
]

// Nombre d'entités du référentiel admin — fixe (types d'entités), pas un total
// d'enregistrements côté API. 7 comme la maquette (README §11, « 7 référentiels ») :
// campagne y figure aussi, la carte renvoyant vers /campagnes pour son CRUD complet.
const NB_REFERENTIELS = 7

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

  // Sous 1024 px le menu est un tiroir : il s'ouvre par le bouton de l'en-tête et se
  // referme dès qu'on navigue, qu'on touche le fond ou qu'on appuie sur Échap.
  const { pathname } = useLocation()
  const [menuOuvert, setMenuOuvert] = useState(false)
  useEffect(() => setMenuOuvert(false), [pathname])
  useEffect(() => {
    if (!menuOuvert) return
    const fermerSurEchap = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOuvert(false)
    window.addEventListener('keydown', fermerSurEchap)
    return () => window.removeEventListener('keydown', fermerSurEchap)
  }, [menuOuvert])

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
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
          { to: '/carte', label: 'Cartographie' },
          { to: '/syntheses', label: 'Synthèses & export' },
          { to: '/administration', label: 'Utilisateurs & stations', count: role === 'admin' ? nbUsers : undefined },
          { to: '/referentiels', label: 'Référentiels', count: NB_REFERENTIELS },
        ]
      : []),
    ...(role === 'verificateur' || role === 'prospecteur'
      ? [
          { to: '/prospections', label: 'Prospections', count: nbProspections },
          { to: '/carte', label: 'Cartographie' },
        ]
      : []),
    ...(role === 'validation_finale'
      ? [
          { to: '/validation-finale', label: 'Validation finale', count: nbVerifiees },
          { to: '/carte', label: 'Cartographie' },
        ]
      : []),
    ...(canTraitements
      ? [
          { to: '/traitements', label: 'Traitements', count: nbTraitements },
          // Heures de vol : même lectorat que Traitements (aérien) ; mène à une
          // page d'attente depuis la suppression de la fiche de vol.
          { to: '/fiches-vol', label: 'Heures de vol' },
        ]
      : []),
    // Parc aéronefs (#621) : lecture et affectations pour admin et chef ; l'écriture sur les
    // appareils est réservée à l'admin dans la page elle-même.
    ...(canAdminChef ? [{ to: '/parc-aeronefs', label: 'Parc aéronefs' }] : []),
    // Stock de pesticides (#606, #609) : consultation pour admin et chef.
    ...(canAdminChef ? [{ to: '/stock-pesticides', label: 'Stock pesticides' }] : []),
  ]

  return (
    // `h-dvh` : la hauteur visible réelle sur mobile (la barre d'adresse mange `100vh`).
    <div className="flex h-screen h-dvh bg-gray-50">
      {/* Fond du tiroir : toucher hors du menu le referme. */}
      {menuOuvert && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden print:hidden"
          aria-hidden
          onClick={() => setMenuOuvert(false)}
        />
      )}
      {/* `print:hidden` : la navigation n'a pas de sens sur un rapport imprimé. */}
      <aside
        id="menu-principal"
        className={`fixed inset-y-0 left-0 z-40 flex w-[236px] max-w-[85vw] shrink-0 flex-col overflow-y-auto bg-[#235a36] text-white transition-transform duration-200 lg:static lg:visible lg:translate-x-0 print:hidden ${
          menuOuvert ? 'translate-x-0' : '-translate-x-full invisible'
        }`}
      >
        <div className="px-[18px] py-5 flex items-center gap-2.5 border-b border-white/[.14]">
          <div className="h-[38px] w-[38px] shrink-0 rounded-[10px] bg-white flex items-center justify-center overflow-hidden">
            <img src="/logo.png" alt="IFVM" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-sm leading-tight truncate">IFVM · Supervision</p>
            <p className="text-[10.5px] font-medium text-white/62 leading-tight truncate">
              Lutte antiacridienne
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOuvert(false)}
            aria-label="Fermer le menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-white/80 hover:bg-white/10 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 py-3 space-y-[3px] px-2.5">
          {navItems.map(({ to, label, count }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-[8px] px-[11px] py-[11px] text-sm lg:py-[9px] ${
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
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <header className="h-[66px] shrink-0 flex items-center justify-between gap-3 px-4 sm:gap-[18px] sm:px-[28px] bg-[#fffdf8] border-b border-[#e7e0cd]">
          <button
            type="button"
            onClick={() => setMenuOuvert((o) => !o)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuOuvert}
            aria-controls="menu-principal"
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[#16201a] hover:bg-[#edece3] lg:hidden print:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak truncate">
              {handle?.crumb ?? (handle?.parent ? `${handle.parent} / ${title}` : title || 'IFVM')}
            </p>
            <p className="text-[19px] leading-[1.2] font-extrabold tracking-[-.3px] text-[#16201a] truncate">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {campagne && (
              <span className="hidden rounded-[20px] bg-ifvm-green-bg border border-ifvm-green-border px-[9px] py-[3px] text-[10.5px] font-semibold text-ifvm-green-text truncate max-w-[220px] md:inline">
                {campagne.name}
              </span>
            )}
            {nbEnAttente > 0 && (
              <span className="flex items-center gap-1.5 rounded-[20px] bg-ifvm-amber-bg border border-ifvm-amber-border px-[9px] py-[3px] text-[10.5px] font-semibold text-ifvm-amber-text">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-ifvm-amber" />
                <span className="sm:hidden">{nbEnAttente} en attente</span>
                <span className="hidden sm:inline">{nbEnAttente} fiches en attente</span>
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