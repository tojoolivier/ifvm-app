import { useState } from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { UsersPage } from './UsersPage'
import { StationPage } from './StationPage'

const chipClass =
  'rounded-full border px-5 py-2.5 font-sans text-[13px] font-bold transition-colors ' +
  'border-ifvm-brouillon-border bg-background text-ifvm-text-tertiary ' +
  'data-active:border-ifvm-green-text data-active:bg-ifvm-green-text data-active:text-white'

type Tab = 'utilisateurs' | 'stations'

export function AdministrationPage() {
  const location = useLocation()
  const initialTab: Tab = (location.state as { tab?: string } | null)?.tab === 'stations'
    ? 'stations'
    : 'utilisateurs'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [showCreateUser, setShowCreateUser] = useState(false)

  const { data: users = [] } = useQuery<unknown[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users/').then((r) => r.data),
  })
  const { data: stations = [] } = useQuery<unknown[]>({
    queryKey: ['stations'],
    queryFn: () => api.get('/stations').then((r) => r.data),
  })

  return (
    <div className="px-6 pt-6">
      <TabsPrimitive.Root value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="mb-6 flex items-center justify-between">
          <TabsPrimitive.List className="flex w-fit gap-2">
            <TabsPrimitive.Tab value="utilisateurs" className={chipClass}>
              Utilisateurs · {users.length}
            </TabsPrimitive.Tab>
            <TabsPrimitive.Tab value="stations" className={chipClass}>
              Stations · {stations.length}
            </TabsPrimitive.Tab>
          </TabsPrimitive.List>

          {tab === 'utilisateurs' ? (
            <button
              onClick={() => setShowCreateUser(true)}
              className="rounded-[8px] bg-ifvm-green-text px-4 py-2 font-sans text-sm font-bold text-white transition hover:bg-[#1a4429]"
            >
              + Nouvel utilisateur
            </button>
          ) : (
            <button
              disabled
              title="Indisponible : l'API n'expose aucune écriture sur station_fixe (lecture seule)."
              className="cursor-not-allowed rounded-[8px] bg-ifvm-green-text px-4 py-2 font-sans text-sm font-bold text-white opacity-50"
            >
              + Nouvelle station
            </button>
          )}
        </div>

        <TabsPrimitive.Panel value="utilisateurs">
          <UsersPage showCreate={showCreateUser} onShowCreateChange={setShowCreateUser} />
        </TabsPrimitive.Panel>
        <TabsPrimitive.Panel value="stations">
          <StationPage />
        </TabsPrimitive.Panel>
      </TabsPrimitive.Root>
    </div>
  )
}
