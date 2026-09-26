import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { UtilisateursSection } from './UtilisateursSection'
import { StationsSection } from './StationsSection'
import { EquipesAeriennesSection } from './EquipesAeriennesSection'
import { EquipesTerrestresSection } from './EquipesTerrestresSection'

/**
 * Écran Administration — même présentation que ReferentielsPage.tsx (§11 du
 * handoff) : nav de gauche (216px, une carte par section avec libellé, nom de
 * table, pastille API et compteur) + colonne de droite pleine largeur pour la
 * section active. Chaque section est auto-portante — même patron que
 * `EquipesAeriennesSection`/`EquipesTerrestresSection` côté Référentiels.
 *
 * Regroupe ici tout ce qui concerne le personnel et les équipes : Utilisateurs,
 * Stations, Équipes aériennes, Équipes terrestres — auparavant réparties entre
 * cet écran et ReferentielsPage.tsx (qui garde les référentiels « purs » :
 * pesticide, culture, code_stade, zone_acridien, poste_acridien, lieu_aerien).
 */
type Section = 'utilisateurs' | 'stations' | 'equipe_aerienne' | 'equipe_terrestre'

export function AdministrationPage() {
  const location = useLocation()
  const initialSection: Section =
    (location.state as { tab?: string } | null)?.tab === 'stations' ? 'stations' : 'utilisateurs'
  const [section, setSection] = useState<Section>(initialSection)
  const [showCreateUser, setShowCreateUser] = useState(false)

  const { data: users = [] } = useQuery<unknown[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })
  // Même clé et mêmes paramètres que StationsSection : le compteur de nav et
  // le tableau partagent une seule requête.
  const { data: stations = [] } = useQuery<unknown[]>({
    queryKey: ['stations', 'administration'],
    queryFn: () => api.get('/stations', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })
  const { data: equipesAeriennes = [] } = useQuery<unknown[]>({
    queryKey: ['equipes-aeriennes'],
    queryFn: () => api.get('/equipes-aeriennes').then((r) => r.data),
  })
  const { data: equipesTerrestres = [] } = useQuery<unknown[]>({
    queryKey: ['equipes-terrestres'],
    queryFn: () => api.get('/equipes-terrestres').then((r) => r.data),
  })

  const navItems: {
    key: Section
    label: string
    table: string
    count: number
  }[] = [
    { key: 'utilisateurs', label: 'Utilisateurs', table: 'utilisateur', count: users.length },
    { key: 'stations', label: 'Stations', table: 'station_fixe', count: stations.length },
    { key: 'equipe_aerienne', label: 'Équipes aériennes', table: 'equipe_aerienne', count: equipesAeriennes.length },
    { key: 'equipe_terrestre', label: 'Équipes terrestres', table: 'equipe_terrestre', count: equipesTerrestres.length },
  ]

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="grid grid-cols-[216px_minmax(0,1fr)] items-start gap-5 px-7 pb-10 pt-[26px]">
      {/* Colonne gauche */}
      <nav aria-label="Administration" className="flex flex-col gap-[7px]">
        <span className="px-0.5 pb-[3px] font-sans text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak">
          {navItems.length} sections
        </span>
        {navItems.map((item) => {
          const active = section === item.key
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => setSection(item.key)}
              className={cn(
                'flex items-center gap-[9px] rounded-[10px] border-[1.5px] px-[13px] py-[11px] text-left transition-colors duration-[120ms]',
                active ? 'border-[#235a36] bg-ifvm-green-bg' : 'border-[#e7e0cd] bg-white hover:bg-[#faf7ef]',
              )}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[12.5px]',
                    active ? 'font-bold text-[#235a36]' : 'font-semibold text-[#3a3a30]',
                  )}
                >
                  {item.label}
                </span>
                <span className="block font-mono text-[10px] font-medium text-ifvm-text-weak">
                  {item.table}
                </span>
              </span>
              <span className="rounded-full bg-ifvm-green-bg px-[7px] py-0.5 font-sans text-[9px] font-bold text-ifvm-green-text">
                API
              </span>
              <span className="font-mono text-[11px] font-semibold text-ifvm-text-weak">{item.count}</span>
            </button>
          )
        })}
      </nav>

      {/* Colonne droite */}
      {section === 'utilisateurs' ? (
        <UtilisateursSection showCreate={showCreateUser} onShowCreateChange={setShowCreateUser} />
      ) : section === 'stations' ? (
        <StationsSection />
      ) : section === 'equipe_aerienne' ? (
        <EquipesAeriennesSection />
      ) : (
        <EquipesTerrestresSection />
      )}
    </div>
  )
}
