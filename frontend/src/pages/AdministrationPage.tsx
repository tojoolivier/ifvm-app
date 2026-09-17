import { useState } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { UsersPage } from './UsersPage'
import { StationPage } from './StationPage'
import { EquipesAeriennesPage } from './EquipesAeriennesPage'

/**
 * Onglets de la maquette §10 (prototype ligne 891) : `padding 9px 16px`,
 * rayon `9px`, `700 12px` — le même gabarit que `NavTabs`, en état local ici
 * puisque l'écran n'a qu'une route (`/administration`).
 */
const chipClass =
  'rounded-[9px] border px-4 py-[9px] font-sans text-[12px] font-bold transition-colors ' +
  'border-ifvm-brouillon-border bg-background text-ifvm-text-tertiary hover:bg-ifvm-brouillon-bg ' +
  'data-[active]:border-ifvm-green-text data-[active]:bg-ifvm-green-text data-[active]:text-white'

/** Bouton d'ajout contextuel : `padding 10px 16px`, rayon `9px`, `700 12px`. */
const addButtonClass =
  'rounded-[9px] bg-ifvm-green-text px-4 py-[10px] font-sans text-[12px] font-bold text-white'

type Tab = 'utilisateurs' | 'stations' | 'equipes-aeriennes'

export function AdministrationPage() {
  const location = useLocation()
  const tabDemande = (location.state as { tab?: string } | null)?.tab
  const initialTab: Tab =
    tabDemande === 'stations' || tabDemande === 'equipes-aeriennes' ? tabDemande : 'utilisateurs'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [showCreateUser, setShowCreateUser] = useState(false)

  const { data: users = [] } = useQuery<unknown[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })
  // Même clé et mêmes paramètres que StationPage : le compteur d'onglet et le
  // tableau partagent une seule requête.
  const { data: stations = [] } = useQuery<unknown[]>({
    queryKey: ['stations', 'administration'],
    queryFn: () => api.get('/stations', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="flex flex-col gap-4 px-7 pb-10 pt-[26px]">
      <TabsPrimitive.Root value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="mb-4 flex items-center justify-between">
          <TabsPrimitive.List className="flex w-fit gap-2">
            <TabsPrimitive.Tab value="utilisateurs" className={chipClass}>
              Utilisateurs · {users.length}
            </TabsPrimitive.Tab>
            <TabsPrimitive.Tab value="stations" className={chipClass}>
              Stations · {stations.length}
            </TabsPrimitive.Tab>
            <TabsPrimitive.Tab value="equipes-aeriennes" className={chipClass}>
              Équipes aériennes
            </TabsPrimitive.Tab>
          </TabsPrimitive.List>

          {tab === 'utilisateurs' && (
            <button
              onClick={() => setShowCreateUser(true)}
              className={`${addButtonClass} transition hover:bg-[#1a4429]`}
            >
              + Nouvel utilisateur
            </button>
          )}
          {tab === 'stations' && (
            <button
              disabled
              title="Indisponible : l'API n'expose aucune écriture sur station_fixe (lecture seule)."
              className={`${addButtonClass} cursor-not-allowed opacity-50`}
            >
              + Nouvelle station
            </button>
          )}
          {/* Équipes aériennes / bases : deux actions distinctes (équipe, base),
              portées par leurs propres boutons dans EquipesAeriennesPage plutôt
              que par ce bouton unique d'en-tête. */}
        </div>

        <TabsPrimitive.Panel value="utilisateurs">
          <UsersPage showCreate={showCreateUser} onShowCreateChange={setShowCreateUser} />
        </TabsPrimitive.Panel>
        <TabsPrimitive.Panel value="stations">
          <StationPage />
        </TabsPrimitive.Panel>
        <TabsPrimitive.Panel value="equipes-aeriennes">
          <EquipesAeriennesPage />
        </TabsPrimitive.Panel>
      </TabsPrimitive.Root>
    </div>
  )
}
