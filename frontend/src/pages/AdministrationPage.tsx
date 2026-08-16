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

export function AdministrationPage() {
  const location = useLocation()
  const initialTab = (location.state as { tab?: string } | null)?.tab === 'stations'
    ? 'stations'
    : 'utilisateurs'

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
      <TabsPrimitive.Root defaultValue={initialTab}>
        <TabsPrimitive.List className="flex w-fit gap-2">
          <TabsPrimitive.Tab value="utilisateurs" className={chipClass}>
            Utilisateurs · {users.length}
          </TabsPrimitive.Tab>
          <TabsPrimitive.Tab value="stations" className={chipClass}>
            Stations · {stations.length}
          </TabsPrimitive.Tab>
        </TabsPrimitive.List>
        <TabsPrimitive.Panel value="utilisateurs" className="pt-6">
          <UsersPage />
        </TabsPrimitive.Panel>
        <TabsPrimitive.Panel value="stations" className="pt-6">
          <StationPage />
        </TabsPrimitive.Panel>
      </TabsPrimitive.Root>
    </div>
  )
}
