import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { cn } from '@/lib/utils'
import { UtilisateursSection } from './UtilisateursSection'
import { StationsSection } from './StationsSection'
import { EquipesSection } from './EquipesSection'
import type { Equipe } from '@/lib/equipes'

/**
 * Écran Administration — même présentation que ReferentielsPage.tsx (§11 du
 * handoff) : nav de gauche (216px, une carte par section avec libellé, nom de
 * table, pastille API et compteur) + colonne de droite pleine largeur pour la
 * section active. Chaque section est auto-portante (requêtes et formulaires dans son composant).
 *
 * Regroupe ici tout ce qui concerne le personnel et les équipes : Utilisateurs,
 * Stations, Équipes (terrestres et aériennes dans une seule section filtrable, #602/#607) —
 * auparavant réparties entre
 * cet écran et ReferentielsPage.tsx (qui garde les référentiels « purs » :
 * pesticide, culture, code_stade, zone_acridien, poste_acridien, lieu_aerien).
 */
type Section = 'utilisateurs' | 'stations' | 'equipes'

export function AdministrationPage() {
  const location = useLocation()
  // Lien depuis une fiche de prospection ou de traitement : `?section=equipes&equipe=<id>`.
  const [searchParams] = useSearchParams()
  const equipeSelectionneeId = searchParams.get('equipe')
  const tab = (location.state as { tab?: string } | null)?.tab
  const initialSection: Section =
    searchParams.get('section') === 'equipes' || equipeSelectionneeId
      ? 'equipes'
      : tab === 'stations'
        ? 'stations'
        : 'utilisateurs'
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
  // Même clé et mêmes paramètres qu'EquipesSection : le compteur de nav et le tableau partagent
  // une seule requête (équipes actives et inactives, tous types).
  const { data: equipes = [] } = useQuery<Equipe[]>({
    queryKey: ['equipes'],
    queryFn: () => api.get('/equipes', { params: { inclure_inactifs: true } }).then((r) => r.data),
  })

  const navItems: {
    key: Section
    label: string
    table: string
    count: number
  }[] = [
    { key: 'utilisateurs', label: 'Utilisateurs', table: 'utilisateur', count: users.length },
    { key: 'stations', label: 'Stations', table: 'station_fixe', count: stations.length },
    { key: 'equipes', label: 'Équipes', table: 'equipe', count: equipes.length },
  ]

  return (
    // 28px latéraux : aligne le contenu sur le fil d'Ariane du header (Layout).
    <div className="grid grid-cols-1 items-start gap-4 px-4 pb-10 pt-4 sm:px-7 sm:pt-[26px] md:grid-cols-[216px_minmax(0,1fr)] md:gap-5">
      {/* Colonne gauche */}
      <nav aria-label="Administration" className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-[7px] md:overflow-visible md:pb-0">
        <span className="hidden px-0.5 pb-[3px] md:block font-sans text-[9.5px] font-semibold uppercase tracking-[1px] text-ifvm-text-weak">
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
                'flex w-[200px] shrink-0 items-center gap-[9px] rounded-[10px] border-[1.5px] px-[13px] py-[11px] text-left transition-colors duration-[120ms] md:w-auto md:shrink',
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
      ) : (
        <EquipesSection equipeSelectionneeId={equipeSelectionneeId} />
      )}
    </div>
  )
}
