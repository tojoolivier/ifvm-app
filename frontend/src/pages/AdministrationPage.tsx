import { useLocation } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { UsersPage } from './UsersPage'
import { StationPage } from './StationPage'

export function AdministrationPage() {
  const location = useLocation()
  const initialTab = (location.state as { tab?: string } | null)?.tab === 'stations'
    ? 'stations'
    : 'utilisateurs'

  return (
    <div className="px-6 pt-6">
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>
          <TabsTrigger value="stations">Stations</TabsTrigger>
        </TabsList>
        <TabsContent value="utilisateurs">
          <UsersPage />
        </TabsContent>
        <TabsContent value="stations">
          <StationPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
