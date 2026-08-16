import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { UsersPage } from './UsersPage'
import { StationPage } from './StationPage'

export function AdministrationPage() {
  return (
    <div className="px-6 pt-6">
      <Tabs defaultValue="utilisateurs">
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
