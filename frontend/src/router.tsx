import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CampagnesPage } from './pages/CampagnesPage'
import { ProspectionsPage } from './pages/ProspectionsPage'
import { NouvelleProspectionPage } from './pages/NouvelleProspectionPage'
import { DesignSystemPage } from './pages/DesignSystemPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/campagnes" element={<CampagnesPage />} />
            <Route path="/prospections" element={<ProspectionsPage />} />
            <Route path="/prospections/new" element={<NouvelleProspectionPage />} />
            <Route path="/design-system" element={<DesignSystemPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
